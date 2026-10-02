# Phase-2 Mac supervisor — automatic wake-up for `mac-local`

Goal: when the Founder (cloud) creates a `mac-local` task on GitHub main, the Mac starts a Claude Code operator **by itself** — no terminal, no owner — and the task goes
**claim → execute → log → done → push**, visible to the Founder on main.

## 1. Why the September supervisor stopped (root cause, 2026-09-26)

1. Run 135 (commit `21b0073`, 2026-09-26 11:14Z) wrote a free-text `stop_reason` (`"no_positive_ev_ai_operable_work: …"`) into `status/AUTONOMY_STATE.json`.
2. `scripts/autonomy_supervisor.py::validate()` accepts only six enum values → raises `invalid_stop_reason` (reproducible today: `validate()` on main still raises it).
3. The run loop treats any validation error as a **safe stop** and returns **exit code 0**.
4. The LaunchAgent uses `KeepAlive: {SuccessfulExit: false}` → launchd restarts only on non-zero exits → **a clean exit is permanent**. The last supervisor run ended 2026-09-26T08:27Z; nothing restarted it.

Structural lesson: every "safe stop" in that design (invalid state, auth missing, goal/human-only decision) was a silent, permanent death, and it depended on a September business-state file. The Phase-2 supervisor removes both properties.

## 2. Design

| Requirement | Implementation (`scripts/oct/mac_supervisor.py`) |
|---|---|
| Resident on the Mac | LaunchAgent `com.airevenue.phase2.mac-local`, `RunAtLoad` + **`KeepAlive: true`** (restarted after any exit, 60 s throttle) |
| Pull main periodically | every 120 s: `fetch` + `merge --ff-only` in a **dedicated checkout** `~/Library/Application Support/AIRevenueExperiment/operators/mac-local/repo` |
| Detect mac-local tasks | `status/2026-10/tasks/*.json` not done, `not_before` passed, `after` deps done, not leased live by another operator, and `assigned_to == mac-local` **or** all `requires` ⊆ {`local_browser`}; `requires: human` is never auto-started |
| Start an operator when needed | if eligible tasks exist (incl. its own claimed task left by a crashed worker) → start **one** `claude -p` worker with the Phase-2 prompt (BOOTSTRAP as `mac-local`, task ids listed) |
| No double start | `fcntl` lock on the state dir (second instance exits 75); one worker at a time; worker timeout 120 min (process-group kill) |
| Respect claim / lease | eligibility skips live leases of others; worker must `ops.mjs claim` before work (rejected claim → skip) |
| Crash / failure | exponential backoff 60 s → 1 h (rate limit ≥ 15 min, + jitter); heartbeat `status: blocked, blocked_on: <kind>` pushed so the Founder sees it; unexpected exceptions are caught and backed off — the loop never exits on a business condition |
| Results to GitHub | worker commits/pushes; afterwards the supervisor rebases + pushes any commits left behind (never force); idle liveness heartbeat every 120 min |
| Owner only for password/2FA/KYC | worker releases a task that hits a login, creates one `--requires human` task with the exact 2-minute step, heartbeats `blocked_on: "<site> login"` |
| Browser isolation | worker gets **its own** Playwright MCP server (`@playwright/mcp@0.0.83 --browser chromium --user-data-dir ~/Library/Application Support/AIRevenueExperiment/browser-profiles/mac-local`) via `--mcp-config … --strict-mcp-config`; the Coconala/BOOTH sessions' profiles are never opened or shared |
| No respawn churn | if a worker run leaves the same eligible task set unchanged (e.g. every task waits on an owner login), that set is **held** for 5 → 10 → … → 60 min instead of starting a new Claude worker every poll; the hold clears as soon as the set or the open `requires: human` tasks change |
| Code updates | `--self-update`: when `mac_supervisor.py` changes on main, the process exits and launchd restarts it with the new code |
| Privacy | metadata-only log `…/operators/mac-local/state/supervisor.log` (events, exit codes, byte counts; no model output, no secrets) |

The September agent `com.airevenue.claude-autonomous` is booted out and **disabled** by the installer (reversible with `launchctl enable gui/$UID/com.airevenue.claude-autonomous`), so two supervisors never act as `mac-local`.

## 2b. Browser policy (owner request 2026-10-02: no stray Chrome for Testing windows)

Problem seen on the real Mac (01:19–02:47 JST 10/02): a worker started every ~2–3 min and each opened Chrome for Testing just to re-check logins. Causes: (a) Playwright artifacts in the checkout made `git status` non-empty → every poll was a "recovery" run, and recovery bypassed the no-progress hold; (b) released login-blocked tasks were immediately eligible again; (c) nothing forbade login-only checks; (d) workers collided with the owner's open login window on the same profile.

