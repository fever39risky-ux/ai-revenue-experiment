#!/usr/bin/env python3
"""Install / inspect / remove the Phase-2 Mac supervisor LaunchAgent (one-time setup).

  python3 scripts/oct/install_mac_supervisor.py --dry-run     # write + lint the plist only
  python3 scripts/oct/install_mac_supervisor.py --install     # clone dedicated checkout, retire Sept agent, load
  python3 scripts/oct/install_mac_supervisor.py --status
  python3 scripts/oct/install_mac_supervisor.py --uninstall

Design (ops/2026-10/MAC_SUPERVISOR.md):
- Label com.airevenue.phase2.mac-local, RunAtLoad + KeepAlive=true (always restarted, unlike
  the September agent whose clean 'safe stop' exit left it dead since 2026-09-26).
- Dedicated checkout ~/Library/Application Support/AIRevenueExperiment/operators/mac-local/repo
  (never the owner's working copies, never the September supervisor's checkout).
- The September agent com.airevenue.claude-autonomous is booted out and disabled (reversible:
  `launchctl enable gui/$UID/com.airevenue.claude-autonomous`), so two supervisors never act
  as mac-local at once.
No credentials are written anywhere; Claude uses its existing login.
"""
import argparse
import os
from pathlib import Path
import plistlib
import shutil
import subprocess as sp
import sys

LABEL = 'com.airevenue.phase2.mac-local'
OLD_LABEL = 'com.airevenue.claude-autonomous'
REMOTE = 'https://github.com/fever39risky-ux/ai-revenue-experiment.git'
BASE = Path.home() / 'Library/Application Support/AIRevenueExperiment'
CHECKOUT = BASE / 'operators/mac-local/repo'
STATE = BASE / 'operators/mac-local/state'
PATH = ':'.join([str(Path.home() / '.npm-global/bin'), str(Path.home() / '.local/bin'), '/opt/homebrew/bin',
                 '/usr/local/bin', '/usr/bin', '/bin', '/usr/sbin', '/sbin'])


def which(name):
    return shutil.which(name, path=PATH + ':' + os.environ.get('PATH', ''))


def plist():
    claude = which('claude') or str(Path.home() / '.npm-global/bin/claude')
    return {
        'Label': LABEL,
        'ProgramArguments': [sys.executable, str(CHECKOUT / 'scripts/oct/mac_supervisor.py'), '--self-update',
                             '--repo', str(CHECKOUT), '--state-dir', str(STATE), '--claude', claude],
        'RunAtLoad': True, 'KeepAlive': True, 'ThrottleInterval': 60, 'ProcessType': 'Background',
        'WorkingDirectory': str(CHECKOUT), 'ExitTimeOut': 30, 'Umask': 63,
        'EnvironmentVariables': {'PATH': PATH, 'GIT_TERMINAL_PROMPT': '0'},
        'StandardOutPath': str(STATE / 'launchd.stdout.log'),
        'StandardErrorPath': str(STATE / 'launchd.stderr.log'),
    }


def lc(*args):
    return sp.run(['/bin/launchctl', *args], capture_output=True, text=True)


def main():
    a = argparse.ArgumentParser()
    g = a.add_mutually_exclusive_group(required=True)
    for f in ('--dry-run', '--install', '--status', '--uninstall'):
        g.add_argument(f, action='store_true')
    a = a.parse_args()
    STATE.mkdir(parents=True, exist_ok=True, mode=0o700)
    staged = STATE / f'{LABEL}.plist'
    staged.write_bytes(plistlib.dumps(plist()))
    staged.chmod(0o600)
    if a.dry_run:
        if Path('/usr/bin/plutil').exists():
            sp.run(['/usr/bin/plutil', '-lint', str(staged)], check=True)
        print(staged.read_text())
        return 0
    domain = f'gui/{os.getuid()}'
    dst = Path.home() / 'Library/LaunchAgents' / f'{LABEL}.plist'
    if a.status:
        r = lc('print', f'{domain}/{LABEL}')
        print('loaded' if r.returncode == 0 else 'not loaded')
        for line in r.stdout.splitlines():
            if any(k in line for k in ('state =', 'pid =', 'last exit code', 'runs =')):
                print(line.strip())
        log = STATE / 'supervisor.log'
        if log.exists():
            print('--- last supervisor events'); print('\n'.join(log.read_text().splitlines()[-8:]))
        return 0
    if a.uninstall:
        lc('bootout', f'{domain}/{LABEL}')
        dst.unlink(missing_ok=True)
        print('uninstalled ' + LABEL)
        return 0
    # --install
    for tool in ('git', 'node', 'npx', 'claude'):
        if not which(tool):
            print(f'missing tool on PATH: {tool}'); return 2
    auth = sp.run([which('claude'), 'auth', 'status'], capture_output=True, text=True)
    if '"loggedIn": true' not in auth.stdout.replace("'", '"') and '"loggedIn":true' not in auth.stdout:
        print('WARNING: `claude auth status` does not report loggedIn=true; the supervisor will report '
              'blocked_on=authentication until `claude` is logged in on this Mac.')
    if not (CHECKOUT / '.git').exists():
        CHECKOUT.parent.mkdir(parents=True, exist_ok=True)
        sp.run(['git', 'clone', '-q', REMOTE, str(CHECKOUT)], check=True)
    sp.run(['git', '-C', str(CHECKOUT), 'pull', '-q', '--ff-only', 'origin', 'main'])
    # retire the September agent (dead since 2026-09-26; reversible)
    if lc('print', f'{domain}/{OLD_LABEL}').returncode == 0:
        lc('bootout', f'{domain}/{OLD_LABEL}')
    lc('disable', f'{domain}/{OLD_LABEL}')
    # (re)load the Phase-2 agent
    if lc('print', f'{domain}/{LABEL}').returncode == 0:
        lc('bootout', f'{domain}/{LABEL}')
    dst.parent.mkdir(exist_ok=True)
    dst.write_bytes(staged.read_bytes()); dst.chmod(0o600)
    lc('enable', f'{domain}/{LABEL}')
    r = lc('bootstrap', domain, str(dst))
    if r.returncode != 0:
        print('launchctl bootstrap failed: ' + r.stderr.strip()); return 1
    print(f'installed {LABEL}; checkout {CHECKOUT}; logs {STATE}')
    print('check: python3 scripts/oct/install_mac_supervisor.py --status')
    return 0


if __name__ == '__main__':
    sys.exit(main())
