#!/usr/bin/env bash
# Start an additional Phase-2 local operator on the owner's Mac.
#   scripts/oct/start_local_operator.sh <operator-id> "<role and lanes, one line>" [interval-minutes]
# Runs one Claude worker at a time in its OWN checkout
# (~/Library/Application Support/AIRevenueExperiment/operators/<id>/repo), so it never
# collides with the main launchd supervisor's checkout. Foreground loop; stop with Ctrl-C
# (or run it inside `tmux`/`screen`). Browser work uses a dedicated Playwright profile:
#   ~/Library/Application Support/AIRevenueExperiment/browser-profiles/<site>
# Same safety posture as the main supervisor: permission-mode auto, no bypass flags.
set -euo pipefail
ID="${1:?operator id}"; ROLE="${2:?role/lanes}"; EVERY="${3:-60}"
[[ "$ID" =~ ^[a-z0-9][a-z0-9-]{1,40}$ ]] || { echo "bad operator id"; exit 2; }
BASE="$HOME/Library/Application Support/AIRevenueExperiment"
DIR="$BASE/operators/$ID"; REPO="$DIR/repo"; LOCK="$DIR/lock"
mkdir -p "$DIR" "$BASE/browser-profiles"
mkdir "$LOCK" 2>/dev/null || { echo "operator $ID already running (remove $LOCK if it crashed)"; exit 75; }
trap 'rmdir "$LOCK"' EXIT
[ -d "$REPO/.git" ] || git clone https://github.com/fever39risky-ux/ai-revenue-experiment.git "$REPO"
CLAUDE="$(command -v claude)"
while true; do
  git -C "$REPO" fetch -q origin main && git -C "$REPO" checkout -q main && git -C "$REPO" merge -q --ff-only origin/main || echo "sync failed; working on local state"
  PROMPT="You are Phase-2 operator \`$ID\` of fever39risky-ux/ai-revenue-experiment, running on the owner's Mac.
Role / lanes: $ROLE
Read CLAUDE.md, then ops/2026-10/BOOTSTRAP.md and follow it with operator id \`$ID\` (NOT founder).
Heartbeat first, take only tasks/lanes that match your role, claim before working, and push only your own files.
For websites use Playwright with the dedicated profile directory \"$BASE/browser-profiles/<site>\"."
  (cd "$REPO" && printf '%s' "$PROMPT" | "$CLAUDE" -p --permission-mode auto --no-session-persistence) || echo "run exited non-zero"
  sleep "$((EVERY * 60))"
done
