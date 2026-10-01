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
                                  self_update=False, verbose=False)
        os.environ['HOME'] = str(tmp / 'home')
        sup = ms.Supervisor(a)
        sup.loop_once()                      # runs the worker; it only releases -> no progress
        sup.loop_once()                      # same task set -> held, no second worker
        log = (tmp / 'mac/state/supervisor.log').read_text()
        self.assertEqual(log.count('"worker_start"'), 1)
        self.assertIn('"noprogress"', log)
        self.assertIn('"noprogress_hold"', log)
        shutil.rmtree(tmp)


if __name__ == '__main__':
    unittest.main(verbosity=1)
