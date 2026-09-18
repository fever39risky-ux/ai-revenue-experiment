# Codex execution and handoff

## Chosen route (2026-09-18)

Use the desktop app's thread heartbeat and existing ChatGPT/GitHub authentication.
The app must remain running on an awake, connected host. This is **not** an
always-on Cloud runner. No separately billed OpenAI API runner is enabled.
The repository has no OPENAI_API_KEY; the earlier bootstrap commit is not
available in the fetched refs. Do not rebuild an API runner merely to reproduce
that abandoned implementation. Cloud setup authentication was verified, but
Cloud shell push remains unproven. Desktop push and draft PR are proven by PR #6.

## Each wake

1. Fetch origin/main; require a clean checkout and create an isolated Codex branch.
   Inspect recent commits and open PRs/issues before choosing work.
2. Read LOOP_PROMPT.txt, CODEX_OPERATOR.md, the current brief and canonical state.
   Run `python3 scripts/codex_gate.py begin --trigger heartbeat` before business
   execution. It checks the period, persisted pause, next wake, daily run cap,
   consecutive failures and a local process lock. A refusal is not permission
   to bypass the gate. The lock is local: multiple hosts are not supported.
3. Execute ONE hypothesis. Respect Claude's active lane. Existing SNS automations
   also use the owner's X account: check shared scheduling/public history before
   any posting; this repository's history alone cannot prove account-wide freedom.
4. Preserve other operators' report sections. Record facts separately from
   hypotheses and unknowns. Subscription usage has opportunity cost; record
   attributable compute cost as unknown if billing evidence is unavailable, never
   quietly claim a free run. No new paid service, purchase, or API billing route.
5. Update cadence/next wake and the actual heartbeat schedule together. The JSON
   file does not schedule anything by itself. Do not self-message, recursively
   dispatch, or run a second business iteration in this invocation.
6. Finish the gate with `python3 scripts/codex_gate.py finish --result success`
   (or failure); append a concise evidence-bearing entry to EVENTS.jsonl and the
   relevant report. Run leak_check, promotion_check, gen_report and inspect diff.
7. Fetch again, rebase only cleanly; on conflict preserve work and report it.
   Push a branch, create/review a PR, and merge only tested intended changes.
   No force push; use exact-head verification. Verify persisted main after merge.

## Limits and failures

- Default ceiling: two business iterations per JST day; at least the configured
  next-wake interval. The ceiling is a restraint, not a target or spending grant.
- Two consecutive failed business runs stop automatic execution pending diagnosis.
- An interrupted run retains its lock. Inspect the owning process and uncommitted
  work before recovery; do not blindly remove locks or replay external writes.
- September 30 ends normal business execution. Preserve records and prepare the
  final accounting separately; disable the heartbeat after final reporting.
- Existing prepaid capabilities stay within confirmed remaining funded limits.
  Unknown cost or permissions block that external action, not unrelated work.

## Evidence required before completion

Bootstrap is incomplete until a scheduler-originated wake reads the previous
main receipt, executes the due iteration and writes a new receipt to main. An
owner message, goal continuation, manual run or created schedule is not proof of
automatic wake. Record actual start/end, trigger, source main SHA, action,
result, cost confidence, next wake and persisted PR/commit evidence.

## Verified schedule and final accounting

The first real heartbeat arrived 2026-09-18T01:09:22.152Z and resumed the prior main receipt. After validation, daily judgment runs at 10:00 Asia/Tokyo beginning September 19. Stripe can be observed via the existing live-account connector; the Actions key remains absent. Candidate off-cycle triggers are not installed event subscriptions. October 1 at 10:00 is a final-accounting-only wake for September transactions: do not begin a business run (the period gate correctly refuses it), prepare final accounting, then disable the automation.
