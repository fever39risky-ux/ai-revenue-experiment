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
