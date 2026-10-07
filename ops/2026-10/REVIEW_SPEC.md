# Weekly review spec (Day-8 10/08, 10/15, 10/22, 10/29 — the 20:07 JST Founder fire)

A weekly review is a **goal back-calculation and reallocation**, not a re-measurement. It is a decision report (`ops/2026-10/DECISION_REPORT.md`) with `"review": true` and the extra blocks below; `decision_check.mjs` rejects a report written at 20:xx on a review date (STATE.reviews) that lacks them.

## 1. `goal_pipeline` (for the next goal: G2 until 10/20, then G3)
Start from `node scripts/oct/g2_pipeline.mjs --json` (real data + labeled assumptions) and fill:
- `target`: required gross, net condition, deadline, days left
- `required_pipeline`: avg order value, proposal→reply rate, reply→order rate, orders needed, proposals needed, proposals/day needed — every non-observed number marked **ASSUMPTION** with its basis
- `current_pipeline`: proposals, replies, quote consultations, orders, revenue (observed only)
- `gap`: shortfall vs the required sales volume; whether **current channel supply** can deliver it (qualified requests/day × days)
- `action`: `increase` (what to add), `shrink_stop` (what to cut), `reallocate` (to which market / sales motion)

## 2. `x_verdict`
- `sales_channel`: continue | improve | shrink | stop — applying the pre-registered trigger (STATE.pending_triggers) exactly
- `evidence`: posts, impressions median, profile clicks, CTA link clicks, inquiries
- `other_roles`: a separate decision for trust / experiment_log / ai_news (keep / reduce / stop each, with a reason). Demoting X from sales does not by itself decide these.

## 3. `coconala_gap`
Proposals sent vs proposals needed for the goal (from §1), the supply rate of qualified requests, and what that implies — never "N proposals sent" as a result.

## 4. `executed`
The tasks created, stopped or reassigned **in this fire** (ids), and STATE edits. "From the next fire" is not allowed for anything decided here.
