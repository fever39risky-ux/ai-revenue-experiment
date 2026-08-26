# Operating Brief — resume point for the autonomous loop

Each autonomous session updates this file so the next one continues, not restarts.
Read this FIRST, then `ops/LOOP_PROTOCOL.md`. Last updated: 2026-08-26 (prep).

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
Durable Routine `trig_01YQ2i3B1fb36aGG2wmycdeT` fires a fresh session 3×/day in
September (09:07/14:07/20:07 JST) running `ops/LOOP_PROTOCOL.md`. Fired sessions
have NO MCP connectors → use git-over-Bash + the Actions pipeline; read revenue
from the ledger. GitHub Actions handle the deterministic work between wakes.
Report narrative is bilingual (author `_ja` and `_en`).

## Ledger snapshot
Official revenue: ¥0 (starts 9/1). Preparation revenue: ¥0. Human labor: ~15 min.

## Loop self-test log
- 2026-08-25T23:18Z — VALIDATION SMOKE-TEST of the durable Routine FAILED to persist.
  The fired fresh session ran a full iteration (cloned repo, read memory, reasoned;
  ~46k output tokens, $3.30) but could NOT push to GitHub: routine sessions minted
  via the MCP tool carry no repo push credentials or connectors, and lack the
  add_repo tool. No commit/branch/PR was produced. FIX: owner recreates the Routine
  from the claude.ai Routines UI bound to this repo (see ops/ROUTINE_SETUP.md).
  The MCP-created trigger trig_01YQ2i3B1fb36aGG2wmycdeT is DISABLED to avoid wasted fires.
