#!/usr/bin/env python3
"""macOS local supervisor. No third-party packages; no raw process output on disk."""
import argparse
import datetime as dt
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import random
import signal
import subprocess as sp
import sys
import threading
import time

REMOTE = 'https://github.com/fever39risky-ux/ai-revenue-experiment.git'
CLAUDE = str(Path.home() / '.npm-global/bin/claude')
STOP_REASONS = {'goal_achieved', 'human_only', 'safety', 'legal', 'permission', 'system'}

def now():
    return dt.datetime.now(dt.timezone.utc).isoformat()

def read(path):
    return json.loads(Path(path).read_text())

def atomic(path, obj):
    path = Path(path)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')
    os.chmod(tmp, 0o600)
    tmp.replace(path)

def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:16]

def numeric(v):
    return type(v) in (int, float) and math.isfinite(v)

def validate(repo):
    s = read(repo / 'status/AUTONOMY_STATE.json')
    l = read(repo / 'status/revenue_ledger.json')
    for k in ('goal_achieved', 'human_blocked', 'ai_operable_work_remaining'):
        if type(s[k]) is not bool:
            raise ValueError('invalid_state')
    if not numeric(s['goal_revenue_jpy']) or s['goal_revenue_jpy'] <= 0:
        raise ValueError('invalid_goal')
    if s['stop_reason'] is not None and s['stop_reason'] not in STOP_REASONS:
        raise ValueError('invalid_stop_reason')
    if not isinstance(s['next_action'], (str, dict, type(None))):
        raise ValueError('invalid_action')
    if type(s['consecutive_failures']) is not int or s['consecutive_failures'] < 0:
        raise ValueError('invalid_failures')
    if not isinstance(l['official_entries'], list):
        raise ValueError('invalid_ledger')
    for e in l['official_entries']:
        if not isinstance(e, dict) or not numeric(e.get('jpy_equivalent')) or type(e.get('verified')) is not bool:
            raise ValueError('invalid_entry')
    total = l['totals']['official_revenue_jpy_equivalent']
    if not numeric(total):
        raise ValueError('invalid_total')
    # Existing schema lacks a third-party/test flag. Require explicit evidence on
    # counted entries, rather than accepting test purchases or an AI-set boolean.
    verified = sum(e['jpy_equivalent'] for e in l['official_entries']
                   if e['verified'] and e.get('third_party') is True
                   and e.get('is_test') is False and e.get('reference')
                   and e.get('period') == 'official')
    if s['stop_reason'] in {'safety', 'legal', 'permission', 'system'}:
        return s, 'hard_stop'
    if s['goal_achieved']:
        if verified >= s['goal_revenue_jpy'] and total >= s['goal_revenue_jpy']:
            return s, 'goal_achieved'
        return s, 'goal_evidence_missing'
    if s['human_blocked'] and not s['ai_operable_work_remaining']:
        evidence = s.get('human_blocker_evidence')
        if not isinstance(evidence, dict) or not evidence.get('step') or len(evidence.get('alternatives', [])) < 3:
            return s, 'human_evidence_missing'
        return s, 'human_only'
    return s, 'continue'

