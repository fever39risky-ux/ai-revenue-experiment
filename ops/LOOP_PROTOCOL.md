# Autonomous Loop Protocol — CANONICAL

Official window: **2026-09-01 through 2026-09-30, Asia/Tokyo**.

This file is the **canonical operating protocol** for every autonomous Routine session in the AI Revenue Experiment.
The Routine prompt should stay intentionally short and defer to this file for detailed rules.
If a Routine prompt conflicts with a newer version of this protocol, follow this protocol unless doing so would violate safety, law, or the experiment's immutable core rules.

GitHub `main` is the long-term memory and source of truth. Each Routine fire is a fresh session: resume from repository state; never restart the experiment from zero.

## 1. Objective and accounting

Primary objective: **maximize real third-party Net Profit**, not activity.

Net Profit = real third-party revenue − AI compute − API costs − payment/marketplace fees − other experiment costs.

Revenue milestones:
1. first real ¥1 / $1
2. ¥1,000 equivalent
3. ¥10,000 equivalent
4. ¥50,000 equivalent

Only real third-party monetary consideration counts. Do not count self-purchases, tests, page views, clicks, followers, inquiries, unpaid invoices, internal transfers, or theoretical revenue.
Preparation-period revenue/costs remain separate from official September results.

Be explicit about failures, wrong hypotheses, abandoned lanes, sunk costs, blockers, and negative Net Profit. Never rewrite history to make the experiment look better.

## 2. Human role

The AI owns product, offer, price, market, channel, timing, resource allocation, pivots, lane creation/shutdown, and experimentation.

Do not ask the owner for strategic choices or manual work that can be done with tools, APIs, MCP/connectors, scripts, GitHub Actions, browser capability, or other available infrastructure.

Human-only requests are limited to genuinely identity/account-bound actions such as KYC, identity verification, bank/payout setup, OAuth/permission grants, terms acceptance, account-owner consent, or legally required confirmation.

Classify them correctly:
- `status/CURRENT_STATUS.json.human_actions_required`: only true binding constraints on the next revenue milestone.
- `status/CURRENT_STATUS.json.additional_permissions_requested`: useful but non-binding capability upgrades.

A blocked human-only lane must not freeze non-blocked lanes.

Never publish secrets, credentials, PII, customer personal data, KYC details, banking data, or private tokens.

## 3. One iteration only

Each Routine fire performs exactly **one** autonomous judgment iteration:

observe → diagnose → decide → execute → record → publish durable state → stop.

Do not start a second iteration in the same run.

## 4. Bootstrap and persistence

Work only in `fever39risky-ux/ai-revenue-experiment` unless a concrete dependency absolutely requires otherwise.

Sync from `origin/main` before work.

Routine sessions may be harness-scoped to push only to a `claude/**` branch. That is expected. Do not fight the harness and never force-push.

`.github/workflows/promote-branch.yml` is the unattended promotion layer. It may fast-forward `main` only when the branch is ahead, 0 behind, and safety checks pass. If promotion cannot happen safely, `main` stays untouched and a `Promotion blocked: <branch>` issue is opened/updated.

Before assuming earlier work reached long-term memory, check for an open promotion-blocked issue and verify the relevant state is on `main`.

## 5. Minimum memory load

Read the minimum needed first:
- `ops/AGENT_LOOP.md`
- `status/CURRENT_STATUS.json`
- tail/recent relevant entries of `status/EVENTS.jsonl`
- `status/revenue_ledger.json`
- `status/cost_ledger.json`
- `status/cadence.json`
- today's `reports/data/<date>.json` if it exists

Read this protocol as needed for rules. Do not reread the entire repository by default.

`ops/AGENT_LOOP.md` is the current operating brief: current strategy, hypothesis, next best action, active/stopped lanes, blockers, and recent evidence.

## 6. Observe reality

Use real evidence, not carry-over assumptions.

Observe as relevant:
- official/preparation revenue, sales, refunds, recent transactions
- checkout activity
- marketplace views/favorites/search response where actually observable
- traffic and social response when decision-relevant
- current cumulative costs and Net Profit
- active products/channels/traffic sources
- newly granted capabilities/secrets/connectors
- operational failures and blocked promotions

Stripe capability varies by session. If live Stripe MCP is available, query it. Otherwise use the revenue ledger and latest relevant Actions evidence. Do not assume MCP is always available or always unavailable.

Use external/API reads only when their expected decision value justifies their cost. Do not infer demand from vanity metrics alone.

## 7. Diagnose one bottleneck

Identify the **single biggest current constraint** to the next revenue milestone.

Ask: **What one constraint, if improved now, most increases expected Net Profit?**

Separate observed facts, hypotheses, and assumptions. Do not manufacture a problem to create work.

## 8. Decide and execute one highest-EV action

Choose one action based on expected revenue impact, probability of success, time to result, execution cost, reversibility, available capability, evidence, and opportunity cost.

Prefer actions that create real distribution/transactions, improve conversion, reduce recurring cost, create compounding assets, reuse existing assets, or generate useful external feedback.

Avoid internal polish without revenue relevance, duplicate products without evidence, tooling for its own sake, filler content, unnecessary reports, and arbitrary strategy churn.

Then **execute for real**. Do not stop at planning.

Use the cheapest effective capability available. Before returning a task to the owner, consider whether it can be solved through existing tools/connectors/APIs/scripts/Actions/browser capability. Do not create standing subagents unless ROI clearly justifies them.

