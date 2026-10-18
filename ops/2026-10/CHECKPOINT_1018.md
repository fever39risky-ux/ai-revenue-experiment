# 10/18 falsification checkpoint — Sales Motion redesign (owner rule 2026-10-15)

Runs in the **first Founder fire dated 2026-10-18 JST** (task `checkpoint-1018`). Its decision report must carry a `checkpoint_1018` block; `decision_check.mjs` rejects the earliest 10/18 report without it.

## 0. Central question (owner rule 2026-10-17): how do we actually win a customer?
The checkpoint redesigns **customer acquisition**, not just "which Sales Motion". **Do not pick a channel first.** "Search CrowdWorks", "post on X", "list on Coconala" are means of execution, not an acquisition strategy. Decide **WHO / PAIN / OFFER / TRUST / REACH first**, then pick the channel from where that customer actually is.

Answer these for every hypothesis:
1. **WHO** — industry, role, company size, the task they do, their situation (concrete enough to find 10 of them)
2. **PAIN** — the problem they would pay to fix *now*
3. **TRIGGER** — the moment the pain surfaces (month-end totals, inquiry spikes, hiring season, the weekly report, a CSV hand-off, a manual-entry mistake …)
4. **OFFER** — what exactly, at what price, and where the scope ends
5. **WHY NOW** — why it is not postponed
6. **TRUST** — what a no-name, zero-track-record seller shows to be believed (demo, sample, Before/After, free diagnosis, deliverable up front …)
7. **WHERE** — where this customer actually gathers (reverse-engineered from the customer, not from our accounts)
8. **HOW TO REACH** — compare: replying to posted jobs, search inflow, communities, referral, direct proposal to a public request, partners, existing network …
9. **FIRST CONVERSION** — the low-risk first offer for customer #1 (ignore the normal price/product if needed)
10. **REPEATABILITY** — can #1 be repeated with the same customer profile?

### WHO / PAIN granularity (owner rule 2026-10-18 — applies to every acquisition hypothesis from now on)
- **WHO is an object**, never a broad label. 「中小企業」「フリーランス」「個人事業主」「小規模EC事業者」 alone fail. Required keys: `industry`, `role`, `company_size` (with a number), `task` (the work they actually do), `frequency` (how often), `current_method` (how they do it today), `pain_moment` (the concrete moment it hurts).
  Example: 「従業員1〜10名のEC事業者で、毎週複数モールのCSVを手作業でまとめ、売上・在庫・広告の報告表を作っている担当者」.
- **PAIN is the work they actually do, with numbers** — 「毎週2時間かけて3つのCSVを1つの表にまとめている」「問い合わせ50件を手作業で分類している」. Abstract wording (「効率化したい」「AIを使いたい」) fails.
- Set `acquisition_spec_version: 2`. `decision_check.mjs` enforces this on every report written from 2026-10-18 12:00 that carries acquisition hypotheses (`checkpoint_1018`, `checkpoint_1018_amendment`, or `acquisition`). The 00:07 checkpoint predates the rule and was re-stated in `2026-10-18T1250.json`.

### Required comparison: ≥ 3 different acquisition hypotheses (`checkpoint_1018.acquisition_hypotheses[]`)
Each: `id`, `who`, `pain`, `trigger`, `offer` (what/price/scope), `why_now`, `trust`, `where`, `how_to_reach`, `first_conversion`, `repeatability`, `steps_to_first_close` (the expected steps to the first deal), `first_market_test` (what we put in front of real customers), `signal_48h` (the signal we want within 48 h, observable and countable), and only then `channel`. The `who` values must be genuinely different customers.

Pick **one** (`checkpoint_1018.chosen_hypothesis`, with `why`) and **put it in front of the market inside the same fire** (`executed.market_test`: `{hypothesis, action, evidence, at}` — evidence = a live URL, post/tweet id, sent proposal/message id, or a published listing; prefer a cloud-executable test so it does not wait for another runtime, and add a P1 mac-local task in the same fire only for the browser-only part). A plan to test later is not a market test.

## Rule
- If buyer replies across CrowdWorks + Coconala (+ any channel) are still **0** → the current Sales Motion (applying to public jobs/requests) is falsified for October. **Redesign at L4 or higher is mandatory.**
- **Forbidden conclusion:** "continue because the proposal count is low / under-volume / not enough data". Low volume is itself evidence that the motion cannot be fed — it is a reason to redesign, not to wait. (decision_check rejects that wording when replies are 0.)
- If ≥ 1 reply exists → work it end-to-end first (Art.10); the block still records the comparison and why the motion stays.

## Required 6-dimension comparison (`checkpoint_1018.options`, all six — fill it from the hypotheses above)
| key | question |
|---|---|
| `buyer_segment` | a different buyer (e.g. small agencies / tax-accountant offices / EC sellers / existing September buyers) |
| `offer` | a different proposal / offer (productized fixed-scope deliverable, audit, template + setup …) |
| `price` | a different price / ticket (¥3k entry, ¥15–30k package, monthly) |
| `job_selection` | a different job-selection rule (category, size, buyer quality, timing) |
| `channel` | a different channel (Lancers, ココナラ出品の作り直し, X, note, direct site …) |
| `other_sales_motion` | a motion other than applying to public jobs (instant-buy productized gig, inbound listing, content-led, referral …) |

Each option: `{ "option": "...", "expected_effect": "...", "cost": "...", "evidence": "...", "score": <number> }`. Then `chosen` (one or more keys), `level` (`L4`/`L5`), `why`, `rejected` (reason per unchosen key).

## Execution in the same fire (`checkpoint_1018.executed`)
- `stopped_tasks`: task ids stopped / marked done-cancelled now (≥ 1 when replies are 0: the motion being replaced)
- `new_tasks`: task ids created now for the chosen redesign (must exist in `status/2026-10/tasks/`)
- `reallocation`: which operator's capacity moves where (mac-local / founder), effective now
- plus `redesign` event (`--level L4|L5 --from ... --to ...`) and STATE hypotheses/priority_actions updated.