class Runner:
    def __init__(self, repo, test=False):
        self.repo = Path(repo).resolve()
        self.test = test
        self.local = self.repo / '.autonomy'
        self.logs = self.repo / 'logs'
        for p in (self.local, self.logs, self.logs / 'claude-runs'):
            p.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.lock = None
        self.child = None
        self.shutdown = False
        self.failures = 0
        self.runs = 0
        self.unchanged_runs = 0
        self.last_progress = None
        self.cfg = read(self.local/'test.json') if test else {}
        if test and not (self.repo/'.autonomy-test-repo').exists():
            raise ValueError('test_requires_isolated_fixture')

    def log(self, event, **fields):
        # All callers use code-owned enums/numbers/hashes. Never arbitrary text.
        row = dict(time=now(), event=event, **fields)
        p = self.logs/'supervisor.log'
        if p.exists() and p.stat().st_size > 2_000_000:
            p.replace(self.logs/'supervisor.previous.log')
        with p.open('a') as f:
            f.write(json.dumps(row) + '\n')

    def acquire(self):
        self.lock = (self.local/'supervisor.lock').open('a+')
        try:
            fcntl.flock(self.lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            self.log('duplicate_rejected')
            return False
        atomic(self.local/'runtime.json', dict(pid=os.getpid(), started=now(), runs=0, phase='starting'))
        return True

    def git(self, *args):
        try:
            p = sp.run(['/usr/bin/git', *args], cwd=self.repo, stdout=sp.PIPE,
                       stderr=sp.DEVNULL, timeout=90, env={**os.environ, 'GIT_TERMINAL_PROMPT':'0'})
            return p.returncode, p.stdout.decode(errors='replace').strip()
        except sp.TimeoutExpired:
            return 124, ''

    def sync(self):
        if self.test:
            return self.cfg.get('sync', 'synced')
        rc, remote = self.git('remote', 'get-url', 'origin')
        if rc or remote != REMOTE:
            return 'remote_invalid'
        if self.git('fetch', 'origin', 'main')[0]:
            return 'fetch_failed'
        rc, branch = self.git('branch', '--show-current')
        if rc or branch != 'main':
            return 'branch_invalid'
        rc, dirty = self.git('status', '--porcelain')
        if rc:
            return 'fetch_failed'
        if dirty:
            return 'recovery_required'
        # Don't reset, stash, or overwrite operator commits. Claude reconciles
        # divergent history with the exact local work preserved.
        rc, _ = self.git('merge', '--ff-only', 'origin/main')
        return 'recovery_required' if rc else 'synced'

    def wait(self, seconds):
        if self.test:
            seconds = self.cfg.get('delay', .05)
        deadline = time.monotonic() + seconds
        while not self.shutdown and time.monotonic() < deadline:
            time.sleep(min(.2, max(0, deadline-time.monotonic())))

    def backoff(self, kind):
        self.failures += 1
        floor = 900 if kind == 'rate_limit' else 60
        seconds = min(3600, floor * 2 ** min(self.failures-1, 6)) + random.randint(0, 30)
        self.log('backoff', kind=kind, seconds=seconds, failures=self.failures)
        self.runtime('backoff', error=kind, retry_at=(dt.datetime.now(dt.timezone.utc)+dt.timedelta(seconds=seconds)).isoformat())
        self.wait(seconds)

    def runtime(self, phase, **extra):
        atomic(self.local/'runtime.json', dict(pid=os.getpid(), updated=now(), phase=phase,
               runs=self.runs, consecutive_failures=self.failures, **extra))

    def terminate(self, *_):
        self.shutdown = True
        if self.child and self.child.poll() is None:
            self.child.terminate()  # worker forwards to the entire Claude process group

    def invoke(self):
        self.runs += 1
        run_id = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
        result_path = self.logs/'claude-runs'/f'{run_id}.json'
        self.log('claude_start', run=self.runs)
        # A Python worker retains the kernel lock even if the supervisor is killed.
        cmd = [sys.executable, str(Path(__file__).resolve()), 'worker', '--repo', str(self.repo),
               '--lock-fd', str(self.lock.fileno()), '--result', str(result_path)]
        if self.test:
            cmd.append('--test')
        self.child = sp.Popen(cmd, pass_fds=(self.lock.fileno(),), stdout=sp.DEVNULL, stderr=sp.DEVNULL)
        self.runtime('running', worker_pid=self.child.pid, last_operator_run=run_id)
        worker_exit = self.child.wait()
        try:
            result = read(result_path)
        except (OSError, ValueError):
            result = dict(exit_code=worker_exit or 1, error='worker_failure')
        self.log('claude_end', run=self.runs, exit_code=result['exit_code'], kind=result.get('error','none'))
        atomic(self.local/'last_run.json', result)
        # Retain at most 2000 metadata-only runs.
        for p in sorted((self.logs/'claude-runs').glob('*.json'))[:-2000]:
            p.unlink()
        return result

    def run(self):
        if not self.acquire():
            return 75
        signal.signal(signal.SIGTERM, self.terminate)
        signal.signal(signal.SIGINT, self.terminate)
        caffeine = None
        if not self.test:
            caffeine = sp.Popen(['/usr/bin/caffeinate','-i','-s','-w',str(os.getpid())],
                                stdout=sp.DEVNULL, stderr=sp.DEVNULL)
        try:
            while not self.shutdown:
                sync = self.sync()
                if sync in {'remote_invalid','branch_invalid'}:
                    self.log('safe_stop', kind=sync)
                    self.runtime('stopped', reason=sync)
                    return 0
                if sync == 'fetch_failed':
                    self.backoff('git_network')
                    if self.test: return 0
                    continue
                try:
                    state, decision = validate(self.repo)
                except (OSError, ValueError, KeyError, TypeError):
                    self.log('safe_stop', kind='invalid_state_or_ledger')
                    self.runtime('stopped', reason='invalid_state_or_ledger')
                    return 0
                self.log('decision', decision=decision, next_action_hash=digest(state['next_action']), sync=sync)
                if decision in {'hard_stop','goal_achieved','human_only'}:
                    self.runtime('stopped', reason=decision)
                    return 0
                if not self.test:
                    try:
                        auth = sp.run([CLAUDE,'auth','status'], stdout=sp.PIPE, stderr=sp.DEVNULL, timeout=30)
                        logged = json.loads(auth.stdout).get('loggedIn') is True
                    except (ValueError, OSError, sp.TimeoutExpired):
                        logged = False
                    if not logged:
                        self.log('safe_stop', kind='authentication_required')
                        self.runtime('stopped', reason='authentication_required')
                        return 0
                result = self.invoke()
                if self.shutdown: break
                if result.get('error') == 'authentication':
                    self.runtime('stopped', reason='authentication_required')
                    self.log('safe_stop', kind='authentication_required')
                    return 0
                if result['exit_code'] != 0 or result.get('error','none') != 'none':
                    self.backoff(result.get('error','process_failure'))
                else:
                    self.failures = 0
                    _, head = self.git('rev-parse','HEAD')
                    try: action = read(self.repo/'status/AUTONOMY_STATE.json')['next_action']
                    except (OSError,ValueError,KeyError): action = None
                    progress = digest([head, action])
                    self.unchanged_runs = self.unchanged_runs + 1 if progress == self.last_progress else 0
                    self.last_progress = progress
                    delay = min(3600, 300 * 2 ** min(self.unchanged_runs - 2, 4)) if self.unchanged_runs >= 3 else 60
                    self.runtime('cooldown', unchanged_runs=self.unchanged_runs)
                    self.log('continue', seconds=delay, unchanged_runs=self.unchanged_runs)
                    self.wait(delay)
                if self.test and self.runs >= self.cfg.get('max_runs',2): break
            return 0
        finally:
            if caffeine:
                caffeine.terminate()
            self.runtime('stopped', reason='supervisor_exit') if self.shutdown else None
            self.lock.close()

def worker(args):
    # Keep inherited lock fd open until Claude AND its output collectors finish.
    os.fstat(args.lock_fd)
    repo = args.repo
    cfg = read(repo/'.autonomy/test.json') if args.test else {}
    if args.test and not (repo/'.autonomy-test-repo').exists(): return 1
    command = cfg.get('command') if args.test else [CLAUDE, '-p', '--output-format','json',
              '--permission-mode','auto', '--permission-prompts','none',
              '--no-session-persistence', '--no-chrome']
    prompt = 'test' if args.test else (repo/'ops/AUTONOMOUS_RUN_PROMPT.txt').read_text()
    began = now()
    p = sp.Popen(command, cwd=repo, stdin=sp.PIPE, stdout=sp.PIPE, stderr=sp.PIPE,
                 start_new_session=True)
    caffeine = None
    if not args.test:
        caffeine = sp.Popen(['/usr/bin/caffeinate','-i','-s','-w',str(os.getpid())],stdout=sp.DEVNULL,stderr=sp.DEVNULL)
    def stop(*_):
        try: os.killpg(p.pid, signal.SIGTERM)
        except ProcessLookupError: pass
        def force():
            try: os.killpg(p.pid, signal.SIGKILL)
            except ProcessLookupError: pass
        threading.Timer(10, force).start()
    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    counts = {'stdout':0,'stderr':0}
    errors = set()
    # Bounded memory, no model-produced text is written to any supervisor log.
    def drain(pipe, name):
        tail = b''
        while True:
            chunk = pipe.read(4096)
            if not chunk: break
            counts[name] += len(chunk)
            text = (tail + chunk).lower()
            for pattern, kind in [(b'rate_limit','rate_limit'), (b'rate limit','rate_limit'),
                                  (b'usage limit','rate_limit'),(b'overloaded','network'),
                                  (b'connection error','network'), (b'not logged in','authentication'),
                                  (b'authentication_error','authentication'), (b'"is_error":true','api_error'),
                                  (b'"is_error": true','api_error')]:
                if pattern in text: errors.add(kind)
            tail = text[-256:]
        pipe.close()
    threads = [threading.Thread(target=drain,args=(getattr(p,k),k)) for k in counts]
    for t in threads: t.start()
    try:
        p.stdin.write(prompt.encode()); p.stdin.close()
    except BrokenPipeError: pass
    rc = p.wait()
    for t in threads: t.join()
    if caffeine: caffeine.terminate()
    kind = next((x for x in ('authentication','rate_limit','network','api_error') if x in errors),
                'none' if rc == 0 else 'process_failure')
    atomic(args.result, dict(started=began, ended=now(), exit_code=rc, error=kind,
                            stdout=dict(bytes=counts['stdout'],content='suppressed'),
                            stderr=dict(bytes=counts['stderr'],content='suppressed')))
    return 0

def health(repo):
    r = Runner(repo)
    checks = {'repo_exists':(repo/'.git').exists()}
    try:
        s, decision = validate(repo)
        checks.update(state_valid=True, ledger_valid=True, goal_achieved=s['goal_achieved'],
                      stop_reason=s['stop_reason'], decision=decision,
                      next_action_hash=digest(s['next_action']),
                      last_operator_run=s.get('last_operator_run'))
    except (ValueError,OSError,KeyError,TypeError):
        checks.update(state_valid=False,ledger_valid=False)
    lock = (r.local/'supervisor.lock').open('a+')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX|fcntl.LOCK_NB)
        checks['supervisor_lock_held'] = False
    except BlockingIOError:
        checks['supervisor_lock_held'] = True
    lock.close()
    checks['remote_valid'] = r.git('remote','get-url','origin') == (0,REMOTE)
    checks['main_reachable'] = r.git('ls-remote','--exit-code','origin','refs/heads/main')[0] == 0
    rc, distance = r.git('rev-list','--left-right','--count','HEAD...origin/main')
    checks['local_ahead_remote_behind'] = [int(n) for n in distance.split()] if rc == 0 else None
    checks['latest_log_exists'] = (r.logs/'supervisor.log').exists()
    try: checks['runtime'] = read(r.local/'runtime.json')
    except (OSError,ValueError): checks['runtime'] = None
    # Only inspect command names/PIDs, never arguments which may contain secrets.
    ps = sp.run(['/bin/ps','-axo','pid,ppid,comm'],capture_output=True,text=True)
    checks['process_inspection_available'] = ps.returncode == 0
    runtime = checks['runtime'] or {}
    worker_pid = runtime.get('worker_pid')
    children = [line.split() for line in ps.stdout.splitlines()[1:] if len(line.split()) >= 3]
    checks['supervisor_alive'] = checks['supervisor_lock_held'] and any(int(x[0]) == runtime.get('pid') and 'python' in x[2].lower() for x in children)
    checks['managed_claude_count'] = sum(int(x[1]) == worker_pid and 'claude' in x[2].lower() for x in children)
    checks['managed_claude_duplicate'] = checks['managed_claude_count'] > 1
    healthlog = r.logs/'healthcheck.log'
    if healthlog.exists() and healthlog.stat().st_size > 2_000_000:
        healthlog.replace(r.logs/'healthcheck.previous.log')
    with healthlog.open('a') as f: f.write(json.dumps(dict(time=now(), **checks))+'\n')
    print(json.dumps(checks,indent=2))
    return 0 if all(checks.get(k) for k in ('repo_exists','state_valid','ledger_valid','remote_valid','main_reachable','latest_log_exists','supervisor_alive')) and not checks['managed_claude_duplicate'] else 1

def main():
    os.umask(0o077)
    a = argparse.ArgumentParser()
    a.add_argument('mode', choices=['run','worker','health'])
    a.add_argument('--repo',type=Path,required=True)
    a.add_argument('--test',action='store_true')
    a.add_argument('--lock-fd',type=int)
    a.add_argument('--result',type=Path)
    args = a.parse_args()
    if args.mode == 'worker': return worker(args)
    if args.mode == 'health': return health(args.repo)
    return Runner(args.repo,args.test).run()

if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        # Never traceback exception text (it may contain secrets/remote responses).
        print('autonomy_internal_error',file=sys.stderr)
        sys.exit(1)
