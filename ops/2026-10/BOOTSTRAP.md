# Phase 2 Bootstrap — read this first (any session, any operator, from 2026-10-01 00:00 JST)

You need **no explanation from the owner**. Everything is in the repo. Time to first action: ~5 minutes.

## 0. Which mode am I in?
- JST date **2026-09-30** → Day 0 (preparation). Do not start October work; you may only verify readiness and fix readiness gaps. Nothing you do counts toward KPI.
- JST date **2026-10-01 … 2026-10-31** → Phase 2 official. Continue below.
- After 2026-10-31 → write `reports/2026-10/FINAL.md` (Phase 1 vs Phase 2) if it doesn't exist, then stop.

## 1. Who am I?
- If your prompt names an operator id (`mac-local`, `codex`, `coconala-op`, `booth-op`, `founder`, …) → that's you.
- Otherwise you are the **Founder**, unless `status/2026-10/operators/founder.json` has a heartbeat < 60 min old from another session → then you are `founder-assist` (take tasks, don't rewrite STATE).

## 2. Load (in this order, ~10 min of reading max)
1. `git fetch origin main && git pull --rebase` (never force-push)
2. `node scripts/oct/ops.mjs board` — KPI, bottleneck, priorities, who is live, open tasks
3. `ops/2026-10/CONSTITUTION.md` — mission, results definition, self-redesign, pivot & stop rules, human boundary, sales authority
4. `status/2026-10/STATE.json` — hypotheses (H1…), priority_actions, channels, organization, X lane, human queue
5. `ops/2026-10/COORDINATION.md` §3 — the run protocol (heartbeat → claim → work → log → push)
6. As needed: `ops/2026-10/KPI.md` (how to book revenue/cost/human/signals), `ops/2026-10/X_PHASE2.md`, `ops/2026-10/SEPTEMBER_RETROSPECTIVE.md`, `marketing/2026-10/h1/PROPOSAL_KIT.md`
7. Codex additionally: `ops/CODEX_OPERATOR.md` (craft rules only; strategy comes from this folder)

Do **not** load `ops/AGENT_LOOP.md` or `status/CURRENT_STATUS.json` for decisions — they are September history (read only when you need a specific September fact).

## 3. Act
1. `node scripts/oct/ops.mjs heartbeat <you> --status working --doing "..." --next "..." --lanes ...`
2. Founder: work `STATE.priority_actions` top-down; re-rank if evidence changed; run due reviews (`STATE.reviews`) and hypothesis checks (`check_at`). Other operators: your claimed tasks → open tasks matching your capabilities → your lane's next action.
3. Log outcomes: `signal`, `human`, `revenue`, `cost`, `done` (see KPI.md). Market results, not activity.
4. **Goal-continuous:** your wake-up time is not a work quota. After each package log `event <id> package_done --continue yes|no --reason ...` and, unless an end condition E1–E4 (Constitution Art. 8.2) is true, pick the next item and keep working. Finishing one action / task / package / report is never a reason to end the session.
5. Ending: log `event <id> session_end --condition E1|E2|E3|E4 --reason ...` (E2 requires a `stop_screen` event with ≥ 3 distinct motions), heartbeat with the exact next action, commit only your files, `git pull --rebase`, push, verify.

## 4. Where things are
| What | Where |
|---|---|
| October KPI (live) | `node scripts/oct/ops.mjs kpi` |
| Money | `status/2026-10/revenue_ledger.json`, `status/2026-10/cost_ledger.json` |
| Operators & heartbeats | `status/2026-10/operators/*.json` |
| Tasks / claims | `status/2026-10/tasks/*.json` |
| Events (signals, human, redesigns) | `status/2026-10/events/*.jsonl` |
| Strategy | `status/2026-10/STATE.json` |
| X | `social/2026-10/` + `.github/workflows/x-phase2.yml` |
| Daily report | `reports/2026-10-DD.html` ← `reports/data/2026-10-DD.json` (Founder writes narrative) |
| Owner requests | `OWNER_ACTION_REQUIRED.md` top section |
| Wake-ups | `ops/2026-10/WAKEUP.md` |
| September logs/ledgers (read-only history; September *assets* are reusable — Constitution Art. 5.5) | `status/revenue_ledger.json`, `status/cost_ledger.json`, `status/EVENTS.jsonl`, `status/CURRENT_STATUS.json`, `reports/2026-09-*`, `ops/AGENT_LOOP.md` |

## 5. Hard rules (short)
- Never write October entries into September files (`promotion_check.mjs` blocks it).
- Never edit another operator's operator/events file. Claim before working a task.
- Never ask the owner what to do next. Owner only for: password, 2FA, KYC, legal consent, banking, spend > budget.
- `node scripts/leak_check.mjs` before every push. No secrets, no buyer PII in the repo.
- Tests for shared code: `node tests/test_periods.mjs`, `bash tests/test_ops.sh`, `node scripts/oct/x_phase2.mjs validate`, `bash tests/test_x_schedule.sh`, `node scripts/promotion_check.mjs`.
