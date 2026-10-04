#!/usr/bin/env python3
"""Phase-2 Mac-local supervisor (task-driven). Stdlib only.

Loop (forever, under launchd KeepAlive=true):
  1. fetch + fast-forward a DEDICATED checkout of main
  2. read status/2026-10/tasks/*.json and find tasks eligible for this operator
  3. if eligible work exists and no worker is running -> start ONE Claude Code worker
     (claude -p) that follows ops/2026-10/BOOTSTRAP.md as this operator:
     heartbeat -> claim -> execute -> log -> done -> push
  4. after the worker: make sure its commits reached main (rebase + push), never force
  5. idle: push a liveness heartbeat via scripts/oct/ops.mjs at most every HB_IDLE_MIN
Failures back off exponentially (60 s .. 1 h, rate limits >= 15 min) and are reported in
the operator heartbeat (status=blocked, blocked_on=<reason>) so the cloud Founder sees them.
It NEVER exits on a business condition, so launchd never leaves it dead (the September
supervisor died because a 'safe stop' exited 0 under KeepAlive.SuccessfulExit=false).

Browser isolation: the worker gets its own Playwright MCP server whose profile lives in
  ~/Library/Application Support/AIRevenueExperiment/browser-profiles/<operator>/
and --strict-mcp-config, so existing Coconala/BOOTH session profiles are never shared.

Browser policy (2026-10-02, owner request — no stray Chrome for Testing windows):
- a worker gets a Playwright MCP server ONLY when one of its tasks has requires: local_browser;
  otherwise its MCP config is empty, so it cannot start a browser at all
- the browser is --headless unless a task declares "browser": "headed"
- never a browser just to check login/session state; a task blocked on a login is released
  with blocked_by=<owner task> and stays ineligible until that owner task is done
- the supervisor never starts a browser worker while the owner's login window holds the
  profile, and waits >= BROWSER_MIN_GAP between browser workers; no-progress holds are
  persisted across restarts
No secrets are read or logged; logs are metadata only (no model output on disk).
"""
import argparse
import datetime as dt
import fcntl
import json
import os
from pathlib import Path
import random
import signal
import subprocess as sp
import sys
import time

REMOTE = 'https://github.com/fever39risky-ux/ai-revenue-experiment.git'
BASE = Path.home() / 'Library/Application Support/AIRevenueExperiment'
P2 = 'status/2026-10'
DEFAULT_CAPS = ['local_browser']           # task.requires this operator can satisfy
PLAYWRIGHT_MCP = '@playwright/mcp@0.0.83'  # pinned
# Site-dedicated, owner-logged-in profiles under BASE/browser-profiles/ -> extra MCP server `playwright-<site>`.
# Dedicated, already-logged-in profiles per site (owner-confirmed 2026-10-02). Never merged,
# never re-created, never used for another site. Overrides (exact paths): state/profiles.json.
SITE_PROFILES = {
    'coconala': ['~/Library/Caches/ms-playwright-mcp/mcp-chrome-*'],   # profile used to publish 4426150
    'booth': ['~/Library/Caches/ms-playwright-mcp/booth-profile'],     # BOOTH listing session profile
    'note': ['~/Library/Application Support/AIRevenueExperiment/browser-profiles/note-profile'],
}
SITE_KEYWORDS = {'coconala': ('coconala',), 'booth': ('booth',), 'note': ('note.com', 'note-', '-note', 'note_')}
BROWSER_MIN_GAP_SEC = 600  # never relaunch a browser worker sooner than this  # note.com (owner logged in 2026-10-02)


def utcnow():
    return dt.datetime.now(dt.timezone.utc)


def iso(t=None):
    return (t or utcnow()).isoformat().replace('+00:00', 'Z')


def parse(ts):
    if not ts:
        return None
    try:
        return dt.datetime.fromisoformat(str(ts).replace('Z', '+00:00'))
    except ValueError:
        return None


def read_json(p, default=None):
    try:
        return json.loads(Path(p).read_text())
    except (OSError, ValueError):
        return default


