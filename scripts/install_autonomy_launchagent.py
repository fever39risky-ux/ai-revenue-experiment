#!/usr/bin/env python3
"""Generate/install the user's LaunchAgent; never stores credentials."""
import argparse
import os
from pathlib import Path
import plistlib
import subprocess
import sys

p=argparse.ArgumentParser()
p.add_argument('--install',action='store_true')
p.add_argument('--test-repo',type=Path)
a=p.parse_args()
repo=(a.test_repo or Path(__file__).resolve().parents[1]).resolve()
test=bool(a.test_repo)
if test and not (repo/'.autonomy-test-repo').exists(): raise SystemExit('Not an isolated test fixture')
label='com.airevenue.claude-autonomous'+('.test' if test else '')
logs=repo/'logs'; logs.mkdir(exist_ok=True,mode=0o700)
cmd=[sys.executable,str(Path(__file__).with_name('autonomy_supervisor.py')), 'run','--repo',str(repo),'--test'] if test else ['/bin/bash',str(repo/'scripts/run_autonomous_forever.sh')]
plist={
    'Label':label,'ProgramArguments':cmd,'RunAtLoad':True,
    'KeepAlive':{'SuccessfulExit':False},'ThrottleInterval':60,
    'WorkingDirectory':str(repo),'ProcessType':'Background','ExitTimeOut':20,
    'EnvironmentVariables':{'PATH':f'{Path.home()}/.npm-global/bin:{Path.home()}/.local/bin:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin',
                            'AUTONOMY_PYTHON':sys.executable,'GIT_TERMINAL_PROMPT':'0'},
    'StandardOutPath':str(logs/'launchd.stdout.log'),
    'StandardErrorPath':str(logs/'launchd.stderr.log'), 'Umask':63,
}
repo.joinpath('.autonomy').mkdir(exist_ok=True,mode=0o700)
staged=repo/'.autonomy'/f'{label}.plist'
staged.write_bytes(plistlib.dumps(plist)); staged.chmod(0o600)
subprocess.run(['/usr/bin/plutil','-lint',str(staged)],check=True)
if a.install:
    dst=Path.home()/'Library/LaunchAgents'/staged.name
    dst.parent.mkdir(exist_ok=True)
    if dst.exists() and dst.read_bytes()!=staged.read_bytes():
        raise SystemExit('Existing different agent retained; review before replacing')
    dst.write_bytes(staged.read_bytes()); dst.chmod(0o600)
    domain=f'gui/{os.getuid()}'
    check=subprocess.run(['/bin/launchctl','print',f'{domain}/{label}'],capture_output=True)
    if check.returncode==0: raise SystemExit('Already loaded; left running')
    subprocess.run(['/bin/launchctl','bootstrap',domain,str(dst)],check=True)
    print('Installed '+label)
else:
    print('Generated '+str(staged))
