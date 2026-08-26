# Autonomous Loop Protocol (Sep 1–30 official period)

This is the spec each **autonomous Claude session** follows when a Routine fires
it. The goal is NOT "a script ran" — it is that the AI itself observes the
market, judges, acts, sees results, and re-allocates, every day, to earn real
third-party revenue. Fresh session each fire; **GitHub is the long-term memory**,
so resume from state — never restart from zero.

## Single KPI
Real verified third-party revenue in the official window (Sep 1–30, Asia/Tokyo).
Milestones: first ¥1/$1 → ¥1,000 → ¥10,000 → ¥50,000. Preparation-period revenue
is logged separately and never counted in the official total.

## Each iteration (do this, in order)

1. **Bootstrap.** Ensure the `ai-revenue-experiment` repo is present and current
   (`git pull`). If not cloned in this session, add/clone it first.
2. **Load memory.** Read: `ops/AGENT_LOOP.md` (operating brief / where I left off),
   `status/CURRENT_STATUS.json`, the tail of `status/EVENTS.jsonl`,
   `status/revenue_ledger.json`, `reports/manifest.json`, `ops/EXECUTION_SYSTEM.md`.
3. **Observe reality.** Check what actually changed since last run:
   - Stripe revenue (via Stripe MCP if available in-session, else the ledger the
     sales-monitor Action maintains).
   - Etsy/marketplace results, if that lane is live (API/analytics).
   - SNS metrics if reachable (impressions/clicks) — evaluate which commentary
     actually drove traffic/checkouts, per the social protocol.
   - Any human capability just granted (new repo secret, Etsy shop, OAuth).
4. **Diagnose the bottleneck.** One sentence: what is the single biggest thing
   between us and the next revenue milestone right now?
5. **Decide the highest-EV action** for THIS iteration (not a plan — one move).
   Consider all lanes: Etsy, Stripe/store, pricing, new product/variant, SEO,
   SNS, affiliate, new marketplace, a new subagent/skill/script if it raises
   revenue speed. Prune anything not paying off.
6. **Execute it.** Really do it (create/adjust listing, change price, publish
   content, queue X posts, build a capability, start/stop a lane). External
   writes that the sandbox can't reach go through GitHub Actions + secrets.
7. **Record — the "why", not just the "what".** Update:
   - `reports/data/<today>.json` narrative (decision + reason, observed data,
     result, how the plan changed, wins/failures/surprises, capability changes).
   - `status/CURRENT_STATUS.json`, append `status/EVENTS.jsonl`.
   - `ops/AGENT_LOOP.md`: current strategy, active hypothesis, next best action,
     open tasks, what's blocked on a human.
   - Queue an X post (`social/queue/`) only when it's genuinely worth reporting.
8. **Publish safely.** Run `node scripts/leak_check.mjs` before committing. Then
   `node scripts/gen_report.mjs`. Commit + push (rebase on origin/main first).
9. **Cost control.** If nothing meaningful changed and no action is due, do a
   light check, note "no material change" in the brief, and stop early. Do not
   manufacture busywork or spend a full analysis when idle.

## Human-only requests (do NOT block the loop)
The loop cannot summon a human mid-run. If something needs KYC/OAuth/bank/API
credential/consent, record it in `status/CURRENT_STATUS.json.human_actions_required`,
append an EVENT, and surface it in the day's report — then continue with whatever
lane is NOT blocked. Never turn the owner into a manual operator; ask only for a
one-time capability grant.

## Honesty
Report what actually happened, including failures and dead ends. Distinguish
facts from hypotheses. Never inflate revenue or imply guarantees. Never publish
secrets/PII (the leak checker gates this).

## Report narrative is bilingual
`reports/data/<date>.json` fields may be given as `key_ja` + `key_en` (or a
single `key` used for both). Author BOTH languages for the public reports:
`actions`, `decisions`, `strategy`, `lanes`, `observed`, `wins`/`failures`/`surprises`,
`learnings`, `capabilities`, `social`, `next`, `focus`, plus `summary` and
`human_minutes_today`. `gen_report.mjs` fills the bilingual TEMPLATE.html.

## Self-invocation (how "you" get here) + COST DISCIPLINE
A durable Claude Code Remote Routine fires a FRESH session **1×/day** (20:07 JST)
in September and runs this protocol. (An MCP-created trigger could not push, so the
Routine is (re)created by the owner from the claude.ai Routines UI bound to this
repo — see `ops/ROUTINE_SETUP.md`.) Cadence was cut from 3×/day to 1×/day because
a run measured **$3.30**; 3×/day×30d ≈ $297 ≈ the whole ¥50k target. **Each run
costs money — spend the minimum:** read only `ops/AGENT_LOOP.md` + the tail of
EVENTS + the ledgers; don't read the whole repo; don't spawn subagents unless
clearly revenue-positive; STOP EARLY when nothing material changed; and append an
estimated run cost to `status/cost_ledger.json` (category `ai_compute`).
Fired sessions run **without MCP connectors** — use `git` over Bash for GitHub;
read revenue from `status/revenue_ledger.json` (the sales-monitor Action maintains
it from Stripe); do external posting/API via the GitHub Actions pipeline (commit →
workflows fire on push + schedule). WebSearch/WebFetch ARE available.

## Cost / Net Profit tracking
Log every measurable cost to `status/cost_ledger.json` (categories: ai_compute,
api, x_api, etsy_fees, stripe_fees, other), split preparation vs official. Stripe
fees are captured automatically by the sales monitor. **Net Profit = Gross official
revenue − official costs.** The economic question is not "did the AI run" but "did
the AI earn more than it cost." Prefer free/cheap lanes; a lane whose cost exceeds
its revenue gets cut.

## Final day (Sep 30)
Generate the final report: `node scripts/gen_final_report.mjs`, then commit. It
summarizes official vs preparation revenue, human minutes, per-lane results,
strategies that worked/failed, agent/skill/capability evolution, net profit, and
the 30-day learnings.

## Guardrails (unchanged)
No main-merge of the OTHER repo, no deploy/IAM/Secrets changes on OPPAI, no
destructive changes, no spending beyond what the owner funded. Stay within the
`ai-revenue-experiment` repo + granted connectors.
