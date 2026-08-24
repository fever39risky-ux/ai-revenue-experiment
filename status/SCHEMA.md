# Logging Contract

This file defines the minimum interface between Claude Code, the experiment repository, and OPP observers.

## 1. CURRENT_STATUS.json

Claude Code should update this whenever the material state changes, and at minimum once per active experiment day.

Required semantics:

- `experiment.day`: current Day number
- `updated_at`: ISO 8601 timestamp
- `revenue`: actual verified revenue only
- `active_lanes`: currently active monetization lanes; Claude decides them
- `current_focus`: where Claude is currently allocating attention
- `current_action`: what Claude is doing now
- `next_action`: Claude's currently intended next step; may change autonomously
- `latest_result`: latest observed real-world result
- `latest_strategy_decision`: latest strategy/resource-allocation decision and rationale
- `blockers`: technical, legal, platform, or market blockers
- `human_actions_required`: only actions genuinely impossible for AI to perform lawfully/technically
- `additional_permissions_requested`: access/connector/API/browser permissions that would reduce human labor
- `opp_support_opportunities`: optional work OPP could perform or surface; suggestions only
- `human_labor_minutes_total`: cumulative human labor consumed by the experiment

Do not encode externally imposed lane priorities. Claude Code owns priorities and resource allocation.

## 2. EVENTS.jsonl

Append one JSON object per material event. Do not rewrite historical events except to correct an objective recording error.

Recommended event types:

- `experiment_started`
- `lane_started`
- `lane_stopped`
- `strategy_changed`
- `resource_reallocated`
- `product_created`
- `product_published`
- `content_published`
- `affiliate_applied`
- `affiliate_approved`
- `first_click`
- `first_sale`
- `affiliate_conversion`
- `revenue_received`
- `cost_incurred`
- `human_blocked`
- `permission_requested`
- `experiment_milestone`

Suggested shape:

```json
{"type":"strategy_changed","timestamp":"...","day":3,"actor":"claude-code","details":{"from":"...","to":"...","reason":"observed data..."}}
```

## 3. RESULTS_LEDGER.md

Record only realized or verifiable outcomes.

Revenue means actual third-party monetary consideration or earned affiliate/ad/sponsor compensation. Do not count:

- page views
- clicks
- followers
- inquiries
- unpaid invoices
- theoretical revenue

Also record explicit experiment costs and human labor minutes so profitability and autonomy can be evaluated.

## 4. DAILY/YYYY-MM-DD.md

Daily logs should be concise but sufficient to reconstruct Claude Code's reasoning from observable evidence without requiring hidden chain-of-thought.

Recommended headings:

- Experiment Day
- Objective at start of day
- Actions executed
- External observations / metrics
- Revenue / cost / human labor today
- Decisions made
- Lanes expanded / reduced / stopped
- Current blockers
- Human-only actions required
- Next planned action
- OPP support opportunities

Record reasons and evidence summaries, not private hidden reasoning.

## 5. OPP consumption rule

OPP should normally read `CURRENT_STATUS.json` first. It should read `EVENTS.jsonl` for important transitions and DAILY logs only when deeper context is required. This minimizes unnecessary LLM/API usage.

OPP is initially read-only. It must not overwrite Claude Code's strategy or state unless a later explicit protocol is introduced.
