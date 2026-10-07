#!/usr/bin/env python3
"""Run: python3 tests/test_mac_supervisor.py

End-to-end test of scripts/oct/mac_supervisor.py without a Mac or Claude:
a bare git remote stands in for GitHub, a Founder clone creates a task, the
supervisor (--once) detects it and starts a fake worker that does what the real
Claude worker must do (heartbeat -> claim -> execute -> done -> push). The
Founder clone then pulls and sees the result.
"""
import datetime as dt
import json
import os
from pathlib import Path
import shutil
import subprocess as sp
import sys
import tempfile
import unittest

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO / 'scripts/oct'))
import mac_supervisor as ms  # noqa: E402

FAKE_WORKER = r'''#!/usr/bin/env bash
# Fake Claude worker: parses task ids from the prompt and follows the protocol.
set -e
PROMPT="$(cat)"
IDS="$(printf '%s' "$PROMPT" | sed -n 's/^Eligible tasks right now (best first): //p' | tr -d ',')"
O="node scripts/oct/ops.mjs"
$O heartbeat "$PHASE2_OPERATOR" --status working --doing "fake worker" --next "done" >/dev/null
for id in $IDS; do
  $O claim "$PHASE2_OPERATOR" "$id" --hours 2 >/dev/null || continue
  echo "executed $id" > "status/2026-10/roundtrip-$id.txt"
  $O done "$PHASE2_OPERATOR" "$id" --result "fake execution ok" >/dev/null
done
$O heartbeat "$PHASE2_OPERATOR" --status idle --doing "fake worker finished" --next "wait" >/dev/null
git add -A status/2026-10
git -c user.name=t -c user.email=t@t commit -qm "fake worker"
git pull -q --rebase origin main
git push -q origin HEAD:main
'''


def bare_remote(tmp):
    remote = tmp / 'remote.git'
    run(['git', 'clone', '-q', '--bare', str(REPO), str(remote)], tmp)
    head = run(['git', 'rev-parse', 'HEAD'], REPO)  # committed state of this checkout plays "main"
    run(['git', '--git-dir', str(remote), 'update-ref', 'refs/heads/main', head], tmp)
    run(['git', '--git-dir', str(remote), 'symbolic-ref', 'HEAD', 'refs/heads/main'], tmp)
    return remote


def run(cmd, cwd, **kw):
    return sp.run(cmd, cwd=cwd, check=True, stdout=sp.PIPE, stderr=sp.PIPE, text=True, **kw).stdout.strip()


class Eligibility(unittest.TestCase):
    def setUp(self):
        self.d = Path(tempfile.mkdtemp())
        (self.d / 'status/2026-10/tasks').mkdir(parents=True)

    def task(self, **t):
        t.setdefault('status', 'open')
        (self.d / f"status/2026-10/tasks/{t['id']}.json").write_text(json.dumps(t))

    def ids(self, now=None):
        return [t['id'] for t in ms.eligible_tasks(self.d, 'mac-local', ['local_browser'], now)]

    def test_rules(self):
        now = dt.datetime(2026, 10, 2, tzinfo=dt.timezone.utc)
        self.task(id='browser', requires=['local_browser'], priority=2)
        self.task(id='assigned', requires=[], assigned_to='mac-local', priority=1)
        self.task(id='cloud', requires=[])                                   # founder's
        self.task(id='human', requires=['local_browser', 'human'])          # never auto
        self.task(id='later', requires=['local_browser'], not_before='2026-10-03T00:00:00Z')
        self.task(id='blocked', requires=['local_browser'], after=['browser'])
        self.task(id='leased', requires=['local_browser'], claimed_by='codex', lease_until='2026-10-02T05:00:00Z')
        self.task(id='expired', requires=['local_browser'], claimed_by='codex', lease_until='2026-10-01T05:00:00Z', priority=5)
        self.task(id='mine', requires=['local_browser'], claimed_by='mac-local', lease_until='2026-10-02T05:00:00Z', priority=9)
        self.task(id='done', requires=['local_browser'], status='done')
        self.assertEqual(self.ids(now), ['mine', 'assigned', 'browser', 'expired'])  # claimed, assigned, then priority


