# Operator / Agent coordination (Phase 2)

Goal: several AI operators (cloud Claude, Mac-local Claude sessions, Codex, GitHub Actions) run in parallel **without** duplicating work, overwriting each other or git-conflicting — and anyone can see at a glance **who is doing what, how far along, what's next, and when they last reported**.

Tool: `node scripts/oct/ops.mjs` (no deps). Tests: `bash tests/test_ops.sh`, `node tests/test_periods.mjs`.

## 1. Shared state — single-writer files

| Path | Writer | Purpose |
|---|---|---|
| `status/2026-10/STATE.json` | **Founder only** | strategy, hypotheses, bottleneck, priorities, organization, channels, X lane, human queue |
| `status/2026-10/operators/<id>.json` | operator `<id>` only | registry + heartbeat: kind, runtime, role, lanes, capabilities, status, doing, progress, next, blocked_on, heartbeat_at |
| `status/2026-10/events/<id>.jsonl` | operator `<id>` only (append) | everything that happened: task events, signals, human interventions, redesigns, proposals to the Founder |
| `status/2026-10/tasks/<task-id>.json` | creator; then the claimant (lease) | work queue with claim/lease (`claim`, `done`, `release`) |
| `status/2026-10/revenue_ledger.json`, `cost_ledger.json` | monitors + `ops.mjs revenue/cost` | money (rare writes; always `git pull --rebase` first) |
| `social/2026-10/**` | X lane (Founder + `x-phase2.yml`) | X queue, posted log, metrics |

Because each operator writes only its own files, two operators pushing at the same time rebase cleanly. **Never edit another operator's operator/events file** (exception: Day-0 bootstrap registration by the Founder, marked `registered_by`, which the operator overwrites on its first heartbeat).

## 2. Organization at Day 1

| id | kind / runtime | role & lanes | notes |
|---|---|---|---|
| `founder` | Claude, cloud Routine (4×/day, `ops/2026-10/WAKEUP.md`) + any unassigned Claude session | strategy, STATE owner, hypotheses, pivots, X series authoring, reports, reviews | there is one Founder at a time; a second Claude session that finds a live founder heartbeat (< 60 min) acts as `founder-assist` and takes tasks instead of rewriting STATE |
| `mac-local` | Claude, Mac launchd supervisor (continuous) | **local browser operator**: executes tasks with `requires: local_browser` (Coconala, BOOTH, note, Crowd sites), marketplace inbox checks, order booking | Playwright + dedicated profiles (§5). Existing supervisor; not replaced |
| `coconala-op` | Claude, Mac-local interactive session (published 4426150 on 9/30) | Coconala listing / talk room / delivery | may merge into `mac-local` — Founder decides after Day 3 based on heartbeats |
| `booth-op` | Claude, Mac-local interactive session | BOOTH listing 8919052 | same as above |
| `codex` | Codex, Mac automation (≈2×/day) | independent revenue operator; must claim a lane/task not held by others | reads `AGENTS.md` → this doc |
| `actions` | GitHub Actions | `sales-monitor` (4h), `daily-report` (21:00 JST), `x-phase2` (3×/day), `promote-branch` | no judgment; mechanical |

The Founder changes this table by editing `STATE.json.organization` and logging a `redesign` event (Constitution Art. 6).

## 3. Run protocol (every operator, every run)

1. `git fetch origin main && git pull --rebase` (never force-push, never reset others' work).
2. `node scripts/oct/ops.mjs board` — read KPI, bottleneck, priorities, who is live, open tasks.
3. `node scripts/oct/ops.mjs heartbeat <id> --status working --doing "<one line>" --next "<one line>" --lanes <lanes>`.
4. Pick work: first your own claimed tasks, then open tasks matching your capabilities by priority, then your lane's next action. **Claim before starting**: `ops.mjs claim <id> <task> --hours N`. A live lease held by someone else = hands off.
5. Work. Log market results as `signal`, owner touches as `human`, money as `revenue`/`cost`, completed work as `done`.
6. Before ending (or every ~60 min): heartbeat with progress + exact next action; commit only your files (+ code you changed); `git pull --rebase`; push. If push is rejected, rebase and retry (up to 4×).
7. Status values: `working`, `idle` (no claimable work — say why in `doing`), `blocked` (set `--blocked-on`), `retired`.

Heartbeat staleness: > 180 min = STALE on the board. Founder treats an operator stale > 48 h as unavailable and releases its tasks.

## 4. Conflict prevention & hand-off

- **Lane ownership**: an operator lists lanes in its heartbeat. `heartbeat` warns if another live operator holds the same lane. Resolve by task/hand-off, not by both acting.
- **Hand-off**: create a task for the receiving operator (`task-new ... --lane <lane> --detail "<context, links, acceptance>"`) and add an event `handoff`. The receiver claims it. Context lives in the task, not in chat memory.
- **Proposals to the Founder**: `ops.mjs event <id> proposal --summary "..."`. The Founder answers in STATE.decisions within one run.
- **Git**: only touch your files; shared code changes → small commits, run tests, then push. Pushing to a `claude/**` branch is fine — `promote-branch.yml` fast-forwards `main` after `leak_check` + `promotion_check`.

## 5. Local browser operator (sites the cloud cannot reach)

Cloud sessions cannot reach coconala.com / booth.pm / etsy.com / note.com editing / crowdworks.jp etc. **This is a routing problem, not a human problem.**

Delegation:
1. Cloud Founder creates a task: `ops.mjs task-new founder <id> --title ... --lane coconala --requires local_browser --site coconala.com --priority 1 --detail "<exact steps + acceptance + what to record>"`.
2. The Mac supervisor (`ops/2026-10/MAC_SUPERVISOR.md`) detects the task on main within ~2 min and starts a `mac-local` Claude worker automatically; it claims it, executes with Playwright using a **dedicated persistent browser profile per site**: `~/Library/Application Support/AIRevenueExperiment/browser-profiles/<site>` (never the owner's everyday profile). Logged-in sessions persist in that profile. Registered site profiles (`SITE_PROFILES` in `scripts/oct/mac_supervisor.py`, exposed to workers as MCP server `playwright-<site>`): **note.com → `browser-profiles/note-profile`** (owner logged in 2026-10-02; use only for note, never for other sites).
3. Only if the profile is logged out and login needs password/2FA: the operator opens the login page in that profile, asks the owner once (one message, ≤ 2 min task), logs `human --category login`, then continues. Everything after login is AI work.
4. Results (screenshots summarized as text, URLs, ids) go into `done --result` and events. No PII of buyers in the repo.

**Starting an additional local operator** (when the Founder decides a site needs a dedicated, parallel operator): `scripts/oct/start_local_operator.sh <operator-id> "<role / lanes>"` on the Mac (first run needs the owner to execute it once → log as `human --category permission`). The script runs one headless Claude worker with the Phase-2 bootstrap and the given role, in its own checkout under `~/Library/Application Support/AIRevenueExperiment/operators/<id>/`, so it never collides with the main supervisor's checkout.

## 6. Human queue

Owner requests are tasks with `--requires human`. The Founder batches them into the **top section of `OWNER_ACTION_REQUIRED.md`** (≤ 5 min each, exact steps). When done, the operator that asked closes the task and logs the `human` event.