| Rule | Mechanism |
|---|---|
| No browser for heartbeat / polling / task checks | the supervisor itself never starts a browser; a worker gets an **empty MCP config** unless one of its tasks has `requires: local_browser` (it cannot start Chrome at all) |
| No browser just for login/session checks | worker prompt forbids it; a logged-out page → `release <task> --blocked-by <owner-login-task>`, no retry |
| Headless by default, headed only on demand | Playwright MCP gets `--headless` unless a task sets `"browser": "headed"` (`ops.mjs task-new … --browser headed`) |
| Logged-in sites are not re-checked | login is verified only by the next real task; no periodic checks exist |
| Owner-login waits are not eligible | `blocked_by` tasks are skipped until the owner task is done |
| Owner task completes itself | while the owner's window holds a dedicated profile the supervisor starts no browser worker; when the window closes it marks the owner tasks that reference `browser-profiles/<name>` done and logs a `human_intervention` with the measured minutes |
| No rapid relaunch | ≥ 10 min between browser workers (`--browser-min-gap-sec`), no-progress hold 5 → 60 min, **persisted** in `state/hold.json` across restarts |
| No recovery churn | dirty check ignores untracked files (`--untracked-files=no`); Playwright output goes to `state/playwright-output/` (outside the checkout); `.playwright-mcp/` is git-ignored; recovery runs never get a browser |
| Evidence | idle heartbeats carry `progress: polls=… workers=… browser_workers=… chrome_for_testing_procs=…`; one extra heartbeat 6 min after each supervisor start |

## 2c. Per-site dedicated profiles (owner correction 2026-10-03)

Logins live in **dedicated, per-site profiles** that were created and logged in when each listing was published. Tasks are routed to them and never to a shared profile:

| Site | Profile (reused as-is; never merged, recreated or used for another site) | Task routing |
|---|---|---|
| Coconala | `~/Library/Caches/ms-playwright-mcp/mcp-chrome-*` (the profile used to publish 4426150; exactly one match, or pin it in `state/profiles.json`) | `profile: coconala`, or `site`/lane/id containing "coconala" → MCP server `playwright-coconala` |
| BOOTH | `~/Library/Caches/ms-playwright-mcp/booth-profile` | `profile: booth` / "booth" → `playwright-booth` |
| note | `~/Library/Application Support/AIRevenueExperiment/browser-profiles/note-profile` | `profile: note` / "note" → `playwright-note` |
| new / generic sites | `…/browser-profiles/mac-local` | everything else → `playwright` |

- A task may name several profiles (e.g. `h3-marketplace-snapshot`: `["coconala","booth"]`); the worker gets only the servers its tasks need.
- **Profile safety:** the browser is chosen from the profile's `Last Version` (same major version; never an older browser, which would downgrade/corrupt it). A profile held by another process (an interactive Coconala/BOOTH session, the owner) is never opened; only that task waits.
- **Waiting is visible:** if a task's dedicated profile is open in another process, the supervisor heartbeats `blocked_on: "<site> profile in use"` (at most every 30 min) instead of silently waiting.
- **No login sweeps:** login is checked only by the task's own page load. If that page is logged out, the worker files **one request for that single site** (with its profile path), never a combined multi-site re-login request.

## 3. One-time installation (Constitution Art. 9 "permission": installing a resident agent on the owner's Mac)

On the Mac, from any checkout of this repo (or ask a local Claude session to run it):

```
git pull && python3 scripts/oct/install_mac_supervisor.py --install
python3 scripts/oct/install_mac_supervisor.py --status
```

Log it once as `node scripts/oct/ops.mjs human mac-local --minutes 2 --category permission --reason "installed Phase-2 Mac supervisor LaunchAgent"`. After this, no owner action is needed for any mac-local task except a site login/2FA.

## 4. Verification (real machine)

Task `mac-roundtrip-1` (assigned to `mac-local`, no browser, created by the Founder) is on main. With the agent loaded, expected within ~2–5 minutes, with zero human input:

Founder task on main → supervisor poll detects it → Claude worker starts → `heartbeat` → `claim` → executes (runs the coordination tests, records versions) → `done` → push → Founder sees `status: done` + `mac-local` heartbeat on main.

Then `ops-verify-local-browser` (P1, local_browser) runs the same way and proves the dedicated Playwright profile path.

Tests (no Mac needed): `python3 tests/test_mac_supervisor.py` — eligibility rules, a full Founder→supervisor→worker→push→Founder round trip against a bare git remote with a protocol-faithful fake worker, and failure → backoff → `blocked` heartbeat.

## 5. Real-machine results

- 2026-10-02 01:42 JST — `mac-roundtrip-1`: Founder task → supervisor detected → worker auto-started (`PHASE2_OPERATOR=mac-local`) → heartbeat → claim → tests PASS → done → push (`ee7e4ac`). Zero human input after the one-time install.
- 2026-10-02 01:44–01:48 JST — the same worker continued on its own: `ops-verify-local-browser` done (Playwright MCP + dedicated profile work; it installed the missing Chromium build itself), sites logged out → one batched owner login task; H1 public screen (~95 requests, 0 GO) and H3 public baseline recorded; ended E2 (`02d9888`).
- 2026-10-02 06:37–06:43 JST (browser policy, real Mac) — the supervisor self-updated to `d8cda43` and restarted at 21:37:18Z. Its 6-minute heartbeat (`72e7ef3`, 21:43:26Z) reports `polls=4 workers=0 browser_workers=0 chrome_for_testing_procs=0`. No eligible task: h1/h3 `blocked_by owner-login-mac-local-profile`, h2 `blocked_by owner-note-login-satotsu1020`. The last old-code worker ran at 06:35 JST, before the restart.
- 2026-10-03 00:41–00:43 JST (per-site routing, real Mac) — h2 ran on `note-profile` via `playwright-note`: logged in, but as kinoshitat0904 rather than the granted @satotsu1020 → not published; one note-only owner request. h1/h3 were eligible but not started in that run (most likely deferred because their dedicated profiles were open in another process); since `4024af3` that wait is reported in the heartbeat.