class RoundTrip(unittest.TestCase):
    def test_founder_task_to_mac_and_back(self):
        tmp = Path(tempfile.mkdtemp())
        remote = bare_remote(tmp)
        founder = tmp / 'founder'
        run(['git', 'clone', '-q', str(remote), str(founder)], tmp)
        run(['git', 'rm', '-q', '-r', '--ignore-unmatch', 'status/2026-10/tasks'], founder)  # isolate from the real queue
        # Founder creates a mac-local task and pushes it to "GitHub"
        run(['node', 'scripts/oct/ops.mjs', 'task-new', 'founder', 'roundtrip-test', '--title', 'rt',
             '--lane', 'ops-drill', '--assign', 'mac-local'], founder)
        run(['git', 'add', '-A'], founder)
        run(['git', '-c', 'user.name=f', '-c', 'user.email=f@f', 'commit', '-qm', 'founder task'], founder)
        run(['git', 'push', '-q', 'origin', 'HEAD:main'], founder)
        # Mac supervisor: one poll with a fake worker
        worker = tmp / 'fake_worker.sh'
        worker.write_text(FAKE_WORKER)
        worker.chmod(0o755)
        mac = tmp / 'mac' / 'repo'
        env = {**os.environ, 'HOME': str(tmp / 'home')}
        p = sp.run([sys.executable, str(REPO / 'scripts/oct/mac_supervisor.py'), '--once',
                    '--repo', str(mac), '--state-dir', str(tmp / 'mac' / 'state'), '--remote', str(remote),
                    '--worker-cmd', str(worker), '--after-work-sec', '0'], env=env, capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stderr)
        # Founder sees the result via "GitHub"
        run(['git', 'pull', '-q', 'origin', 'main'], founder)
        t = json.loads((founder / 'status/2026-10/tasks/roundtrip-test.json').read_text())
        self.assertEqual(t['status'], 'done')
        self.assertEqual(t['claimed_by'], 'mac-local')
        self.assertTrue((founder / 'status/2026-10/roundtrip-roundtrip-test.txt').exists())
        op = json.loads((founder / 'status/2026-10/operators/mac-local.json').read_text())
        self.assertEqual(op['status'], 'idle')
        log = (tmp / 'mac/state/supervisor.log').read_text()
        self.assertIn('"worker_start"', log)
        self.assertIn('"worker_end"', log)
        # Second poll: nothing eligible -> no worker, idle heartbeat pushed by the supervisor
        p = sp.run([sys.executable, str(REPO / 'scripts/oct/mac_supervisor.py'), '--once',
                    '--repo', str(mac), '--state-dir', str(tmp / 'mac' / 'state'), '--remote', str(remote),
                    '--worker-cmd', '/bin/false', '--poll-sec', '0'], env=env, capture_output=True, text=True)
        self.assertEqual(p.returncode, 0, p.stderr)
        log = (tmp / 'mac/state/supervisor.log').read_text().splitlines()
        self.assertEqual(sum('"worker_start"' in l for l in log), 1)
        run(['git', 'pull', '-q', 'origin', 'main'], founder)
        op = json.loads((founder / 'status/2026-10/operators/mac-local.json').read_text())
        self.assertIn('supervisor alive', op['doing'])
        shutil.rmtree(tmp)

    def test_failed_worker_backs_off_and_reports_blocked(self):
        tmp = Path(tempfile.mkdtemp())
        remote = bare_remote(tmp)
        founder = tmp / 'founder'
        run(['git', 'clone', '-q', str(remote), str(founder)], tmp)
        run(['git', 'rm', '-q', '-r', '--ignore-unmatch', 'status/2026-10/tasks'], founder)  # isolate from the real queue
        run(['node', 'scripts/oct/ops.mjs', 'task-new', 'founder', 'will-fail', '--title', 'x', '--lane', 'x', '--assign', 'mac-local'], founder)
        run(['git', 'add', '-A'], founder)
        run(['git', '-c', 'user.name=f', '-c', 'user.email=f@f', 'commit', '-qm', 't'], founder)
        run(['git', 'push', '-q', 'origin', 'HEAD:main'], founder)
        env = {**os.environ, 'HOME': str(tmp / 'home')}
        p = sp.run([sys.executable, str(REPO / 'scripts/oct/mac_supervisor.py'), '--once',
                    '--repo', str(tmp / 'mac/repo'), '--state-dir', str(tmp / 'mac/state'), '--remote', str(remote),
                    '--worker-cmd', '/bin/false'], env=env, capture_output=True, text=True)
        self.assertEqual(p.returncode, 0)  # never dies
        log = (tmp / 'mac/state/supervisor.log').read_text()
        self.assertIn('"backoff"', log)
        run(['git', 'pull', '-q', 'origin', 'main'], founder)
        op = json.loads((founder / 'status/2026-10/operators/mac-local.json').read_text())
        self.assertEqual(op['status'], 'blocked')
        self.assertEqual(op['blocked_on'], 'process_failure')
        shutil.rmtree(tmp)


    def test_no_progress_run_is_held_not_respawned(self):
        """Worker that can only release (e.g. waits on an owner login) must not be respawned every poll."""
        tmp = Path(tempfile.mkdtemp())
        remote = bare_remote(tmp)
        founder = tmp / 'founder'
        run(['git', 'clone', '-q', str(remote), str(founder)], tmp)
        run(['git', 'rm', '-q', '-r', '--ignore-unmatch', 'status/2026-10/tasks'], founder)
        run(['node', 'scripts/oct/ops.mjs', 'task-new', 'founder', 'needs-login', '--title', 'x', '--lane', 'x', '--assign', 'mac-local'], founder)
        run(['git', 'add', '-A'], founder)
        run(['git', '-c', 'user.name=f', '-c', 'user.email=f@f', 'commit', '-qm', 't'], founder)
        run(['git', 'push', '-q', 'origin', 'HEAD:main'], founder)
        worker = tmp / 'release_worker.sh'
        worker.write_text(FAKE_WORKER.replace('echo "executed $id" > "status/2026-10/roundtrip-$id.txt"\n  $O done "$PHASE2_OPERATOR" "$id" --result "fake execution ok" >/dev/null',
                                              '$O release "$PHASE2_OPERATOR" "$id" --reason "login needed" >/dev/null'))
        worker.chmod(0o755)
        sys.path.insert(0, str(REPO / 'scripts/oct'))
        a = ms.argparse.Namespace(operator='mac-local', role='r', caps='local_browser', repo=str(tmp / 'mac/repo'),
                                  state_dir=str(tmp / 'mac/state'), remote=str(remote), claude='x', worker_cmd=str(worker),
                                  poll_sec=0, after_work_sec=0, hb_idle_min=120, worker_timeout_min=5, once=True,
                                  self_update=False, verbose=False, browser_min_gap_sec=0, settle_hb_min=6)
        os.environ['HOME'] = str(tmp / 'home')
        sup = ms.Supervisor(a)
        sup.loop_once()                      # runs the worker; it only releases -> no progress
        sup.loop_once()                      # same task set -> held, no second worker
        log = (tmp / 'mac/state/supervisor.log').read_text()
        self.assertEqual(log.count('"worker_start"'), 1)
        self.assertIn('"noprogress"', log)
        self.assertIn('"noprogress_hold"', log)
        shutil.rmtree(tmp)