# ---------------------------------------------------------------- task selection
def eligible_tasks(repo, op, caps, now=None):
    """Tasks this operator should work on now, best first.

    A task is eligible when it is not done, not gated by not_before, its `after`
    dependencies are done, it is not leased live by someone else, and either it is
    explicitly assigned to `op` or all of its `requires` are capabilities of `op`
    (tasks needing 'human' are never auto-started)."""
    now = now or utcnow()
    tdir = Path(repo) / P2 / 'tasks'
    tasks = {}
    for f in sorted(tdir.glob('*.json')) if tdir.exists() else []:
        t = read_json(f)
        if isinstance(t, dict) and t.get('id'):
            tasks[t['id']] = t
    out = []
    for t in tasks.values():
        if t.get('status') == 'done':
            continue
        req = list(t.get('requires') or [])
        assigned = t.get('assigned_to')
        if 'human' in req:
            continue
        mine = assigned == op or (not assigned and req and all(r in caps for r in req))
        if not mine:
            continue
        nb = parse(t.get('not_before'))
        if nb and nb > now:
            continue
        if any(tasks.get(d, {}).get('status') != 'done' for d in (t.get('after') or [])):
            continue
        # waiting on an owner step (e.g. a login): ineligible until that task is done
        if any(tasks.get(d, {}).get('status') not in (None, 'done') for d in (t.get('blocked_by') or [])):
            continue
        lease = parse(t.get('lease_until'))
        holder = t.get('claimed_by')
        if holder and holder != op and lease and lease > now:
            continue
        out.append(t)
    out.sort(key=lambda t: (0 if t.get('claimed_by') == op else 1, 0 if t.get('assigned_to') == op else 1,
                           t.get('priority', 9), t.get('created_at', '')))
    return out


def work_signature(repo, tasks):
    """What the worker could act on: eligible (id, status) + open human tasks. Unchanged after a
    run = no progress (e.g. every task waits on an owner login) -> hold instead of respawning."""
    tdir = Path(repo) / P2 / 'tasks'
    human = sorted(t.get('id') for t in (read_json(f, {}) for f in tdir.glob('*.json'))
                   if isinstance(t, dict) and 'human' in (t.get('requires') or []) and t.get('status') != 'done') \
        if tdir.exists() else []
    return json.dumps([sorted((t['id'], t.get('status')) for t in tasks), human])


def task_sites(t):
    """Target profile keys for a task: explicit `profile` (str or list), else site/lane/id keywords,
    else ['generic'] (the mac-local profile: new sites / generic browsing only)."""
    prof = t.get('profile')
    if prof:
        return [prof] if isinstance(prof, str) else list(prof)
    hay = ' '.join(str(t.get(k) or '') for k in ('site', 'lane', 'id')).lower()
    found = [site for site, words in SITE_KEYWORDS.items()
             if (t.get('lane') or '').lower() == site or any(w in hay for w in words)]
    return found or ['generic']


def task_site(t):
    return task_sites(t)[0]


def _major(v):
    try:
        return int(str(v).strip().split('.')[0])
    except ValueError:
        return None


def _app_version(plist_path):
    import plistlib
    try:
        return plistlib.loads(Path(plist_path).read_bytes()).get('CFBundleShortVersionString')
    except (OSError, ValueError):
        return None


def browser_for_profile(profile):
    """Pick the browser that will not damage the profile: same major version as the Chrome
    that last wrote it (profile/'Last Version'); never an older one (downgrade)."""
    last = _major((Path(profile) / 'Last Version').read_text() if (Path(profile) / 'Last Version').exists() else '')
    chrome = _major(_app_version('/Applications/Google Chrome.app/Contents/Info.plist'))
    cft = None
    for pl in sorted(Path.home().glob('Library/Caches/ms-playwright/chromium-*/chrome-mac*/*.app/Contents/Info.plist')):
        cft = _major(_app_version(pl)) or cft
    if last is None:
        return 'chrome' if 'mcp-chrome' in str(profile) and chrome else 'chromium'
    for name, ver in (('chrome', chrome), ('chromium', cft)):
        if ver == last:
            return name
    for name, ver in (('chrome', chrome), ('chromium', cft)):
        if ver and ver > last:
            return name
    return None  # only older browsers available -> refuse (would downgrade the profile)


def needs_browser(tasks):
    return any('local_browser' in (t.get('requires') or []) for t in tasks)


def route_text(routing):
    if not routing:
        return ''
    lines = '\n'.join(f'  - {tid}: ' + '; '.join(
        (f'`{srv}` ({where})' if srv != 'unavailable' else f'UNAVAILABLE ({where}) -> do that part only if possible, else release with this reason')
        for srv, where in routes) for tid, routes in routing.items())
    return f'ROUTING (task -> browser server / dedicated profile):\n{lines}\n'


def needs_headed(tasks):
    return any(t.get('browser') == 'headed' for t in tasks)


