#!/usr/bin/env python3
"""Fail-closed local-host run gate; no network or credential access."""
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import subprocess
import sys
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
JST = ZoneInfo('Asia/Tokyo')

def eligibility(cadence, runs, now):
    if not dt.date(2026, 9, 1) <= now.astimezone(JST).date() <= dt.date(2026, 9, 30):
        return 'outside_official_period'
    if cadence.get('paused', True):
        return 'paused_or_missing_configuration'
    due = cadence.get('next_scheduled_run')
    if not due:
        return 'missing_next_wake'
    parsed = dt.datetime.fromisoformat(due)
    if parsed.tzinfo is None:
        return 'next_wake_requires_timezone'
    if now < parsed:
        return 'not_due'
    today = now.astimezone(JST).date().isoformat()
    if sum(r['day_jst'] == today for r in runs) >= cadence['max_business_runs_per_day']:
        return 'daily_cap'
    if runs and runs[-1]['result'] == 'running':
        return 'unfinished_run_requires_recovery'
    if len(runs) >= 2 and all(r['result'] == 'failure' for r in runs[-2:]):
        return 'consecutive_failures'
    return None

def main():
    p = argparse.ArgumentParser()
    p.add_argument('action', choices=['check', 'begin', 'finish'])
    p.add_argument('--trigger', choices=['owner', 'heartbeat'], default='heartbeat')
    p.add_argument('--result', choices=['success', 'failure'])
    args = p.parse_args()
    os.chdir(ROOT)
    history = ROOT / 'status/codex_runs.json'
    lock = Path(subprocess.check_output(['git', 'rev-parse', '--git-common-dir'], text=True).strip()).resolve() / 'codex-business.lock'
    now = dt.datetime.now(dt.timezone.utc)
    if args.action == 'finish':
        if not args.result:
            p.error('finish requires --result')
        owner = json.loads(lock.read_text())
        runs = json.loads(history.read_text())
        if not runs or runs[-1]['run_id'] != owner['run_id'] or runs[-1]['result'] != 'running':
            raise RuntimeError('lock and running receipt do not match')
        runs[-1].update(result=args.result, finished_at=now.isoformat())
        history.write_text(json.dumps(runs, indent=2) + '\n')
        lock.unlink()
        print(json.dumps(runs[-1]))
        return
    cadence = json.loads((ROOT / 'status/codex_cadence.json').read_text())
    runs = json.loads(history.read_text()) if history.exists() else []
    reason = eligibility(cadence, runs, now)
    if reason or lock.exists():
        print(json.dumps({'allowed': False, 'reason': reason or 'locked'}))
        sys.exit(3)
    if args.action == 'check':
        print(json.dumps({'allowed': True}))
        return
    receipt = {'run_id': now.strftime('%Y%m%dT%H%M%S.%fZ'), 'started_at': now.isoformat(),
               'day_jst': now.astimezone(JST).date().isoformat(), 'trigger': args.trigger,
               'source_main_sha': subprocess.check_output(['git', 'rev-parse', 'origin/main'], text=True).strip(),
               'result': 'running', 'compute_cost_jpy': None, 'cost_confidence': 'unavailable_subscription_attribution'}
    # Exclusive creation prevents two local processes from entering together.
    with lock.open('x') as f:
        json.dump(receipt, f)
    runs.append(receipt)
    history.write_text(json.dumps(runs, indent=2) + '\n')
    print(json.dumps(receipt))

if __name__ == '__main__':
    main()
