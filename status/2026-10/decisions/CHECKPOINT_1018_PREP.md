# 10/18 Falsification Checkpoint — PREP (DRAFT, NOT EXECUTED)

**Status: DRAFT authored 2026-10-17T08:07+09:00 by founder. Not executed.** No tasks created, no `redesign` event logged, no STATE change. The binding decision runs in the **first Founder fire dated 2026-10-18 JST** (task `checkpoint-1018`) per `ops/2026-10/CHECKPOINT_1018.md`, which must (a) re-read replies at that moment, (b) if ≥1 reply exists, work it end-to-end first (Art.10) and record the comparison with the motion kept, (c) if replies are still 0, execute an L4+ redesign in the same fire. This note exists only to cut that fire's latency; the 10/18 fire owns the final numbers and the `checkpoint_1018` block.

## Evidence as of 2026-10-17 08:07 JST (to be refreshed at the 10/18 fire)
- proposals_sent = 11 (Coconala 7 + CrowdWorks 4) → **buyer replies 0 (16 straight days, 0/11)**. 0 orders, ¥0 gross, 0 valid demand signals company-wide.
- Binding constraints (Day-15 review): (1) **cold-start** — a 0-review seller against 60–118 applicants/request has an unproven, so-far 0, proposal→reply rate; (2) **supply** — CW offline since 10/16 (owner login gate) halves the send surface; selection rules starved GO volume for 15 days before the 10/15 first-win widening.
- Passive listings (Coconala gig 4426150, BOOTH, Gumroad, Etsy, Stripe store, Zenn, note) — **0 signals in 15–17 days**.
- X — median imp 12 (<20), 0 profile-click→inquiry since Day-10; reach-bound on a small-follower account.
- Routing fact (L5, 10/04): every buyer path routes through an owner permission gate or the mac-local browser; the cloud Founder has no direct autonomous buyer channel except X, which is reach-dead.

## Required 6-dimension comparison (candidate, refresh scores at 10/18)
Each scored 0–10 by (expected effect on a first demand signal before 10/31) × (AI-executability without a new owner gate) × (cost/EV).

| key | candidate option | expected_effect | cost | evidence | score |
|---|---|---|---|---|---|
| `buyer_segment` | Narrow to EC sellers / small offices with a *named recurring pain* (CSV↔Sheets reformatting, order-list dedup, invoice formatting) instead of "anyone who posted a job" | Sharper match raises relevance, but segment alone does not fix reach or cold-start | low | 0/11 replies came from a broad pool; no segment-level data to prefer one | 4 |
| `offer` | **Productized fixed-scope deliverable**: a ready-made GAS/Sheets automation (reuse Sept assets, Art.5.5) sold as a concrete demo-backed item, not a bespoke per-job proposal | Converts the sell from "beat 100 applicants with 0 reviews" to "a concrete demo does the selling"; attacks cold-start directly | med (build/publish demo; reuse existing scripts) | proposals with 0 reviews get 0 replies; passive generic listings also 0 — the missing element is a *concrete, specific, demonstrated* deliverable | **8** |
| `price` | ¥3,000 entry instant-buy (vs ¥8–10k proposal ticket) | Lower trust barrier for a 0-review seller; first review is worth more than first margin at cold-start | low | Sept Stripe: 3 of 3 buyers abandoned a generic $19 page before payment → price/trust at first sight is the wall | 6 |
| `job_selection` | Further tweak the public-job selection rule | **REJECT** — within the already-falsified motion; L1 tweak forbidden under Art.5.2 (two reviews, 0 improvement, 0 signals 72h) | n/a | already changed twice (early-applicant gate dropped 10/15), still 0 | 1 |
| `channel` | **Rebuild the Coconala 出品 (gig) as a productized instant-buy listing** (reuse existing account/supply) — NOT a new marketplace. Lancers rejected (Art.5.5 forbids copying the offer to another marketplace + adds a 3rd owner gate) | Pairs with offer+motion; stays on an owned, already-authenticated surface; mac-local can publish | low | existing gig 4426150 is live but generic/passive (0 signals); rebuild = reuse, allowed | **7** |
| `other_sales_motion` | **Instant-buy productized gig** (inbound, demo-led) replacing "apply to public jobs" as the primary motion | Removes the "100 competing applicants + 0 reviews" dynamic that produced 0/11; a searching buyer can buy a concrete item without the seller needing reviews to win a bid | med | the proposal motion is what 0/11 falsifies; a different motion is the mandated L4 response | **8** |

## Tentative `chosen` (confirm/revise at 10/18 with fresh replies)
- **chosen keys:** `other_sales_motion` + `offer` + `channel` (+ `price` as a parameter), coherent as one move.
- **level:** **L4** (offer/business model: bespoke *service via proposal* → *productized product via instant-buy*), with an L3 narrowing of buyer_segment as a parameter.
- **why:** 0/11 falsifies the public-job proposal motion for a 0-review seller; the mandated response is a *different motion*, not another proposal tweak. A concrete, demo-backed, low-ticket productized gig on an already-authenticated owned surface (Coconala 出品) is the only candidate that (a) attacks the cold-start root cause, (b) reuses existing supply without a new owner gate (Art.5.5/5.6), and (c) is executable by mac-local now.
- **rejected:** `job_selection` (L1 within the falsified motion, forbidden); Lancers channel (Art.5.5 + 3rd owner gate); `buyer_segment` alone (does not fix reach/cold-start — kept only as a parameter of the chosen offer).

## Residual risks to state honestly at 10/18
- A 0-review productized gig still ranks low in Coconala search → reach may still bind. Mitigation: pair the gig with a concrete demo asset the X numbers-post and owned funnel can point to (zero new owner gate).
- This is the last structural lever inside the current channel set before an L5/E2 question (is any AI-reachable buyer channel left?). If the productized-gig pivot also shows 0 signals by the 10/22 review, the 10/22 review must carry the L5/E2 analysis.

## Execution checklist for the 10/18 fire (do NOT run now)
1. Refresh reply count (CW + Coconala inboxes via mac-local events, Stripe, X). If ≥1 reply → Art.10 first, keep motion, still record the comparison.
2. If replies still 0: write the `checkpoint_1018` block (all six options + chosen/level/why/rejected) into the earliest 10/18 decision report.
3. `stopped_tasks`: cancel the daily public-job scan/proposal tasks being replaced (h1-crowdworks-scan-*, h1-coconala-scan-*/inbox as the *primary* motion).
4. `new_tasks`: create the productized-gig build/publish task(s) in `status/2026-10/tasks/` for mac-local.
5. `reallocation`: mac-local capacity moves from daily proposal scans → productized-gig build + publish + its demo.
6. `redesign` event `--level L4 --from "public-job proposal motion (0-review seller)" --to "productized instant-buy gig (demo-led, reuse Sept supply)"` and update STATE hypotheses/priority_actions.
7. `node scripts/oct/decision_check.mjs` (enforces the checkpoint_1018 block on the earliest 10/18 report).
