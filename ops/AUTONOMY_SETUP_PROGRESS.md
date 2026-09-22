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
| 13 launchd | PASS: dedicated test service runs 1 → 2 with new PID after SIGKILL; production activation next |
| 14 process termination | PASS: isolated mock Claude SIGKILL, successor started; productive Claude not killed |
| 15 windows closed | Pending user one-step-at-a-time closure test after production activation |
| 16 several-day observation | Not yet elapsed; cannot claim continuous multi-day work or real revenue |

Current production state: not yet installed/started. First real run follows setup
publication and launchd test. Revenue remains JPY 0; known official cost JPY 6882;
subscription compute attribution is unknown, not zero. No sale claimed.

USER BLOCKER: none for setup; OAuth completed. Window-closure test will need the user.

Use ops/AUTONOMY_LOCAL_MAC.md for inspect/stop/resume and logging limits. All private
runtime/log paths are gitignored; no credentials included in the LaunchAgent.