def profile_in_use(profile_dir):
    """True only if a real browser holds the profile right now: Chrome's own SingletonLock
    (symlink '<host>-<pid>') points to a live pid, or a Chrome/Chromium executable (not an
    MCP server or node process that merely carries the path as an argument) has it open."""
    lock = Path(profile_dir) / 'SingletonLock'
    try:
        target = os.readlink(lock)
        pid = int(target.rsplit('-', 1)[-1])
        os.kill(pid, 0)
        return True
    except (OSError, ValueError):
        pass
    try:
        out = sp.run(['/bin/ps', '-axo', 'command'], capture_output=True, text=True, timeout=10).stdout
    except (OSError, sp.TimeoutExpired):
        return False
    for line in out.splitlines():
        exe = line.split(' --', 1)[0]
        if not any(k in exe for k in ('Chrome', 'Chromium', 'chrome')) or any(k in exe for k in ('node', 'npx', 'npm')):
            continue
        if 'Helper' in exe:
            continue
        if f'--user-data-dir={profile_dir}' in line or f'--user-data-dir {profile_dir}' in line:
            return True
    return False


def chrome_for_testing_count():
    try:
        out = sp.run(['/bin/ps', '-axo', 'comm'], capture_output=True, text=True, timeout=10).stdout
    except (OSError, sp.TimeoutExpired):
        return -1
    return sum('Google Chrome for Testing' in l and 'Helper' not in l for l in out.splitlines())


def grant_text(tasks):
    """Owner standing grants relevant to these tasks (ops/2026-10/PERMISSIONS.md), quoted so the
    run has the explicit owner authorization in front of it."""
    if not any('coconala' in task_sites(t) for t in tasks):
        return ''
    return ('OWNER STANDING PERMISSION PG-1 (granted by the owner 2026-10-04, ops/2026-10/PERMISSIONS.md): '
            'on the owner\'s Coconala account you may apply to public requests, write proposals, state price and '
            'delivery date, and handle pre-order messages and quote replies WITHOUT asking the owner, only when all '
            'hold: deliverable with current capabilities/assets; profitable after fees; delivery risk not excessive; '
            'no false track record; Coconala terms respected; no external contact details; no spending, purchases, '
            'legal consents or identity verification. Record the condition check per proposal (--grant PG-1). If a '
            'condition fails, do not send.')


def worker_prompt(op, role, tasks, recovery, routing=None):
    ids = ', '.join(t['id'] for t in tasks)
    rec = ('\nRECOVERY FIRST: the checkout has uncommitted or unpushed work from a previous run. '
           'Inspect `git status`/`git log origin/main..HEAD`, keep legitimate work of this operator, '
           'commit it, `git pull --rebase`, push. Never reset/stash/force-push.\n') if recovery else ''
    return f"""You are Phase-2 operator `{op}` of fever39risky-ux/ai-revenue-experiment, started automatically by the Mac supervisor (scripts/oct/mac_supervisor.py) because GitHub main has work for you.
Role: {role}
Eligible tasks right now (best first): {ids}
Work ONLY on these task ids (plus recovery if requested). {'A headless browser is available for them.' if needs_browser(tasks) else 'NO browser is available in this run (none of these tasks needs one) — do not try to open one.'}
{rec}{route_text(routing)}
Do this, in order:
1. Read CLAUDE.md and ops/2026-10/BOOTSTRAP.md and follow them as operator `{op}` (NOT founder).
2. `node scripts/oct/ops.mjs heartbeat {op} --status working --doing "<task>" --next "<next>"`.
3. For each task: `node scripts/oct/ops.mjs claim {op} <task-id> --hours 2` BEFORE working (if the claim is rejected, skip it), execute it to its acceptance criteria, log results (`signal`, `human`, `revenue`, `cost` per ops/2026-10/KPI.md), then `done {op} <task-id> --result "<evidence>"` or `release {op} <task-id> --reason "<why>"`.
4. Profiles: each task's browser server is listed under ROUTING — use exactly that server for that task (its dedicated, already logged-in profile) and no other. The servers are headless; never ask for a visible window. A task marked unavailable must be released with that reason. Browser rules: open a page ONLY to perform a step of a claimed task — never just to check login/session state, never to "re-check" a site. If a page shows you are logged out: do not retry; `node scripts/oct/ops.mjs release {op} <task-id> --reason "<site> logged out" --blocked-by <owner-task-id>` (reuse the open `requires: human` login task for THAT site if one exists; otherwise create one for that single site only, with `--requires human --site <site> --profile <site>` and the exact profile path from ROUTING — never a combined multi-site request, never a request for a site whose task did not run), then continue with other tasks. Browser work: use ONLY the `playwright` MCP server provided to this session (its profile is dedicated to `{op}`). Never open or reuse any profile not listed under ROUTING. Heartbeat `--status blocked --blocked-on "<site> login"` only when every listed task is blocked.
5. Goal-continuous: after each task, continue with the next eligible task (Constitution Art. 8). End only on E1-E4.
6. Before ending: heartbeat with the exact next action; commit ONLY your files (status/2026-10/operators/{op}.json, status/2026-10/events/{op}.jsonl, tasks you touched, files your task produced); run `node scripts/leak_check.mjs && node scripts/promotion_check.mjs`; `git pull --rebase origin main`; `git push origin HEAD:main` (retry up to 4x). Never force-push.
No cold DMs/emails; no posting outside the task's scope; no secrets or buyer PII in the repo.
{grant_text(tasks)}
"""