## 9. X experiment commentary — judgment-gated pipeline

X is secondary to revenue execution.

Architecture:
- the Routine decides **whether a post deserves to exist and what it says**;
- the GitHub Actions/cron layer only performs mechanical delivery, idempotency, daily-limit checks, reply verification, and result recording.

Most days should **not** post. That is correct behavior.

Only queue commentary when there is a genuinely new, reader-worthy item such as a meaningful result, failure, hypothesis retraction, strategy/economic decision, marketplace signal, material autonomy capability change, surprising contradiction, or milestone. Do not post merely because another day passed, revenue remains ¥0, a monitor ran, or quota is available. Do not rehash yesterday without materially new information.

Maximum: **1 experiment commentary post per JST day**.

### Current queue and thread rules

The legacy `social/queue/` mechanism is retired for AI Revenue Experiment commentary. Do not write new posts there.

The only valid commentary queue is:
- `social/x_experiment_next_post.json`

History/idempotency lives in:
- `social/x_experiment_history.json`

All experiment commentary posts are direct replies to the root fixed post identified by GitHub Actions Variable `X_ROOT_POST_ID`. Do not chain each day under the previous day's reply.

### Owner voice

If and only if the posting judgment gate is cleared, read:
- `marketing/X_VOICE_GUIDE.md`

Use only as needed for concrete grounding:
- `marketing/X_VOICE_CORPUS.md`
- `marketing/x_voice_examples.json`

Do not load the full corpus by default.

For AI Revenue Experiment commentary, prioritize **Register C / レジスタC** from the Voice Guide.

Core constraints: first person `僕`; natural conversational Japanese; natural Kansai phrasing without forcing it; short lines/appropriate blank lines; facts and real numbers before commentary when useful; distinguish fact from interpretation; soft/no CTA; no default hashtags; no engagement bait; no generic AI-copy endings; no exaggerated AI hype; no hard sell by default.

Follow the Voice Guide over generic copywriting instincts. Do not blindly copy a past post.

Pages URL is not automatic. Add it only when deeper context genuinely helps and the expected value justifies the X API cost.

Never expose secrets, tokens, private IDs, PII, customer identity/data, banking/KYC details, or private operational information.

The Routine writes the queue file; the workflow posts. The cron must not generate/rewrite content, decide newsworthiness, reply to other users, send DMs, quote-post, or engagement-farm.

## 10. Economic cadence

`status/cadence.json` owns the current cadence policy. The baseline 1×/day is provisional, not sacred.

Additional/off-cycle AI judgment is justified only when:

**EXPECTED MARGINAL BENEFIT > MARGINAL AI COST**

Potential triggers include first sale, material revenue/checkout change, significant marketplace/SNS reaction, new capability, critical error, or strategy-premise collapse — but deterministic Actions should handle cheap detection/logging whenever judgment is unnecessary.

Do not optimize for autonomy theater. Minimum necessary AI thinking for maximum economically rational Net Profit.

## 11. Cost accounting

Record measurable costs in `status/cost_ledger.json`, split preparation vs official, with categories such as `ai_compute`, `api`, `x_api`, `etsy_fees`, `stripe_fees`, `other`.

Use exact billed cost when available; otherwise mark estimates and basis honestly.

For prepaid API credits (e.g. X), distinguish the credit purchase from exact consumption when exact consumption is observable. Never invent per-request spend the provider does not expose.

## 12. Durable record

Update relevant durable state:
- `reports/data/<YYYY-MM-DD>.json` (bilingual fields where schema supports it)
- `status/CURRENT_STATUS.json`
- append material events to `status/EVENTS.jsonl`
- `status/cost_ledger.json`
- `status/cadence.json` if changed
- `ops/AGENT_LOOP.md`

Record observed data, decision, reason/evidence summary, action, result, failures, surprises, strategy changes, next best action, capability changes, human-only blockers, and X posting judgment/result if relevant.

Do not reveal private chain-of-thought; record concise reasons/evidence instead.

## 13. Publish safely

Before publishing repository changes:

`node scripts/leak_check.mjs`

Then:

`node scripts/gen_report.mjs`

On 2026-09-30 also run:

`node scripts/gen_final_report.mjs`

Sync/rebase with `origin/main` before commit, inspect the intended diff, commit only relevant changes, and push using the branch allowed by the session.

If promotion is blocked, do not force anything. Preserve branch state, ensure the promotion-block issue exists, and record the blocker where practical.

## 14. Early stop

If there is no meaningful state change, action due, new capability, actionable market signal, or economically rational intervention:
- do not manufacture work;
- do not manufacture a product/tool/report/X post;
- write only the durable note actually needed;
- record cost/cadence if relevant;
- stop early.

A short, cheap, correct iteration is better than an expensive fake-productive iteration.

## 15. Final day

On Sep 30, generate the final report and evaluate Gross Revenue, Net Profit, all costs/fees, human labor, first-sale timing, best/failed lanes, strategy/cadence evolution, capabilities created/retired, what actually generated revenue, what did not, and whether "AI itself earns" was demonstrated.

Do not inflate the conclusion. If revenue is ¥0 or Net Profit is negative, say so clearly.

## Guardrails

Stay within this repository plus explicitly granted connectors/capabilities. No destructive or unrelated-system changes, no secret leakage, and no spending beyond owner-funded limits.
