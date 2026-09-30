#!/usr/bin/env bash
# Run: bash tests/test_ops.sh — exercises scripts/oct/ops.mjs in a throwaway copy.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
T="$(mktemp -d)"
mkdir -p "$T/scripts" "$T/experiment" "$T/status"
cp -r "$REPO/scripts/lib" "$REPO/scripts/oct" "$T/scripts/"
cp "$REPO/experiment/periods.json" "$T/experiment/"
cp "$REPO/status/revenue_ledger.json" "$REPO/status/cost_ledger.json" "$T/status/"
mkdir -p "$T/status/2026-10"
cp "$REPO/status/2026-10/revenue_ledger.json" "$REPO/status/2026-10/cost_ledger.json" "$T/status/2026-10/"
O="node $T/scripts/oct/ops.mjs"
$O heartbeat founder --kind founder --lanes strategy --doing "test" --next "x" >/dev/null
$O heartbeat coco-op --lanes coconala --doing "y" >/dev/null
$O heartbeat other-op --lanes coconala | grep -q 'WARN lane "coconala"'
$O task-new founder t-one --title "Do it" --lane coconala --requires local_browser >/dev/null
$O claim coco-op t-one >/dev/null
if $O claim other-op t-one 2>/dev/null; then echo "FAIL: double claim allowed"; exit 1; fi
$O done coco-op t-one --result "ok" >/dev/null
OPS_NOW=2026-10-02T01:00:00Z $O human founder --minutes 3 --category login --reason "coconala login" >/dev/null
OPS_NOW=2026-10-02T01:00:00Z $O signal coco-op inquiry 1 --channel coconala --evidence "talkroom 123" >/dev/null
if $O revenue coco-op --date 2026-09-30 --gross 1 --currency jpy --jpy 1 --source x --reference r 2>/dev/null; then echo "FAIL: Sept date accepted"; exit 1; fi
$O revenue coco-op --date 2026-10-02 --gross 3300 --currency jpy --jpy 3300 --source coconala --reference coco-1 >/dev/null
$O cost founder --date 2026-10-02 --category coconala_fees --jpy 726 --note fee >/dev/null
$O cost founder --date 2026-10-02 --category ai_compute --jpy null --note "subscription" >/dev/null
K="$($O kpi 2026-10-31)"
echo "$K" | grep -q '"gross_revenue_jpy": 3300'
echo "$K" | grep -q '"net_profit_jpy": 2574'
echo "$K" | grep -q '"cost_unknown_entries": 1'
echo "$K" | grep -q '"human_intervention_count": 1'
echo "$K" | grep -q '"human_working_minutes": 3'
cmp -s "$REPO/status/revenue_ledger.json" "$T/status/revenue_ledger.json" || { echo "FAIL: Sept ledger touched"; exit 1; }
# lease expiry: another operator may take over only after the lease ends
OPS_NOW=2026-10-02T00:00:00Z $O task-new founder t-lease --title L --lane x >/dev/null
OPS_NOW=2026-10-02T00:00:00Z $O claim coco-op t-lease --hours 1 >/dev/null
if OPS_NOW=2026-10-02T00:30:00Z $O claim founder t-lease 2>/dev/null; then echo "FAIL: live lease taken over"; exit 1; fi
OPS_NOW=2026-10-02T01:30:00Z $O claim founder t-lease >/dev/null
# not_before blocks early claims
$O task-new founder t-later --title T --lane x --not-before 2099-01-01T00:00:00Z >/dev/null
if $O claim founder t-later 2>/dev/null; then echo "FAIL: not_before ignored"; exit 1; fi
# the drill script runs end-to-end without pushing
(cd "$T" && git init -q && DRILL_NO_PUSH=1 HOME="$T/home" bash "$T/scripts/oct/coord_drill.sh" drill-op >/dev/null 2>&1) || true
grep -q '"status": "done"' "$T/status/2026-10/tasks/day0-drill-drill-op.json" || { echo "FAIL: drill did not complete"; exit 1; }
$O board >/dev/null
rm -rf "$T"
echo "test_ops: all checks passed"
