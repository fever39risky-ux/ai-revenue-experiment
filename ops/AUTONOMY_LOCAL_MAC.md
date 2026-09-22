# Mac-local continuous Claude operator

Dedicated checkout: `~/Library/Application Support/AIRevenueExperiment/repo`.
The initial Documents location was refused to background bash by macOS privacy
controls. The dedicated public-repository checkout was moved to the standard user
application-data directory; no privacy settings or private Documents permissions were changed.

No cloud VM/systemd. Requires logged-in macOS user and open, powered Mac.
`launchd` owns the supervisor; the supervisor owns one Claude worker at a time.
`caffeinate -i -s -w PID` prevents idle system sleep; it does not override lid closure,
shutdown, logout, depleted battery or power loss. Display sleep is allowed.

## Start, inspect, stop

Install once: `python3 scripts/install_autonomy_launchagent.py --install`.
Health: `scripts/autonomy_healthcheck.sh`.
Inspect: `launchctl print gui/$(id -u)/com.airevenue.claude-autonomous`.
Stop intentionally: `launchctl bootout gui/$(id -u)/com.airevenue.claude-autonomous`.
After repairing a stopped state: `launchctl kickstart gui/$(id -u)/com.airevenue.claude-autonomous`.
Do not use `kickstart -k` on productive work. Removal of the plist disables login startup.

## Lifecycle and persistence

The shell resolves its absolute checkout path. Python standard-library `fcntl.flock`
is available on macOS (no Linux flock binary required). The lock file is never deleted:
locking an inode, not interpreting a stale PID, prevents PID-reuse/racy stale-lock bugs.
A worker retains the same kernel lock until Claude exits, including parent crashes.
Duplicate supervisors exit 75. launchd throttles abnormal supervisor restarts to 60s.
`KeepAlive.SuccessfulExit=false` restarts crashes while deliberate safe stops exit 0.
Claude exit 0 does NOT terminate the supervisor. Minimum next-run interval is 60s;
Three repeated unchanged HEAD/next_action results lengthen the restart interval
(up to one hour) without declaring a human blocker. Failures back off exponentially (60s base, rate limit 900s, maximum 3600s + jitter).

Each cycle fetches main, fast-forwards clean work, reads state and the revenue ledger,
then launches `claude -p --permission-mode auto --permission-prompts none` using the
locally verified CLI. No permission bypass. A denied action must be persisted and an
alternative attempted; permissions are not silently broadened. No session persistence.
OAuth is in Claude's existing credential storage, never the plist/repo/environment.
CLI home/account settings still apply; don't configure secret-dumping hooks.

Dirty or divergent local work is preserved for the next Claude recovery session.
No reset/clean/automatic stash/force push. Network fetch failure retries before Claude.
Unexpected remote/branch, invalid state/ledger, or missing authentication stops safely.
GitHub main is canonical only after successful non-forced push and verification.
Frequent Claude checkpoints and exact next_action reduce crash-loss; in-flight context
not committed before a crash cannot be guaranteed durable.

AUTONOMY_STATE is business-owned; runtime exit code, count, failures and run timestamps
are atomically maintained in ignored `.autonomy/`. Claude copies runtime fields when
checkpointing, avoiding supervisor-generated tracked dirt before each git pull.
Canonical next_action is carried forward from CURRENT_STATUS, with newer main evidence
reconciled before acting. Other operators keep their own checkout and lane ownership.
This lock covers this Mac's managed local runner; it does not lock separate cloud Routines.

Goal true requires verified official third-party ledger evidence and matching totals.
Legacy entries must be annotated with verified:true, third_party:true, is_test:false,
reference and period:official after checking real provider evidence. No invented sales.
The local first-JPY-1 goal does not replace the official JPY 50,000 experiment target.
Human-only stop requires both state booleans and human_blocker_evidence. Business
judgment still belongs to Claude and needs audit; a supervisor cannot prove positive EV.

## Logs and economics

`logs/supervisor.log`, `logs/claude-runs/*.json`, `logs/healthcheck.log` and
`logs/launchd.*.log` are ignored, owner-only local files. Supervisor log rotates at 2 MB;
up to 2000 run records are retained. Claude stdout/stderr are consumed in bounded memory
and saved ONLY as sanitized metadata (byte count, timestamps, exit, classified error).
All content is suppressed, including unknown PII. Hashes identify next_action changes;
the actual action remains in canonical state. There is deliberately no raw transcript.
This guarantee covers supervisor-managed logs, not arbitrary files a model/tool chooses
to create; prompt and existing leak checks prohibit secrets in those files too.

Pro subscription usage is not automatically a separately billed API expense. Record
unknown attributable subscription cost as null, reconcile provider billing when possible.
No new paid service or ad spend is authorized by installing this runner. Existing
owner-funded limits and experiment accounting continue to apply.

## Validation and observation

Run `python3 -m unittest discover -s tests -p 'test_autonomy_supervisor.py'`.
Tests use temporary isolated fake operators, including actual process termination.
Never kill a productive Claude for recovery testing. A separate `.test` launchd label
can verify launchd crash recovery using `--test-repo` in an isolated fixture.

Track runtime/run logs, main commits, exact next actions, productive packages, verified
third-party sales and known/unknown Net Profit over several days. No automatic cloud
migration. Setup completion and several-day business validation are separate milestones.

References: https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html
and the installed `claude --help` (2.1.278 on this Mac).