class BrowserPolicy(unittest.TestCase):
    """Owner request 2026-10-02: no Chrome for Testing unless a real task needs a browser."""

    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        os.environ['HOME'] = str(self.tmp / 'home')
        ms.BASE = self.tmp / 'home/AIRE'
        remote = bare_remote(self.tmp)
        self.founder = self.tmp / 'founder'
        run(['git', 'clone', '-q', str(remote), str(self.founder)], self.tmp)
        run(['git', 'rm', '-q', '-r', '--ignore-unmatch', 'status/2026-10/tasks'], self.founder)
        run(['git', '-c', 'user.name=f', '-c', 'user.email=f@f', 'commit', '-qm', 'isolate', '--allow-empty'], self.founder)
        run(['git', 'push', '-q', 'origin', 'HEAD:main'], self.founder)   # isolate from the real task queue
        self.remote = remote

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def push_tasks(self, *specs):
        for args in specs:
            run(['node', 'scripts/oct/ops.mjs', 'task-new', 'founder', *args], self.founder)
        run(['git', 'add', '-A'], self.founder)
        run(['git', '-c', 'user.name=f', '-c', 'user.email=f@f', 'commit', '-qm', 't'], self.founder)
        run(['git', 'push', '-q', 'origin', 'HEAD:main'], self.founder)

    def sup(self, worker='/bin/true', **kw):
        a = ms.argparse.Namespace(operator='mac-local', role='r', caps='local_browser', repo=str(self.tmp / 'mac/repo'),
                                  state_dir=str(self.tmp / 'mac/state'), remote=str(self.remote), claude='x',
                                  worker_cmd=worker, poll_sec=0, after_work_sec=0, hb_idle_min=0, worker_timeout_min=5,
                                  once=True, self_update=False, verbose=False, browser_min_gap_sec=600, settle_hb_min=6)
        for k, v in kw.items():
            setattr(a, k, v)
        return ms.Supervisor(a)

    def log(self):
        p = self.tmp / 'mac/state/supervisor.log'
        return p.read_text() if p.exists() else ''

    def make_profiles(self):
        """Fake dedicated profiles mirroring the Mac layout; Last Version matches a fake CfT build."""
        home = Path(os.environ['HOME'])
        cft = home / 'Library/Caches/ms-playwright/chromium-1247/chrome-mac-arm64/Google Chrome for Testing.app/Contents'
        cft.mkdir(parents=True)
        import plistlib
        (cft / 'Info.plist').write_bytes(plistlib.dumps({'CFBundleShortVersionString': '141.0.7390.37'}))
        paths = {'coconala': home / 'Library/Caches/ms-playwright-mcp/mcp-chrome-abc123',
                 'booth': home / 'Library/Caches/ms-playwright-mcp/booth-profile',
                 'note': home / 'Library/Application Support/AIRevenueExperiment/browser-profiles/note-profile'}
        for p in paths.values():
            p.mkdir(parents=True)
            (p / 'Last Version').write_text('141.0.7390.37')
        return paths

    def test_mcp_config_browser_only_when_needed_and_headless_by_default(self):
        self.make_profiles()
        s = self.sup()
        self.assertEqual(json.loads(Path(s.mcp_config(())).read_text())['mcpServers'], {})
        t = [{'id': 'scan', 'requires': ['local_browser'], 'site': 'coconala.com'}]
        args = json.loads(Path(s.mcp_config(t)).read_text())['mcpServers']['playwright-coconala']['args']
        self.assertIn('--headless', args)
        self.assertIn('--output-dir', args)
        args = json.loads(Path(s.mcp_config([{**t[0], 'browser': 'headed'}], headed=True)).read_text())['mcpServers']['playwright-coconala']['args']
        self.assertNotIn('--headless', args)

    def test_tasks_route_to_their_dedicated_site_profiles(self):
        paths = self.make_profiles()
        s = self.sup()
        tasks = [{'id': 'h1-coconala-requests-scan', 'requires': ['local_browser'], 'site': 'coconala.com'},
                 {'id': 'h3-marketplace-snapshot', 'requires': ['local_browser'], 'profile': ['coconala', 'booth']},
                 {'id': 'h2-note-publish', 'requires': ['local_browser'], 'lane': 'note'},
                 {'id': 'new-site', 'requires': ['local_browser'], 'site': 'lancers.jp'},
                 {'id': 'h1-crowdworks-scan-1008', 'requires': ['local_browser'], 'site': 'crowdworks.jp'}]
        before = {k: sorted(os.listdir(v)) for k, v in paths.items()}
        servers = json.loads(Path(s.mcp_config(tasks)).read_text())['mcpServers']
        def udd(name):
            a = servers[name]['args']; return a[a.index('--user-data-dir') + 1]
        self.assertEqual(udd('playwright-coconala'), str(paths['coconala']))
        self.assertEqual(udd('playwright-booth'), str(paths['booth']))
        self.assertEqual(udd('playwright-note'), str(paths['note']))
        self.assertTrue(udd('playwright').endswith('browser-profiles/mac-local'))   # generic only for new sites
        # CrowdWorks gets its own new profile, created on first use; existing profiles untouched
        self.assertTrue(udd('playwright-crowdworks').endswith('browser-profiles/crowdworks-profile'))
        self.assertTrue(Path(udd('playwright-crowdworks')).is_dir())
        self.assertEqual(before, {k: sorted(os.listdir(v)) for k, v in paths.items()})
        self.assertEqual([r[0] for r in s.routing['h1-crowdworks-scan-1008']], ['playwright-crowdworks'])
        self.assertEqual([r[0] for r in s.routing['h3-marketplace-snapshot']], ['playwright-coconala', 'playwright-booth'])
        # headed is per task: a headed note task does not make the coconala server headed
        mixed = [{'id': 'n', 'requires': ['local_browser'], 'lane': 'note', 'browser': 'headed'},
                 {'id': 'c', 'requires': ['local_browser'], 'site': 'coconala.com'}]
        sv = json.loads(Path(s.mcp_config(mixed, headed=True)).read_text())['mcpServers']
        self.assertNotIn('--headless', sv['playwright-note']['args'])
        self.assertIn('--headless', sv['playwright-coconala']['args'])
        self.assertIn('ROUTING', ms.worker_prompt('mac-local', 'r', tasks, False, s.routing))
        # only the needed servers are configured
        servers = json.loads(Path(s.mcp_config(tasks[:1])).read_text())['mcpServers']
        self.assertEqual(list(servers), ['playwright-coconala'])

    def test_never_downgrades_a_profile(self):
        paths = self.make_profiles()
        (paths['booth'] / 'Last Version').write_text('150.0.1.1')   # written by a newer Chrome than installed
        s = self.sup()
        s.mcp_config([{'id': 'b', 'requires': ['local_browser'], 'site': 'booth.pm'}])
        self.assertEqual(s.routing['b'][0][0], 'unavailable')

    def test_profile_held_by_another_process_defers_only_that_task(self):
        paths = self.make_profiles()
        self.push_tasks(['h1-coconala-requests-scan', '--title', 's', '--lane', 'h1', '--requires', 'local_browser', '--site', 'coconala.com'])
        s = self.sup()
        orig = ms.profile_in_use
        ms.profile_in_use = lambda p: str(p) == str(paths['coconala'])
        try:
            s.loop_once()
        finally:
            ms.profile_in_use = orig
        self.assertIn('"profile_in_use"', self.log())
        self.assertNotIn('"worker_start"', self.log())
        run(['git', 'pull', '-q', 'origin', 'main'], self.founder)   # the wait is visible on main
        op = json.loads((self.founder / 'status/2026-10/operators/mac-local.json').read_text())
        self.assertEqual(op['blocked_on'], 'coconala profile in use')

    def test_no_tasks_means_no_worker_and_no_browser(self):
        self.push_tasks(['login', '--title', 'owner login', '--lane', 'local-browser', '--requires', 'human',
                         '--detail', 'open browser-profiles/mac-local and log in'])
        s = self.sup(worker='/bin/false')
        for _ in range(3):
            s.loop_once()
        self.assertNotIn('"worker_start"', self.log())

    def test_task_blocked_by_open_owner_login_is_not_eligible_until_done(self):
        self.push_tasks(['login', '--title', 'owner login', '--lane', 'local-browser', '--requires', 'human',
                         '--detail', 'open browser-profiles/mac-local and log in'],
                        ['scan', '--title', 'scan', '--lane', 'h1', '--requires', 'local_browser'])
        t = self.founder / 'status/2026-10/tasks/scan.json'
        d = json.loads(t.read_text()); d['blocked_by'] = ['login']; t.write_text(json.dumps(d))
        run(['git', 'commit', '-qam', 'b'], self.founder, env={**os.environ, 'GIT_AUTHOR_NAME': 'f', 'GIT_AUTHOR_EMAIL': 'f@f',
                                                               'GIT_COMMITTER_NAME': 'f', 'GIT_COMMITTER_EMAIL': 'f@f'})
        run(['git', 'push', '-q', 'origin', 'HEAD:main'], self.founder)
        s = self.sup()
        s.loop_once()
        self.assertEqual(ms.eligible_tasks(s.repo, 'mac-local', ['local_browser']), [])
        self.assertNotIn('"worker_start"', self.log())

    def test_untracked_playwright_artifacts_do_not_trigger_recovery_runs(self):
        s = self.sup(worker='/bin/false')
        s.loop_once()
        (s.repo / '.playwright-mcp').mkdir()
        (s.repo / '.playwright-mcp' / 'page.png').write_text('x')
        (s.repo / 'stray.txt').write_text('x')
        self.assertEqual(s.sync(), 'synced')
        s.loop_once()
        self.assertNotIn('"worker_start"', self.log())

    def test_browser_min_gap_and_owner_login_window_defer_browser_workers(self):
        self.push_tasks(['scan', '--title', 'scan', '--lane', 'h1', '--requires', 'local_browser'])
        s = self.sup()
        s.last_browser_start = ms.utcnow()          # a browser worker just ran
        s.loop_once()
        self.assertIn('"browser_deferred"', self.log())
        self.assertNotIn('"worker_start"', self.log())
        s.last_browser_start = None
        orig = ms.profile_in_use
        ms.profile_in_use = lambda p: True           # owner's login window holds the profile
        try:
            s.loop_once()
        finally:
            ms.profile_in_use = orig
        self.assertIn('owner_login_window', self.log())
        self.assertNotIn('"worker_start"', self.log())

    def test_hold_persists_across_restart(self):
        self.push_tasks(['scan', '--title', 'scan', '--lane', 'h1', '--requires', 'local_browser'])
        s = self.sup(worker='/bin/true', browser_min_gap_sec=0)
        s.loop_once()                                 # worker changes nothing -> hold
        self.assertIn('"noprogress"', self.log())
        s2 = self.sup(worker='/bin/true', browser_min_gap_sec=0)   # simulated launchd restart
        s2.loop_once()
        self.assertEqual(self.log().count('"worker_start"'), 1)
        self.assertIn('"noprogress_hold"', self.log())

    def test_owner_login_window_close_completes_owner_task_and_logs_minutes(self):
        self.push_tasks(['owner-login-mac-local-profile', '--title', 'owner login', '--lane', 'local-browser',
                         '--requires', 'human', '--detail', 'open browser-profiles/mac-local and log in'])
        s = self.sup()
        orig = ms.profile_in_use
        try:
            ms.profile_in_use = lambda p: str(p).endswith('browser-profiles/mac-local')
            s.loop_once()
            s.login_windows['mac-local'] = ms.iso(ms.utcnow() - ms.dt.timedelta(minutes=3))
            ms.profile_in_use = lambda p: False
            s.loop_once()
        finally:
            ms.profile_in_use = orig
        run(['git', 'pull', '-q', 'origin', 'main'], self.founder)
        t = json.loads((self.founder / 'status/2026-10/tasks/owner-login-mac-local-profile.json').read_text())
        self.assertEqual(t['status'], 'done')
        ev = (self.founder / 'status/2026-10/events/mac-local.jsonl').read_text()
        self.assertIn('"human_intervention"', ev)
        self.assertIn('"minutes":4', ev)


class ProfileInUse(unittest.TestCase):
    def test_lock_with_live_pid_means_in_use_and_mcp_args_do_not(self):
        d = Path(tempfile.mkdtemp())
        self.assertFalse(ms.profile_in_use(d))                         # nothing holds it
        os.symlink(f'host-{os.getpid()}', d / 'SingletonLock')
        self.assertTrue(ms.profile_in_use(d))                          # live Chrome lock
        (d / 'SingletonLock').unlink()
        os.symlink('host-999999', d / 'SingletonLock')                 # stale lock (dead pid)
        self.assertFalse(ms.profile_in_use(d))
        # an MCP server / node process that merely carries the path is NOT "in use"
        p = sp.Popen([sys.executable, '-c', 'import time; time.sleep(5)', f'--user-data-dir={d}'])
        try:
            self.assertFalse(ms.profile_in_use(d))
        finally:
            p.kill()


if __name__ == '__main__':
    unittest.main(verbosity=1)
