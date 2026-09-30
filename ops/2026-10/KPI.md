# October KPI definition & measurement (Phase 2)

Window: **2026-10-01 00:00 JST – 2026-10-31 23:59 JST**. Everything starts at 0 at 10/01 00:00 JST.
Day-0 (09-30) activity is excluded from every KPI below (the tooling enforces this by date).

Live numbers: `node scripts/oct/ops.mjs kpi` (or `board`). Daily snapshot: `reports/2026-10-DD.html` + `reports/manifest-2026-10.json`.

## 1. Official KPI

| KPI | Definition | Source of truth |
|---|---|---|
| **Gross Revenue** | Σ `jpy_equivalent` of entries in `status/2026-10/revenue_ledger.json` dated in window, `third_party != false`, `is_test != true`. Buyer-paid amount before platform fees. USD at ¥150 unless payout says otherwise. | Stripe/Gumroad: automatic (`sales-monitor.yml`, 4-hourly). Coconala/BOOTH/note/Zenn/Etsy: the operator that observes the order books it with `ops.mjs revenue` + provider order id |
| **Cost** | Σ known `jpy_equivalent` in `status/2026-10/cost_ledger.json` in window, **plus** a count of unknown (`null`) entries shown separately | Platform fees (auto for Stripe/Gumroad; Coconala/BOOTH booked manually from the platform statement), X API, ads, AI compute when attributable |
| **Net Profit** | Gross Revenue − known Cost. If any unknown cost exists, Net is reported as an **upper bound** | computed |
| **Human intervention count** | Number of `human_intervention` events in `status/2026-10/events/*.jsonl` in window | §3 |
| **Human working minutes** | Σ `minutes` of those events | §3 |

### Revenue goal ladder (STATE.json `goal`)
- **G1** first third-party ¥ by Day 7 (10/07)
- **G2** Gross ≥ ¥10,000 and Net > 0 by Day 20 (10/20)
- **G3** Gross ≥ ¥50,000 by 10/31, with a repeatable path (≥ 2 orders from the same hypothesis/channel)

Stop-condition 1 (Constitution Art. 8) refers to G3.

## 2. Auxiliary indicators (valid demand signals)

Booked with `node scripts/oct/ops.mjs signal <op> <metric> <count> --channel <c> --evidence "<url / run id / talk-room id>"`. No evidence → not a signal.

| metric | counts when |
|---|---|
| `qualified_reach` | impressions from people plausibly in the target audience (X impressions on series posts, listing views on Coconala/BOOTH) — **weak**, context only |
| `profile_visit` | X `user_profile_clicks` on our posts |
| `link_click` | X `url_link_clicks`, UTM-tagged clicks where observable |
| `follower_delta` | net follower change over a period |
| `inquiry` | a third party messages us about buying / a job (Coconala 見積り相談, BOOTH message, X reply asking about it, email) |
| `proposal_sent` | we submit a proposal to a buyer-posted request (activity, tracked for conversion rate — **not** a demand signal by itself) |
| `sales_conversation` | a buyer replies to our proposal or continues a conversation |
| `checkout_started` | Stripe checkout session created / cart added where visible |
| `order` | paid order (also booked as revenue) |
| `repeat_buyer` | second paid order from the same buyer |
| `valid_demand_signal` | any other third-party action that costs them something, described in `note` |

**Valid demand signals** (used by pivot rules) = `inquiry + sales_conversation + checkout_started + order + repeat_buyer + valid_demand_signal`. Impressions, followers and our own proposals do not count.

Funnel ratios the Founder should watch: proposals → conversations → orders; X impressions → profile visits → link clicks → inquiries/orders; listing views → inquiries → orders.

## 3. Human intervention measurement

**Every** time the owner does something for the experiment, one event is written — by the operator that asked for / observed it, or by the owner's own session if they acted unprompted:

```
node scripts/oct/ops.mjs human <operator-id> --minutes <N> --category <login|2fa|kyc|password|legal|banking|permission|decision|manual_work|other> \
  --reason "what the owner did and why the AI could not" [--avoidable true] [--lane coconala]
```

Rules:
- **Count**: 1 event per distinct owner action (a login + 2FA in one sitting = 1 event, category of the hardest step).
- **Minutes**: owner-reported if known, otherwise the operator's honest estimate rounded **up** to whole minutes (minimum 1). Include waiting-in-front-of-screen time.
- **Also count**: owner answering a strategic question ("which should we do?") → category `decision`, `avoidable: true`. Owner doing browser work that an operator could have done → `manual_work`, `avoidable: true`. These are the failures October is designed to eliminate.
- **Not counted**: the owner reading reports / X by choice without acting.
- Unprompted owner messages that direct strategy count as `decision` interventions (they indicate the AI failed to lead).
- The Founder reviews `human_by_category` weekly; any `avoidable` event requires an L5 fix (tooling/operator) in the same week.

## 4. Cost measurement

- Stripe/Gumroad fees: automatic.
- Coconala: book the platform fee when the order completes (`--category coconala_fees`). BOOTH: `booth_fees`.
- X API credits, ads, any tool purchase: book on the day of commitment.
- AI compute: subscription runs → `--jpy null` once per operator per day with a note; metered API usage (if any) → actual amount.

## 5. Reporting cadence

- Continuous: `ops.mjs board` for any operator at start of run.
- Daily 21:00 JST: `daily-report.yml` regenerates `reports/2026-10-DD.html` from ledgers + `reports/data/2026-10-DD.json` (Founder writes the narrative JSON; same keys as September: focus/actions/decisions/strategy/observed/learnings/next, `_ja`/`_en`).
- Weekly reviews: Oct 4, 8, 15, 22, 29 → `reports/2026-10/REVIEW-<date>.md`.
- Final: `reports/2026-10/FINAL.md` on 10/31–11/01 comparing Phase 1 vs Phase 2.
