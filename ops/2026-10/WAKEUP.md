# Phase 2 wake-up & automatic execution design

Principle: schedules are **wake-up points (re-ignition)**, not work quotas. A woken session applies *Goal unmet + positive-EV AI-operable work exists = CONTINUE* and runs until a session end condition E1–E4 (Constitution Art. 8.2) is true; finishing one action or package is never an end condition. The four daily Founder fires exist so that a session that hit a hard limit (E3) is restarted within ≤ 8 h, and so that overnight/daytime gaps are covered — not to divide the day into four jobs. If a fire starts while a previous Founder session is still live (founder heartbeat < 60 min), the new session acts as `founder-assist` and takes tasks instead of duplicating work.

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
This fire is a wake-up, not a work quota: Goal unmet + positive-EV AI work remaining = CONTINUE.
Finishing one action or package is never a reason to end; end only on Constitution Art. 8.2 (E1-E4) and log which.
Never ask the owner what to do next.
Before the runtime ends: session_end event, heartbeat with exact next action, commit, push (claude/** is auto-promoted to main).
Begin now.
```
