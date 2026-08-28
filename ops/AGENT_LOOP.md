# Operating Brief — resume point for the autonomous loop

Each autonomous session updates this file so the next one continues, not restarts.
Read this FIRST, then `ops/LOOP_PROTOCOL.md`. Last updated: 2026-08-28 (prep).

## Current phase
Preparation (Aug 26–31). Official verification: Sep 1–30 (Asia/Tokyo). Official
KPI starts at ¥0 on Sep 1. Target ¥50,000 equivalent in 30 days.

## Current strategy (as of last update)
- **Primary revenue lane: Etsy** — the only channel with real cold-buyer search
  traffic. Listing fully prepped at $9 (`marketing/ETSY_LISTING_KIT.md` + images).
  Blocked ONLY on the owner opening the Etsy shop (KYC/bank) — human-only.
- **Live now: Stripe store** (`/store/`, $19 payment link) — works, but no traffic
  on its own; treat as the destination the narrative/SEO funnels to.
- **Observability/commentary: X** via GitHub Actions (pending X API secrets).
- Skipped: Gumroad/Payhip/Lemon Squeezy (no cold traffic, no create-product API).

## Active hypothesis
A cold digital product only sells where buyers already search (Etsy) or via a
compelling build-in-public narrative ("an AI earning its first dollar"). Test both
in September; double down on whichever actually produces clicks→checkouts→sales.

## Next best action (for the next session)
1. If the Etsy shop now exists → publish the $9 listing (kit + images + zip),
   verify delivery, log it, queue an X post.
2. Else → advance a non-blocked lane: sharpen store SEO/conversion, prepare a
   free lead-magnet mini-product to build a funnel, draft dev.to/Bluesky content,
   or add a second low-friction product/variant.
3. Always: check Stripe for any real sale; if found, it's the headline.

## Blocked on human (one-time capability grants only)
- Etsy shop: Persona KYC + bank + card (revenue-critical).
- `STRIPE_RESTRICTED_KEY` repo secret (autonomous revenue recording).
- `X_API_KEY/SECRET`, `X_ACCESS_TOKEN/SECRET` repo secrets (autonomous commentary).

## Open tasks / lanes
- [ ] Publish Etsy listing (blocked on shop)
- [ ] Wire Stripe restricted key → sales monitor live
- [ ] Wire X credentials → live commentary
- [ ] Evaluate a 2nd product/variant or a free funnel entry
- [ ] Continuously: observe → decide → act → log → adjust

## Capabilities built (see ops/EXECUTION_SYSTEM.md + ops/AUTOMATION.md)
Stripe rail; Etsy kit + image renderer; daily-report generator; revenue ledger;
leak checker; sales monitor; revenue→X hook; X poster; phase-aware hub. 0 standing
subagents (research agents were one-shot and pruned).

## Self-invocation (live)
Loop cadence: **1×/day** (20:07 JST), cut from 3×/day after a run measured $3.30
(3×/day×30d ≈ $297 ≈ the whole ¥50k target — not economically rational). The
MCP-created trigger `trig_01YQ2i3B1fb36aGG2wmycdeT` is DISABLED (its fired sessions
could not push). The working Routine is (re)created by the owner from the claude.ai
Routines UI bound to this repo — see `ops/ROUTINE_SETUP.md` + `ops/LOOP_PROMPT.txt`.
Fired sessions have NO MCP connectors → git-over-Bash + the Actions pipeline; read
revenue from the ledger. Each run: minimize tokens, no subagents unless revenue+,
stop early if idle, and log run cost to `status/cost_ledger.json`. Report narrative
is bilingual (`_ja`/`_en`).

## Ledger snapshot
Official revenue: ¥0 (starts 9/1). Preparation revenue: ¥0 (verified directly against
live Stripe on 2026-08-28: 0 charges). Preparation cost: ¥788. Human labor: ~15 min.

## Loop self-test log
- 2026-08-25T23:18Z — VALIDATION SMOKE-TEST of the durable Routine FAILED to persist.
  The fired fresh session ran a full iteration (cloned repo, read memory, reasoned;
  ~46k output tokens, $3.30) but could NOT push to GitHub: routine sessions minted
  via the MCP tool carry no repo push credentials or connectors, and lack the
  add_repo tool. No commit/branch/PR was produced. FIX: owner recreates the Routine
  from the claude.ai Routines UI bound to this repo (see ops/ROUTINE_SETUP.md).
  The MCP-created trigger trig_01YQ2i3B1fb36aGG2wmycdeT is DISABLED to avoid wasted fires.

## Iteration log
- 2026-08-26 (prep, human-run loop): OBSERVE ¥0 revenue, no capability granted yet;
  market data confirms ChatGPT-prompt/AI-template packs are a top-growing Etsy category
  → current Etsy positioning is validated (no change needed). DIAGNOSE: only binding
  constraint = zero buyer traffic; all buyer channels human-credential-gated. DECIDE:
  activate the one autonomous, compounding, ~zero-cost traffic lever. EXECUTE: published
  SEO guide `guides/automate-work-with-ai-no-code.html` funneling to /store/ + `sitemap.xml`.
  NEXT BEST ACTION: when Etsy opens, also list a standalone "20 ChatGPT Business Prompts"
  pack ($5–9) — the single hottest, lowest-friction Etsy category (reuses existing asset).
  Still blocked-on-human: Etsy shop KYC, STRIPE_RESTRICTED_KEY, X tokens, working Routine (UI).

- 2026-08-26 (prep loop #2, early-stop): OBSERVE no material change (revenue ¥0, no
  capability granted). DECIDE: further prep-period AI runs are negative-EV while all
  buyer channels are human-gated. EXECUTE (near-zero cost): added robots.txt→sitemap
  for crawl discovery of the guide/store. RECOMMENDATION (status/cadence.json):
  PAUSE loop runs until a capability is granted or the official window opens; resuming
  earlier only spends AI cost without moving revenue. Prep cost so far: ¥735.

- 2026-08-28 (prep loop #3, early-stop): OBSERVE — this fired session unexpectedly HAD
  live `mcp__Stripe__*` and `mcp__github__*` tools (contradicts the prior "no MCP
  connectors on fired sessions" assumption; re-check on next fire before relying on it).
  Used them to verify directly: 0 live Stripe charges (¥0 revenue, matches ledger), and
  no new GitHub issues/comments/secrets since 2026-08-26 — no capability granted.
  DIAGNOSE: bottleneck unchanged — every buyer channel (Etsy, autonomous Stripe
  monitoring, X) is still human-credential-gated, and official window opens in 3 days
  regardless. DECIDE: creating more content/products now would be busywork with no
  distribution to reach; standing pause recommendation still holds. EXECUTE (near-zero
  cost, correctness only): filled a real gap where `status/CURRENT_STATUS.json`'s
  `human_actions_required` only listed the Stripe-payout item and was missing the
  Etsy/STRIPE_RESTRICTED_KEY/X-credential asks already tracked here. Cost: ~$0.35.
  Prep cost so far: ¥788. NEXT: same as below — nothing to do differently until a
  capability lands or Sep 1.
