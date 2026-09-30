#!/usr/bin/env bash
# Run: bash tests/test_x_schedule.sh — offline check of the Day-1 X schedule (no API calls).
set -euo pipefail
cd "$(dirname "$0")/.."
X="node scripts/oct/x_phase2.mjs"
[ -f social/2026-10/queue/2026-10-01-am.json ] && [ -f social/2026-10/queue/2026-10-01-pm.json ] || { echo "test_x_schedule: Day-1 queue already consumed — skipped"; exit 0; }
$X validate >/dev/null
[ "$(X_NOW=2026-10-01T08:36:00+09:00 $X due)" = "none" ] || { echo "FAIL: posted before 08:37"; exit 1; }
X_NOW=2026-10-01T08:37:05+09:00 $X due | grep -q 'am.json' || { echo "FAIL: am not due at cron time"; exit 1; }
! X_NOW=2026-10-01T12:40:00+09:00 $X due | grep -q 'pm.json' || { echo "FAIL: pm due too early"; exit 1; }
X_NOW=2026-10-01T20:37:05+09:00 $X due | grep -q 'pm.json' || { echo "FAIL: pm not due at 20:37"; exit 1; }
# cron lines must match the documented slots
grep -q "'37 23 \* \* \*'" .github/workflows/x-phase2.yml && grep -q "'37 11 \* \* \*'" .github/workflows/x-phase2.yml || { echo "FAIL: cron mismatch"; exit 1; }
echo "test_x_schedule: all checks passed"
