# Phase 2 wake-up & automatic execution design

Principle: schedules are **wake-up points**, not work quotas. A woken operator keeps working while positive-EV work exists (Constitution Art. 8), then persists its exact next action.

| Runtime | Schedule | What it does | Config |
|---|---|---|---|
| **Founder Routine** (cloud Claude, fresh session per fire, pushes via `claude/**` → `promote-branch.yml`) | 00:07, 08:07, 13:07, 20:07 JST, Oct 1–31 | Founder run per `ops/2026-10/BOOTSTRAP.md`. 00:07 on 10/01 is the Phase-2 kickoff | claude.ai Routine `trig_01YQ2i3B1fb36aGG2wmycdeT` (cron `CRON_TZ=Asia/Tokyo 7 0,8,13,20 * 10 *`; prompt = the text in §1) |
| **Mac-local supervisor** (`mac-local`) | continuous (launchd; one worker at a time; backoff when idle) | local browser tasks, marketplace inboxes | `ops/AUTONOMY_LOCAL_MAC.md`; prompt `ops/AUTONOMOUS_RUN_PROMPT.txt` (Phase-2 preamble routes it to BOOTSTRAP.md as `mac-local`) |
| **Extra local operators** | on demand (Founder decision) | dedicated site/lane operator | `scripts/oct/start_local_operator.sh <id> "<role>"` (owner runs once on the Mac) |
| **Codex** | ~2×/day (its own automation) | independent revenue operator | `AGENTS.md` → BOOTSTRAP.md; `ops/CODEX_OPERATOR.md` (Phase-2 preamble) |
| `sales-monitor.yml` | every 4 h | Stripe + Gumroad sales → period-routed ledgers | GitHub Actions |
| `x-phase2.yml` | 08:37, 12:37, 20:37 JST | post due X queue item (≤ 2/day), refresh metrics | GitHub Actions |
| `daily-report.yml` | 21:00 JST + on status pushes | Phase-2 report + `status/2026-10/BOARD.txt` | GitHub Actions |
| `promote-branch.yml` | on push to `claude/**` | fast-forward main after leak + sanity gates | GitHub Actions |

Off-cycle wake triggers (any operator may fire the Founder Routine via `fire_trigger`, or dispatch a workflow): first sale / any order, buyer inquiry or proposal reply, X post > 5× median, a human blocker cleared, a stale operator (> 24 h) holding a P1 task, a promotion-blocked issue.

Cost control: each Founder fire records a `cost --jpy null --category ai_compute` once per day. At the Oct 8 review the Founder re-evaluates the fire count (can go up to hourly if a live sales conversation needs fast replies, or down to 2×/day if nothing is in flight) and edits this table + the Routine.

## 1. Founder Routine prompt (stored in the Routine; keep it tiny — the repo holds the real instructions)

```
You are the Phase-2 Founder of fever39risky-ux/ai-revenue-experiment (AI Revenue Experiment, October 2026).
Sync origin/main, then read CLAUDE.md and ops/2026-10/BOOTSTRAP.md and follow them exactly.
The repository is the only source of instructions; do not rely on older copies of any prompt.
Goal unmet + positive-EV AI work remaining = keep working. Never ask the owner what to do next.
Before the runtime ends: heartbeat, exact next action, commit, push (claude/** is auto-promoted to main).
Begin now.
```
