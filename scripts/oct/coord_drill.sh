#!/usr/bin/env bash
# Phase 2 Day-0 coordination drill — run ON THE MAC by an existing local operator.
#   bash scripts/oct/coord_drill.sh <operator-id>        e.g. mac-local | codex
# Exercises, against the REAL shared state on main (not a copy):
#   registry + heartbeat, task claim, double-claim rejection, release, re-claim,
#   completion, hand-off to the Founder, a cross-machine lease left for the cloud
#   Founder to test, and a read-only local capability probe (no logins, no posting).
# Then commits ONLY this operator's files + its drill tasks and pushes, so the cloud
# Founder can see everything through GitHub. Safe to re-run (idempotent per operator).
set -uo pipefail
OP="${1:?operator id (mac-local | codex | ...)}"
[[ "$OP" =~ ^[a-z0-9][a-z0-9-]{1,40}$ ]] || { echo "bad operator id"; exit 2; }
cd "$(dirname "$0")/../.."
O="node scripts/oct/ops.mjs"
LOG=(); ok(){ LOG+=("PASS $1"); echo "PASS $1"; }; ng(){ LOG+=("FAIL $1"); echo "FAIL $1"; }

[ -n "${DRILL_NO_PUSH:-}" ] || git pull -q --rebase origin main || echo "WARN: pull failed; continuing on local state"

# --- read-only capability probe (no login, no form input) ---
CAPS="git,node"
command -v claude >/dev/null 2>&1 && CAPS="$CAPS,claude-cli"
if command -v claude >/dev/null 2>&1 && claude mcp list 2>/dev/null | grep -qi playwright; then CAPS="$CAPS,playwright-mcp"; fi
{ [ -d "$HOME/Library/Caches/ms-playwright" ] || [ -d "$HOME/.cache/ms-playwright" ]; } && CAPS="$CAPS,playwright-browsers"
PROFILES="$HOME/Library/Application Support/AIRevenueExperiment/browser-profiles"
mkdir -p "$PROFILES" 2>/dev/null && CAPS="$CAPS,browser-profile-dir"
PROBE=""
for u in https://coconala.com/ https://booth.pm/ https://note.com/ https://x.com/; do
  c=$(curl -s -o /dev/null -m 15 -w '%{http_code}' "$u" || echo 000); PROBE="$PROBE ${u#https://}=$c"
done
case "$PROBE" in *coconala.com/=2*|*coconala.com/=3*) CAPS="$CAPS,reach-coconala";; esac
case "$PROBE" in *booth.pm/=2*|*booth.pm/=3*) CAPS="$CAPS,reach-booth";; esac

# 1. registry + heartbeat
$O heartbeat "$OP" --kind "local-mac" --runtime "owner's Mac ($(uname -s))" --status working \
  --doing "Day-0 coordination drill" --next "Phase 2 run protocol from 2026-10-01 (ops/2026-10/BOOTSTRAP.md)" \
  --capabilities "$CAPS" >/dev/null && ok "heartbeat/registry" || ng "heartbeat/registry"

T="day0-drill-$OP"
[ -f "status/2026-10/tasks/$T.json" ] || $O task-new "$OP" "$T" --title "Day-0 coordination drill ($OP)" --lane ops-drill --priority 5 >/dev/null
# 2. claim
$O claim "$OP" "$T" --hours 1 >/dev/null 2>&1 && ok "claim $T" || ng "claim $T"
# 3. double claim by another identity must be rejected
if $O claim "$OP-intruder" "$T" >/dev/null 2>&1; then ng "double-claim was ALLOWED"; else ok "double-claim rejected"; fi
# 4. release + re-claim
$O release "$OP" "$T" --reason "drill release" >/dev/null 2>&1 && ok "release" || ng "release"
$O claim "$OP" "$T" --hours 1 >/dev/null 2>&1 && ok "re-claim after release" || ng "re-claim"
# 5. hand-off to the Founder (Founder completes it from the cloud)
H="day0-handoff-$OP-to-founder"
if [ ! -f "status/2026-10/tasks/$H.json" ]; then
  $O task-new "$OP" "$H" --title "Hand-off from $OP: acknowledge Phase-2 registration and capability probe" --lane ops-drill --priority 5 \
    --detail "caps=$CAPS; probe:$PROBE" --acceptance "Founder claims + completes this from the cloud via GitHub" >/dev/null \
    && $O event "$OP" handoff --summary "handoff $H to founder" --task "$H" --to founder >/dev/null && ok "handoff created" || ng "handoff"
else ok "handoff already exists"; fi
# 6. cross-machine lease: leave a 45-minute lease so the cloud Founder can prove it is rejected
L="day0-lease-$OP"
[ -f "status/2026-10/tasks/$L.json" ] || $O task-new "$OP" "$L" --title "Cross-machine lease test ($OP holds; Founder must be rejected until lease expiry, then may take over)" --lane ops-drill --priority 5 >/dev/null
$O claim "$OP" "$L" --hours 0.75 >/dev/null 2>&1 && ok "lease held for cross-machine test" || ng "lease claim"
# 7. completion
SUMMARY="$(printf '%s; ' "${LOG[@]}")probe:$PROBE"
$O done "$OP" "$T" --result "$SUMMARY" >/dev/null 2>&1 && ok "done" || ng "done"
$O event "$OP" day0_drill --summary "$SUMMARY" --capabilities "$CAPS" >/dev/null
$O heartbeat "$OP" --status idle --doing "Day-0 drill finished: ${#LOG[@]} checks" \
  --next "From 2026-10-01: claim local_browser tasks per ops/2026-10/BOOTSTRAP.md" >/dev/null

# 8. commit only our files and push (main; fallback to an auto-promoted claude/** branch)
node scripts/leak_check.mjs >/dev/null && node scripts/promotion_check.mjs >/dev/null || { echo "gate failed; not pushing"; exit 1; }
git add "status/2026-10/operators/$OP.json" "status/2026-10/events/$OP.jsonl" \
  "status/2026-10/tasks/$T.json" "status/2026-10/tasks/$H.json" "status/2026-10/tasks/$L.json"
git commit -q -m "ops(day0): $OP coordination drill — $(printf '%s ' "${LOG[@]}" | cut -c1-120)" || true
[ -n "${DRILL_NO_PUSH:-}" ] && { echo "DRILL_NO_PUSH set: not pushing"; printf '%s\n' "${LOG[@]}"; exit 0; }
for i in 1 2 3 4; do
  git pull -q --rebase origin main && git push -q origin HEAD:main && { echo "pushed to main"; break; }
  if [ "$i" = 4 ]; then git push -q origin "HEAD:refs/heads/claude/day0-drill-$OP" && echo "pushed to claude/day0-drill-$OP (auto-promoted)"; fi
  sleep $((2 ** i))
done
printf '%s\n' "${LOG[@]}"
