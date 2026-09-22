# Local Mac autonomy setup — 2026-09-23

Scope: macOS local only. No cloud infrastructure created. Dedicated local Claude
checkout keeps the existing Codex checkout intact. This is setup, not revenue work.

| Phase | Status / evidence |
|---|---|
| 0 environment | Done: macOS 26.5.2 arm64; Claude 2.1.278; Git 2.50.1; Node 24.15.0; jq 1.7.1; Python 3.14; caffeinate/shlock available; GitHub push/admin permission verified |
| 1 canonical state | Done: origin/main fetched; required protocols, ledgers, current status and recent events inspected; no existing local supervisor |
| 2–10 architecture | Implemented: dedicated checkout, state, prompt, shell entry points, kernel lock, sleep prevention, metadata-only logs, healthcheck, generated valid LaunchAgent |
| 11 Claude smoke | PASS: AUTONOMY_TEST_OK; AUTO permission-mode PASS: AUTONOMY_AUTO_OK; owner completed Claude Pro OAuth |
| 12 supervisor | PASS: 14 tests, including normal restart, nonzero backoff, verified goal, false goal, human-only vs other work, invalid JSON/type, fetch failure preservation, duplicate rejection, SIGKILL child recovery, parent crash lock inheritance, rate limit and secret suppression, real local Git fast-forward/dirty preservation |
| 13 launchd | PASS: test runs 1 → 2 after SIGKILL; deliberate stop remained exit 0/runs 2. Test agent then removed. Production agent is running. |
| 14 process termination | PASS: isolated mock Claude SIGKILL, successor started; productive Claude not killed |
| 15 windows closed | Pending user one-step-at-a-time closure test after production activation |
| 16 several-day observation | Not yet elapsed; cannot claim continuous multi-day work or real revenue |

Production activated at 2026-09-23 01:52 JST: launchd PID 73060, managed Claude count 1,
healthcheck passed, main 0 ahead/0 behind at activation, caffeinate idle-sleep assertion
confirmed. Initial Documents location had macOS background-shell access denial; moved
the dedicated public checkout to ~/Library/Application Support/AIRevenueExperiment/repo.
No macOS privacy settings were weakened. Initial CLI run is active; its productive
completion and automatic production restart are still to be observed. A 6-hour thread
heartbeat (mac-claude) observes runtime/business evidence and alerts on meaningful changes. Revenue remains JPY 0; known official cost JPY 6882;
subscription compute attribution is unknown, not zero. No sale claimed.

USER BLOCKER: OAuth completed. Awaiting first window-closure step: close Terminal
if open, or report it was not open. Chrome closure and elapsed-window verification follow.

Use ops/AUTONOMY_LOCAL_MAC.md for inspect/stop/resume and logging limits. All private
runtime/log paths are gitignored; no credentials included in the LaunchAgent.