# ---------------------------------------------------------------- supervisor
class Supervisor:
    def __init__(self, a):
        self.a = a
        self.op = a.operator
        self.repo = Path(a.repo).resolve()
        self.state_dir = Path(a.state_dir).resolve()
        self.state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.log_path = self.state_dir / 'supervisor.log'
        self.failures = 0
        self.last_idle_hb = None
        self.child = None
        self.shutdown = False
        self.caps = a.caps.split(',') if a.caps else DEFAULT_CAPS
        self.started_mtime = Path(__file__).stat().st_mtime
        self.hold_path = self.state_dir / 'hold.json'
        h = read_json(self.hold_path, {}) or {}
        self.np_sig, self.np_count = h.get('sig'), h.get('count', 0)   # no-progress hold (persisted)
        self.np_until = parse(h.get('until'))
        self.last_browser_start = parse(h.get('last_browser_start'))
        self.login_windows = h.get('login_windows') or {}  # profile -> ISO time the owner window opened
        self.stats = dict(polls=0, workers=0, browser_workers=0, since=iso())
        self.deferral_reported = {}
        self.settled_hb_done = False  # one extra idle heartbeat settle_hb_min after start (verification evidence)

    # metadata-only log (enums/numbers/ids; never model output)
    def log(self, event, **f):
        if self.log_path.exists() and self.log_path.stat().st_size > 2_000_000:
            self.log_path.replace(self.state_dir / 'supervisor.previous.log')
        with self.log_path.open('a') as fh:
            fh.write(json.dumps(dict(time=iso(), event=event, **f)) + '\n')
        if self.a.verbose:
            print(event, f, flush=True)

    def git(self, *args, timeout=120):
        try:
            p = sp.run(['git', *args], cwd=self.repo, stdout=sp.PIPE, stderr=sp.DEVNULL, timeout=timeout,
                       env={**os.environ, 'GIT_TERMINAL_PROMPT': '0'})
            return p.returncode, p.stdout.decode(errors='replace').strip()
        except (sp.TimeoutExpired, OSError):
            return 124, ''

    def ensure_checkout(self):
        if (self.repo / '.git').exists():
            return True
        self.repo.parent.mkdir(parents=True, exist_ok=True)
        rc = sp.run(['git', 'clone', '-q', self.a.remote, str(self.repo)], stdout=sp.DEVNULL, stderr=sp.DEVNULL).returncode
        self.log('clone', rc=rc)
        return rc == 0

    def sync(self):
        """-> 'synced' | 'recovery' (dirty/diverged; left untouched for the worker) | 'fetch_failed'"""
        if self.git('fetch', '-q', 'origin', 'main')[0]:
            return 'fetch_failed'
        rc, branch = self.git('branch', '--show-current')
        if branch != 'main':
            if self.git('status', '--porcelain', '--untracked-files=no')[1]:
                return 'recovery'
            self.git('checkout', '-q', 'main')
        if self.git('status', '--porcelain', '--untracked-files=no')[1]:
            return 'recovery'
        if self.git('merge', '-q', '--ff-only', 'origin/main')[0]:
            return 'recovery'  # local commits not on main: worker reconciles
        return 'synced'

    def save_hold(self):
        self.hold_path.write_text(json.dumps(dict(sig=self.np_sig, count=self.np_count,
            until=iso(self.np_until) if self.np_until else None,
            last_browser_start=iso(self.last_browser_start) if self.last_browser_start else None,
            login_windows=self.login_windows)))

    def site_profile(self, site):
        """-> (path, None) or (None, reason). state/profiles.json may pin exact paths."""
        override = (read_json(self.state_dir / 'profiles.json', {}) or {}).get(site)
        if site == 'generic':
            return self.profile_dir(), None
        if override:
            p = Path(os.path.expanduser(override))
            return (p, None) if p.is_dir() else (None, f'{site} profile {override} missing')
        matches = []
        for pat in SITE_PROFILES.get(site, []):
            pat = os.path.expanduser(pat)
            matches += [Path(m) for m in sorted(Path('/').glob(pat.lstrip('/')))] if '*' in pat else ([Path(pat)] if Path(pat).is_dir() else [])
        matches = [m for m in matches if m.is_dir()]
        if len(matches) == 1:
            return matches[0], None
        if not matches:
            return None, f'no dedicated {site} profile found'
        return None, f'{len(matches)} candidate {site} profiles; pin one in state/profiles.json'

    def report_deferral(self, task_id, sites):
        """Make a profile-in-use wait visible on main (heartbeat), at most every 30 min per site set."""
        key = ','.join(sorted(sites))
        last = parse(self.deferral_reported.get(key))
        if last and utcnow() - last < dt.timedelta(minutes=30):
            return
        self.deferral_reported[key] = iso()
        self.heartbeat('working', f'waiting: dedicated {key} profile is open in another process (e.g. a Coconala/BOOTH '
                       f'session or the owner\'s window); {task_id} starts automatically when it is closed',
                       f'retry every {self.a.poll_sec}s', blocked_on=f'{key} profile in use', msg='profile wait')

    def profile_dir(self):
        return BASE / 'browser-profiles' / self.op

    def profiles(self):
        """name -> path of every dedicated profile this operator may use."""
        out = {self.op: self.profile_dir()}
        for site in SITE_PROFILES:
            path, _ = self.site_profile(site)
            if path:
                out[site] = path
        return out

    def watch_owner_login(self):
        """Detect the owner's login window on any dedicated profile. When it closes, mark the open
        owner tasks that reference that profile (browser-profiles/<name>) done and log the measured
        human minutes. Returns True while any dedicated profile is held by such a window."""
        any_open = False
        for name, path in self.profiles().items():
            in_use = profile_in_use(path)
            since = parse(self.login_windows.get(name))
            if in_use:
                any_open = True
                if not since:
                    self.login_windows[name] = iso(); self.save_hold(); self.log('owner_login_window_open', profile=name)
                continue
            if not since:
                continue
            minutes = max(1, int((utcnow() - since).total_seconds() // 60) + 1)
            closed = []
            for f in sorted((self.repo / P2 / 'tasks').glob('*.json')):
                t = read_json(f, {})
                if 'human' in (t.get('requires') or []) and t.get('status') != 'done' and \
                        (str(path) in os.path.expanduser(t.get('detail') or '') or
                         f'browser-profiles/{name}' in (t.get('detail') or '') or task_site(t) == name):
                    self.ops('done', self.op, t['id'], '--result',
                             f'owner login window on the {name} profile used and closed ({minutes} min); '
                             'the login is verified by the next real task, not by a separate check')
                    closed.append(t['id']); self.git('add', str(f.relative_to(self.repo)))
            if closed:
                self.ops('human', self.op, '--minutes', str(minutes), '--category', 'login', '--lane', 'local-browser',
                         '--reason', f'owner logged in via the dedicated {name} browser profile (window open {minutes} min; {",".join(closed)})')
            self.log('owner_login_window_closed', profile=name, minutes=minutes, closed=len(closed))
            del self.login_windows[name]; self.save_hold()
            if closed:
                self.push_own_files(f'ops({self.op}): owner login window closed ({name}) -> {",".join(closed)} done')
        return any_open

    def ops(self, *args):
        return sp.run(['node', 'scripts/oct/ops.mjs', *args], cwd=self.repo, stdout=sp.DEVNULL, stderr=sp.DEVNULL).returncode

    def push_own_files(self, message):
        """Commit only this operator's registry/events files and push (rebase, never force)."""
        files = [f'{P2}/operators/{self.op}.json', f'{P2}/events/{self.op}.jsonl']
        files = [f for f in files if (self.repo / f).exists()]
        self.git('add', *files)
        if self.git('diff', '--cached', '--quiet')[0] == 0:
            return True
        self.git('-c', 'user.name=mac-local-supervisor', '-c', 'user.email=mac-local@users.noreply.github.com',
                 'commit', '-q', '-m', message)
        return self.push()

    def push(self):
        for i in range(4):
            self.git('pull', '-q', '--rebase', 'origin', 'main')
            if self.git('push', '-q', 'origin', 'HEAD:main')[0] == 0:
                return True
            self.wait(2 ** (i + 1))
        self.log('push_failed')
        return False

    def heartbeat(self, status, doing, next_, blocked_on=None, msg='heartbeat'):
        args = ['heartbeat', self.op, '--status', status, '--doing', doing, '--next', next_,
                '--kind', 'local-mac', '--runtime', "owner's Mac — launchd supervisor scripts/oct/mac_supervisor.py",
                '--capabilities', ','.join(self.caps + ['git', 'node', 'claude-cli', 'playwright-mcp-dedicated-profile'])]
        if blocked_on:
            args += ['--blocked-on', blocked_on]
        self.ops(*args)
        self.push_own_files(f'ops({self.op}): supervisor {msg} ({status})')

    def wait(self, seconds):
        end = time.monotonic() + seconds
        while not self.shutdown and time.monotonic() < end:
            time.sleep(min(1, max(0, end - time.monotonic())))

    def backoff(self, kind):
        self.failures += 1
        floor = 900 if kind == 'rate_limit' else 60
        seconds = min(3600, floor * 2 ** min(self.failures - 1, 6)) + random.randint(0, 30)
        self.log('backoff', kind=kind, seconds=seconds, failures=self.failures)
        if self.failures in (1, 3, 6) or kind in ('authentication', 'checkout'):
            self.heartbeat('blocked', f'supervisor backoff after {kind} (failure {self.failures})',
                           f'retry at {iso(utcnow() + dt.timedelta(seconds=seconds))}', blocked_on=kind, msg='backoff')
        self.wait(seconds if not self.a.once else 0)

    def mcp_config(self, tasks=(), headed=False):
        """One Playwright server per site the tasks need, each on that site's dedicated profile.
        No browser task -> empty config (no browser possible). Headless unless a task asks."""
        cfg = {'mcpServers': {}}
        self.routing = {}
        mode = [] if headed else ['--headless']
        out_dir = self.state_dir / 'playwright-output'  # artifacts outside the git checkout
        for t in tasks:
            if 'local_browser' not in (t.get('requires') or []):
                continue
            routes = []
            tmode = [] if (headed and t.get('browser') == 'headed') else ['--headless']  # per task
            for site in task_sites(t):
                path, why = self.site_profile(site)
                if site == 'generic':
                    path.mkdir(parents=True, exist_ok=True, mode=0o700)
                browser = browser_for_profile(path) if path else None
                if not path or not browser:
                    routes.append(('unavailable', f'{site}: ' + (why or 'no non-downgrading browser for this profile')))
                    continue
                server = 'playwright' if site == 'generic' else f'playwright-{site}'
                cfg['mcpServers'].setdefault(server, {'command': 'npx', 'args': [
                    '-y', PLAYWRIGHT_MCP, '--browser', browser, *tmode, '--output-dir', str(out_dir),
                    '--user-data-dir', str(path)]})
                routes.append((server, f'{site}: {path}'))
            self.routing[t['id']] = routes
        p = self.state_dir / 'mcp.json'
        p.write_text(json.dumps(cfg, indent=2))
        os.chmod(p, 0o600)
        return p

    def run_worker(self, tasks, recovery):
        browser = needs_browser(tasks)
        headed = browser and needs_headed(tasks)
        self.routing = {}
        if browser:
            self.mcp_config(tasks, headed)
        prompt = worker_prompt(self.op, self.a.role, tasks, recovery, self.routing)
        if self.a.worker_cmd:  # tests
            cmd = self.a.worker_cmd.split()
        else:
            cmd = [self.a.claude, '-p', '--output-format', 'json', '--permission-mode', 'auto',
                   '--no-session-persistence', '--mcp-config', str(self.mcp_config(tasks if browser else (), headed)), '--strict-mcp-config']
        env = {**os.environ, 'GIT_TERMINAL_PROMPT': '0', 'PHASE2_OPERATOR': self.op,
               'PHASE2_BROWSER': 'headed' if headed else ('headless' if browser else 'none')}
        self.log('worker_start', tasks=[t['id'] for t in tasks], recovery=recovery,
                 browser='headed' if headed else ('headless' if browser else 'none'))
        self.stats['workers'] += 1
        if browser:
            self.stats['browser_workers'] += 1
            self.last_browser_start = utcnow(); self.save_hold()
        started = time.monotonic()
        try:
            self.child = sp.Popen(cmd, cwd=self.repo, stdin=sp.PIPE, stdout=sp.PIPE, stderr=sp.STDOUT,
                                  start_new_session=True, env=env)
        except OSError:
            self.log('worker_spawn_failed')
            return 'spawn_failed'
        try:
            out, _ = self.child.communicate(prompt.encode(), timeout=self.a.worker_timeout_min * 60)
        except sp.TimeoutExpired:
            os.killpg(self.child.pid, signal.SIGTERM)
            try:
                out, _ = self.child.communicate(timeout=20)
            except sp.TimeoutExpired:
                os.killpg(self.child.pid, signal.SIGKILL)
                out, _ = self.child.communicate()
            self.log('worker_timeout', minutes=self.a.worker_timeout_min)
            return 'timeout'
        rc = self.child.returncode
        self.child = None
        text = (out or b'')[-20000:].lower()  # classify only; never stored
        kind = 'none'
        for pat, k in [(b'not logged in', 'authentication'), (b'authentication_error', 'authentication'),
                       (b'please run /login', 'authentication'), (b'rate_limit', 'rate_limit'),
                       (b'usage limit', 'rate_limit'), (b'overloaded', 'network'), (b'connection error', 'network')]:
            if pat in text:
                kind = k
                break
        if rc != 0 and kind == 'none':
            kind = 'process_failure'
        self.log('worker_end', rc=rc, kind=kind, seconds=int(time.monotonic() - started), out_bytes=len(out or b''))
        return kind

    def loop_once(self):
        if not self.ensure_checkout():
            return self.backoff('checkout')
        s = self.sync()
        if s == 'fetch_failed':
            return self.backoff('git_network')
        me = self.repo / 'scripts/oct/mac_supervisor.py'
        if self.a.self_update and me.exists() and Path(__file__).resolve() == me.resolve() \
                and me.stat().st_mtime > self.started_mtime:
            self.log('code_updated_restart')
            self.shutdown = True  # exit; launchd KeepAlive restarts with the new code
            return
        self.stats['polls'] += 1
        self.deferred_this_poll = False
        login_window = self.watch_owner_login()
        tasks = eligible_tasks(self.repo, self.op, self.caps)
        recovery = s == 'recovery'
        self.log('poll', sync=s, eligible=len(tasks))
        sig = work_signature(self.repo, tasks)
        if tasks and sig == self.np_sig and self.np_until and utcnow() < self.np_until:
            self.log('noprogress_hold', eligible=len(tasks), until=iso(self.np_until), count=self.np_count)
            tasks = []  # held: no worker for this unchanged set (recovery alone may still run, browserless)
        if needs_browser(tasks):
            gap_ok = not self.last_browser_start or \
                (utcnow() - self.last_browser_start).total_seconds() >= self.a.browser_min_gap_sec
            if not gap_ok:
                self.log('browser_deferred', reason='min_gap')
                self.deferred_this_poll = True
                tasks = [t for t in tasks if 'local_browser' not in (t.get('requires') or [])]
            else:  # skip only tasks whose dedicated profile is held by another process right now
                keep = []
                for t in tasks:
                    if 'local_browser' in (t.get('requires') or []):
                        held = [site for site in task_sites(t)
                                if (lambda p: p is not None and profile_in_use(p))(self.site_profile(site)[0])]
                        if held:
                            self.log('browser_deferred', reason='profile_in_use', sites=held)
                            self.report_deferral(t['id'], held)
                            self.deferred_this_poll = True
                            continue
                    keep.append(t)
                tasks = keep
        if tasks or recovery:
            kind = self.run_worker(tasks, recovery)
            # make sure whatever the worker committed reaches main
            ahead = self.git('rev-list', '--count', 'origin/main..HEAD')[1]
            if ahead not in ('', '0') and not self.git('status', '--porcelain', '--untracked-files=no')[1]:
                self.push()
            if kind != 'none':
                return self.backoff(kind)
            self.failures = 0
            self.last_idle_hb = utcnow()  # the worker heartbeated itself
            after = work_signature(self.repo, eligible_tasks(self.repo, self.op, self.caps))
            if tasks and after == sig:  # nothing moved: hold this task set, 5 -> 60 min (persisted)
                self.np_count = self.np_count + 1 if self.np_sig == sig else 1
                self.np_sig = sig
                hold = min(3600, 300 * 2 ** (self.np_count - 1))
                self.np_until = utcnow() + dt.timedelta(seconds=hold)
                self.log('noprogress', count=self.np_count, hold_seconds=hold)
            else:
                self.np_sig, self.np_count, self.np_until = None, 0, None
            self.save_hold()
            return self.wait(self.a.after_work_sec)
        self.failures = 0
        settle_due = not self.settled_hb_done and \
            utcnow() - parse(self.stats['since']) >= dt.timedelta(minutes=self.a.settle_hb_min)
        if settle_due:
            self.settled_hb_done = True
        if self.deferred_this_poll:
            return self.wait(self.a.poll_sec)  # a deferral heartbeat (not "idle") is the current truth
        if settle_due or not self.last_idle_hb or utcnow() - self.last_idle_hb > dt.timedelta(minutes=self.a.hb_idle_min):
            st = self.stats
            self.ops('heartbeat', self.op, '--progress',
                     f"since {st['since']}: polls={st['polls']} workers={st['workers']} browser_workers={st['browser_workers']} "
                     f"chrome_for_testing_procs={chrome_for_testing_count()}")
            self.heartbeat('idle', 'supervisor alive; no eligible mac-local task on main',
                           f'polling main every {self.a.poll_sec}s; starts a Claude worker when a task appears', msg='idle')
            self.last_idle_hb = utcnow()
        self.wait(self.a.poll_sec)

    def run(self):
        lock = (self.state_dir / 'supervisor.lock').open('a+')
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.log('duplicate_rejected')
            return 75  # launchd restarts; the live instance keeps the lock
        signal.signal(signal.SIGTERM, self._term)
        signal.signal(signal.SIGINT, self._term)
        caff = None
        if sys.platform == 'darwin' and not self.a.once:
            caff = sp.Popen(['/usr/bin/caffeinate', '-i', '-s', '-w', str(os.getpid())], stdout=sp.DEVNULL, stderr=sp.DEVNULL)
        self.log('start', pid=os.getpid(), operator=self.op)
        try:
            while not self.shutdown:
                try:
                    self.loop_once()
                except Exception as e:  # never die on an unexpected error: back off and retry
                    self.log('loop_error', kind=type(e).__name__)
                    self.backoff('internal')
                if self.a.once:
                    break
        finally:
            if caff:
                caff.terminate()
            self.log('stop')
        return 0

    def _term(self, *_):
        self.shutdown = True
        if self.child and self.child.poll() is None:
            try:
                os.killpg(self.child.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass


def main():
    os.umask(0o077)
    p = argparse.ArgumentParser()
    p.add_argument('--operator', default='mac-local')
    p.add_argument('--role', default='local browser operator + marketplace inboxes (coconala, booth, note)')
    p.add_argument('--caps', default='local_browser')
    p.add_argument('--repo', default=str(BASE / 'operators/mac-local/repo'))
    p.add_argument('--state-dir', default=str(BASE / 'operators/mac-local/state'))
    p.add_argument('--remote', default=REMOTE)
    p.add_argument('--claude', default=os.environ.get('CLAUDE_BIN') or str(Path.home() / '.npm-global/bin/claude'))
    p.add_argument('--worker-cmd', help='test only: command used instead of claude')
    p.add_argument('--poll-sec', type=int, default=120)
    p.add_argument('--after-work-sec', type=int, default=60)
    p.add_argument('--hb-idle-min', type=int, default=120)
    p.add_argument('--worker-timeout-min', type=int, default=120)
    p.add_argument('--settle-hb-min', type=int, default=6)
    p.add_argument('--browser-min-gap-sec', type=int, default=BROWSER_MIN_GAP_SEC)
    p.add_argument('--once', action='store_true')
    p.add_argument('--self-update', action='store_true', help='exit (for launchd restart) when this script changes on main')
    p.add_argument('--list', action='store_true', help='print eligible tasks for the checkout and exit')
    p.add_argument('--verbose', action='store_true')
    a = p.parse_args()
    if a.list:
        for t in eligible_tasks(Path(a.repo), a.operator, a.caps.split(',')):
            print(t['id'])
        return 0
    return Supervisor(a).run()


if __name__ == '__main__':
    sys.exit(main())
