# Operating Brief — resume point for the autonomous loop

Each autonomous session updates this file so the next one continues, not restarts.
Read this FIRST, then `ops/LOOP_PROTOCOL.md`. Last updated: 2026-09-05 (official day 5).

## Current phase
**OFFICIAL (Sep 1–30, Asia/Tokyo) — started 2026-09-01.** Official revenue ¥0,
official cost small (see cost_ledger.json). Target ¥50,000 equivalent in 30 days.
Day 5: **all three digital-product channels (Stripe, Gumroad, Etsy) are now
LIVE and purchasable for the first time in this experiment.** Etsy went live
today after the owner completed the OAuth grant and two real API errors
(shared-secret 403, tag-length 400) were fixed from their exact responses.
Creem was approved by the owner today but deliberately NOT activated (no
distribution advantage identified over the already-live Stripe rail). Still
¥0 revenue everywhere — no sale has occurred on any channel yet.

## Current strategy (as of last update)
- **Primary revenue lane: Etsy — LIVE 2026-09-05.** The only channel with real
  cold-buyer search traffic. $9 "ChatGPT Prompts + AI Automation Toolkit" is
  purchasable right now at https://www.etsy.com/listing/4569271638. Published
  via Etsy API v3 (OAuth+PKCE, 5 secrets) directly. Two real API errors were
  fixed from their exact responses: a 403 (`x-api-key` needs
  `keystring:shared_secret`, found 2026-09-03) and a 400 (a tag exceeded
  Etsy's 20-char limit, found 2026-09-05). No sale yet. **No Etsy sale-detection
  automation exists yet** — deferred, lowest-priority next build (same
  priority-order approach as Gumroad's: official API → low-cost Actions →
  Routine-launch check → human dashboard).
- **Live now: Stripe store** (`/store/`, $19 payment link) — works, but no traffic
  on its own; treat as the destination the narrative/SEO funnels to. Deliberately
  NOT cross-linked with Gumroad (would let store visitors already mid-checkout
  route to the cheaper $9 Gumroad product instead — self-cannibalization, not a
  real distribution gain).
- **Observability/commentary: X** via GitHub Actions (pending X API secrets, optional).
- **Gumroad: LIVE — first real listing published 2026-09-02, now with a real
  cover image (added 2026-09-04) and a first owned-asset backlink (index.html,
  added 2026-09-04).** $9 "ChatGPT Prompts + AI Automation Toolkit" is
  purchasable right now at https://feverish50.gumroad.com/l/uhajxo. Published
  via Gumroad's official REST API v2 directly (no CLI) — the S3-multipart
  file-upload path (`/v2/files/presign` → `/v2/files/complete`) is proven
  working by a real successful run. Thumbnail upload (`scripts/gumroad_add_thumbnail.mjs`,
  `POST /v2/products/:id/thumbnail`) also proven live 2026-09-04 — Discover/
  search/link-preview surfaces now show a real image, not a blank card. No
  sale yet, but the listing is under 24h past the thumbnail going live — too
  early to read anything into zero sales so far.
- **Creem: approved and usable (owner confirmed 2026-09-05)** — still NOT
  activated. Approval resolves the "is it usable" question but creates no
  Net-Profit case on its own: it's payment/checkout infrastructure with no
  marketplace/search surface of its own, so it would only offer existing
  buyers a second checkout for the same product (substitution, not
  incremental reach) while duplicating Stripe's already-live role. Would
  reconsider only given a specific advantage over Stripe (fees, an
  unreachable market/currency, a unique distribution channel) — none found.
- Lemon Squeezy: owner attempted to open an account, it didn't complete,
  intentionally abandoned. Not restarting without new justification.

## Channel inventory — CORRECTED 2026-09-01T15:00 UTC (see correction note)
> **Correction note:** an earlier version of this inventory (same day,
> ~14:30 UTC) classified Gumroad and Creem as "status unknown" / effectively
> not-yet-opened, reasoning from an absence of GitHub repo records. That was
> a real error: **absence of a repo record was wrongly treated as absence of
> the capability itself.** The owner corrected this directly — both accounts
> were opened, KYC'd, and bank-linked by the human before this experiment's
> GitHub memory captured it; the gap was in what got migrated to the source
> of truth, not in what the owner actually did. Every row below now carries
> an explicit verification level so this distinction is never collapsed
> again: `confirmed_in_repo` | `confirmed_by_owner` | `status_unknown` |
> `needs_re_verification`. Full detail: `status/CURRENT_STATUS.json.channel_inventory`.

| Channel | State | Verification | Role | Notes |
|---|---|---|---|---|
| Stripe | **live** | confirmed_in_repo | payment rail / destination, not discovery | Live since 2026-08-25; ¥0 revenue (0 owned traffic) |
| Etsy | **LIVE — published 2026-09-05T00:55 UTC** | confirmed_in_repo (status/etsy_listing.json + live URL) | primary discovery channel | $9 "ChatGPT Prompts + AI Automation Toolkit" purchasable at https://www.etsy.com/listing/4569271638. Fixed 2 real API errors (shared-secret 403, tag-length 400) from their exact responses. No sale yet. |
| Gumroad | **LIVE — published 2026-09-02T22:16 UTC** | confirmed_in_repo (status/gumroad_listing.json + live URL) | parallel discovery channel | $9 "ChatGPT Prompts + AI Automation Toolkit" purchasable at https://feverish50.gumroad.com/l/uhajxo. 1st publish attempt hit a real API error (`/v2/direct_uploads` is media-only); fixed against `files_controller.rb` to use the S3-multipart `/v2/files/presign`→`/v2/files/complete` flow; 2nd attempt succeeded. No sale yet. |
| Creem | **account + KYC + bank + approval confirmed by owner (2026-09-05)** | confirmed_by_owner (account + approval) | payment rail, duplicates Stripe's role | Fully usable now, but NOT activated: no marketplace/search surface of its own, so it adds no incremental buyer reach over Stripe -- pure payment-rail substitution. Deprioritized absent a specific identified advantage. |
| Lemon Squeezy | **abandoned** | confirmed_by_owner | n/a | Owner attempted, didn't complete, intentionally abandoned. Not revisited without new justification. |

**Net-Profit conclusion (re-evaluated with corrected facts):** Etsy stays
primary (validated buyer search-intent, remaining friction is one scoped
step). Gumroad is now ALSO worth activating in parallel, not instead of
Etsy: the account is already fully KYC'd/bank-linked, and the technical
path — after being re-verified against Gumroad's actual production source
code, not the CLI's own docs — is a direct REST API call needing one
personal access token, still simpler than Etsy's OAuth+PKCE app
registration. Expected per-listing demand is still lower than Etsy's
(Gumroad Discover favors listings with existing sales/reviews), but at low
incremental cost this is a positive-EV parallel bet, not a distraction from
Etsy. Creem stays deprioritized even with account+KYC confirmed: it's
payment infrastructure duplicating Stripe's already-live role, not a
discovery channel, and no differentiator has been identified — building it
now would be exactly the "redundant infra without evidence of added value"
anti-pattern, independent of the correction above.

**Second correction, same day (2026-09-01T16:00 UTC):** the first Gumroad
build depended on `antiwork/gumroad-cli`'s own documentation for its
`products create`/`publish` commands. The owner flagged that this wasn't
sufficient verification — Gumroad's official help center only documents
that CLI for Pages/Profile publishing, not product management, and a
separate check suggested the REST endpoint might not even be implemented.
Re-checked against the actual source (not secondary claims): Gumroad's own
production repo confirms the routes and controller logic are real and
functional. Rebuilt `scripts/gumroad_publish.mjs` to call the REST API
directly — no CLI dependency, first-party or third-party — per the user's
explicit instruction not to rely on any CLI. Two implementation details
(exact `direct_uploads` response field names; exact `files` array entry
shape) remain genuinely unverified against a live call and are flagged as
such, not glossed over.

## Active hypothesis
A cold digital product only sells where buyers already search (Etsy) or via a
compelling build-in-public narrative ("an AI earning its first dollar"). Test both
in September; double down on whichever actually produces clicks→checkouts→sales.

## Next best action (for the next session)
0. Gumroad is DONE for this milestone — listing is live at
   https://feverish50.gumroad.com/l/uhajxo, now with a real cover image
   (2026-09-04) and a backlink from index.html (2026-09-04). Only remaining
   Gumroad task is watching for the first real sale (no action needed unless
   one occurs) — do NOT re-poll or re-verify this lane again without a
   specific new reason; it is genuinely finished for now.
1. Etsy is DONE for this milestone too — listing is live at
   https://www.etsy.com/listing/4569271638 (2026-09-05). Only remaining Etsy
   task is watching for the first real sale. **Note:** Etsy has no
   sale-detection automation yet (unlike Gumroad/Stripe) — building
   `scripts/etsy_sales_monitor.mjs` (same priority-order approach: official
   API → wire into the existing `sales-monitor.yml` cron, no new schedule)
   is the natural next build, but is not urgent (no revenue-moving action is
   gated on it — it only affects how fast a real sale gets recorded).
   **Also note:** Etsy's refresh token rotates on every use, so
   `ETSY_REFRESH_TOKEN` in repo secrets is stale again after the 2026-09-05
   publish run — re-run `scripts/etsy_oauth_setup.mjs` before any future
   `etsy_publish.mjs` execution that needs to write new listing data (not
   needed for the current listing, which is idempotently skipped on rerun).
2. All three digital-product channels (Stripe, Gumroad, Etsy) are now live —
   the experiment's bottleneck has shifted entirely from "can the AI publish"
   to "will a real buyer purchase." Watch `status/revenue_ledger.json` for
   the first sale on any channel; if/when one lands, that's the headline —
   queue an honest post about it (not before).
3. Creem: approved by the owner 2026-09-05 but deliberately not activated
   (see `status/CURRENT_STATUS.json.channel_inventory.creem`). Do not build
   a Creem integration without a newly identified, specific advantage over
   Stripe (fees, an unreachable market/currency, a unique distribution
   channel) — approval alone is not sufficient justification.
4. If several more days pass with zero sales on Gumroad and/or Etsy despite
   both being fully live and complete, treat that as real evidence for
   re-diagnosis (cold-start/no-reviews/distribution reach), not more
   listing polish on either.

## Blocked on human — none currently (revised 2026-09-05: Etsy grant fulfilled, listing live)
- All three digital-product channels' publish mechanisms are now live and
  unblocked. The only remaining human-only item is unrelated to whether the
  AI can operate: Stripe payouts/bank/KYC settlement (money reaching the
  owner, not a lane blocker).

## Optional capabilities (NOT blockers — do not treat as gating the experiment)
- `STRIPE_RESTRICTED_KEY` repo secret: NOT required for Stripe checkout to
  work (it already does). Only adds headless revenue detection via
  `sales-monitor.yml` between Routine sessions. **Observation fallback per
  run — never assume either state:** (1) if this session has a live Stripe
  MCP connector, query it directly; (2) if not, read
  `status/revenue_ledger.json` + the sales-monitor Action's latest run log;
  (3) if the repo secret exists, the Actions-level 4-hourly monitor is also
  live and feeding that ledger. MCP availability has varied run to run
  (present 2026-08-28, absent 2026-09-01) — observe it each time, don't assume.
- `X_API_KEY/SECRET`, `X_ACCESS_TOKEN/SECRET` repo secrets: optional —
  enables autonomous X commentary. Not required for the core Etsy/Stripe
  revenue mechanism.

## Gumroad sale detection (added 2026-09-03)
Same observation-fallback discipline as Stripe above, applied to Gumroad:
`scripts/gumroad_sales_monitor.mjs` was added as one extra step in the
*existing* `sales-monitor.yml` cron (no new schedule, near-zero incremental
cost) — it calls `GET /v2/sales` with the already-granted
`GUMROAD_ACCESS_TOKEN` and appends any new sale to
`status/revenue_ledger.json`. **Resolved 2026-09-04, empirically:** the
`view_sales` scope IS granted on the existing token — confirmed by reading
`sales-monitor.yml`'s own job logs (run `33691834156` onward), which show
`gumroad_sales_monitor: 0 new sale(s). official rev=... prep rev=...`; that
line only prints after a real `GET /v2/sales` call succeeds (the
scope-error branch logs a distinctly different message and has never
appeared). No owner action needed for Gumroad sale detection — this item is
closed, don't re-check it without a specific new reason.

## Open tasks / lanes
- [x] Trigger Etsy publish Action once OAuth secrets exist — DONE 2026-09-05, listing live
- [x] Verify the live Etsy listing matches the config; fix/re-run if the API rejected a field — DONE (fixed a tag-length rejection, re-ran, succeeded)
- [ ] Build `scripts/etsy_sales_monitor.mjs` (wire into existing sales-monitor.yml cron, same pattern as Gumroad's) — not urgent, no revenue-moving action gated on it
- [ ] Wire Stripe restricted key → sales monitor live (optional)
- [ ] Wire X credentials → live commentary (optional)
- [ ] Evaluate a 2nd product/variant only once there's real signal (a sale, real traffic) to act on
- [ ] Continuously: observe → decide → act → log → adjust

## Capabilities built (see ops/EXECUTION_SYSTEM.md + ops/AUTOMATION.md)
Stripe rail; Etsy kit + image renderer; Etsy API v3 publish pipeline (config +
script + workflow + local OAuth helper) -- **proven working end-to-end
2026-09-05**, listing live; Gumroad REST API v2 publish pipeline (config +
script + workflow) -- **proven working end-to-end 2026-09-02**, listing live;
Gumroad sales monitor (`scripts/gumroad_sales_monitor.mjs`, wired into the
existing Stripe cron, `view_sales` scope confirmed granted 2026-09-04); daily-
report generator; revenue ledger; leak checker; sales monitor; revenue→X
hook; X poster; phase-aware hub. Etsy sales monitor NOT yet built (see Open
tasks). 0 standing subagents (research agents were one-shot and pruned).

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

**Branch-scoped push (added 2026-08-28):** some fired sessions DO have MCP
connectors (Stripe + GitHub seen directly), but are harness-scoped to push only
to a `claude/**` branch, never `main`. Don't fight this — commit/push to
whatever branch the session's own git instructions name. `main` persistence is
now handled unattended by `.github/workflows/promote-branch.yml`, which
fast-forwards `main` to that branch (only if ahead/0-behind/leak_check/
promotion_check all pass, never force) or opens a single "Promotion blocked:
<branch>" issue if it can't. See `ops/ROUTINE_SETUP.md` for the full mechanism.
**Next iteration should check for an open "Promotion blocked" issue before
assuming prior work already reached `main`.**

## Ledger snapshot
Official revenue: ¥0. Official cost: ¥1,915 (cumulative through 2026-09-05). Preparation
revenue: ¥0 (verified directly against live Stripe on 2026-08-28: 0 charges).
Preparation cost: ¥788. Human labor: ~24 min. Net Profit (official): -¥1,915.
Non-monetary milestone this period: **all three digital-product channels are
now live and purchasable** -- Stripe ($19, since 2026-08-25), Gumroad ($9,
https://feverish50.gumroad.com/l/uhajxo, since 2026-09-02, now with a cover
image and an owned-asset backlink), and Etsy ($9,
https://www.etsy.com/listing/4569271638, since 2026-09-05). No sale has
occurred on any channel yet. Creem approved by the platform 2026-09-05 but
deliberately not activated (no distribution advantage over Stripe found).

## Loop self-test log
- 2026-08-25T23:18Z — VALIDATION SMOKE-TEST of the durable Routine FAILED to persist.
  The fired fresh session ran a full iteration (cloned repo, read memory, reasoned;
  ~46k output tokens, $3.30) but could NOT push to GitHub: routine sessions minted
  via the MCP tool carry no repo push credentials or connectors, and lack the
  add_repo tool. No commit/branch/PR was produced. FIX: owner recreates the Routine
  from the claude.ai Routines UI bound to this repo (see ops/ROUTINE_SETUP.md).
  The MCP-created trigger trig_01YQ2i3B1fb36aGG2wmycdeT is DISABLED to avoid wasted fires.

## Iteration log
- 2026-09-05 (owner-directed, live Etsy publish — all 3 channels live):
  owner reported the Etsy OAuth walkthrough fully complete (5/5 secrets)
  and Creem's review passed, and asked for a real end-to-end Etsy publish
  plus a judgment call on Creem. OBSERVE: fetched origin — main had moved
  ahead with Day 4's Gumroad work (thumbnail, backlink, sales-scope
  resolution) done by another session while this one was idle since Day 3;
  this branch and main had diverged (3-way conflicts in
  `status/CURRENT_STATUS.json`, `status/cost_ledger.json`, this file).
  EXECUTE (merge): resolved all conflicts by combining both timelines
  (never discarding either side's real content), recomputed the official
  cost total, re-pushed, and confirmed `promote-branch.yml` fast-forwarded
  `main` cleanly. EXECUTE (publish): triggered `etsy-publish.yml` on
  `main` (not this feature branch — learned from an earlier session's
  mistake where dispatching on a feature branch caused the workflow's own
  `git pull --rebase origin main` step to fail). 1st run got past auth and
  taxonomy resolution — proving the 2026-09-03 `ETSY_API_SHARED_SECRET`
  fix actually works live — but failed on a new real error: `POST
  .../listings -> 400 [{"path":"/tags","type":"too_long","message":"cannot
  be more than 20 characters"}]`. DIAGNOSE: checked every tag's length
  directly; exactly one, "productivity template" (21 chars), exceeded
  Etsy's limit. DECIDE: minimal fix only — renamed that one tag to
  "productivity tools" (18 chars, same meaning), left everything else
  untouched. EXECUTE: committed, re-triggered on `main` — 2nd run
  succeeded completely: draft created (listing_id 4569271638) → 4 images
  uploaded → digital file uploaded → activated. RESULT: a real, live,
  third-party-purchasable Etsy listing —
  https://www.etsy.com/listing/4569271638 ($9, "ChatGPT Prompts + AI
  Automation Toolkit"). While verifying the auto-committed
  `status/etsy_listing.json`, found the SAME idempotency bug this session
  had already found and fixed in `gumroad_publish.mjs`: `saveState()`'s
  two calls each started from the original in-memory `state`, so the 2nd
  call (activate) silently dropped the 1st call's `listing_id` — confirmed
  by the on-disk file actually missing it. Fixed the function to
  accumulate (same pattern as Gumroad's fix) and restored the missing
  `listing_id` from the job log. Honest addendum: the fix landed on `main`
  slightly too late — while syncing, found that an independently-triggered
  `etsy-publish.yml` run (workflow_dispatch, NOT from this session,
  `2026-09-05T01:01:46Z`, before the fix was pushed) had already hit the
  still-broken check and created a real duplicate listing (`4569274006`).
  Root-caused and cleaned up immediately: restored
  `status/etsy_listing.json` to the canonical listing (`4569271638`), wrote
  `scripts/etsy_deactivate_listing.mjs` + a one-off
  `.github/workflows/etsy-deactivate.yml`, ran it live, confirmed
  `4569274006` is now INACTIVE. Full record in `status/EVENTS.jsonl`
  (`duplicate_listing_incident`). Also evaluated Creem explicitly per the owner's
  request rather than defaulting to build-because-approved: Creem is
  Merchant-of-Record payment/checkout infrastructure with no
  marketplace/search surface of its own, so activating it would only give
  existing buyers a second checkout for the same product (substitution,
  not incremental reach) while duplicating Stripe's already-live role —
  DECIDED not to activate, recorded the reasoning explicitly in
  `status/CURRENT_STATUS.json.channel_inventory.creem`. Updated
  `status/CURRENT_STATUS.json` (live_capabilities, active_lanes,
  channel_inventory, blockers now empty, human_actions_required trimmed to
  just the Stripe-payout item), this file, `status/cost_ledger.json`
  (+¥210), and `status/EVENTS.jsonl`. NEXT: all three digital-product
  channels (Stripe, Gumroad, Etsy) are live for the first time — watch for
  the first real sale on any of them; build Etsy sale-detection automation
  as a non-urgent follow-up (same priority-order approach as Gumroad's);
  remember `ETSY_REFRESH_TOKEN` is stale again post-publish (Etsy rotates
  it every use) if another Etsy write is ever needed.

- 2026-09-04 (scheduled cadence run, day 4): OBSERVE — no open GitHub issues,
  no "Promotion blocked" issue, main in sync. Re-triggered `etsy-publish.yml`
  via GitHub MCP to empirically re-confirm rather than assume: still no-ops,
  `status/etsy_listing.json` not created — Etsy OAuth grant unchanged, still
  the sole true blocker. DIAGNOSE: rather than let the day's action be "checked
  the same blocker again," audited the non-blocked Gumroad lane for real gaps
  instead of assuming it needed nothing further, since it hadn't been looked
  at critically since its 2026-09-02 launch. Found two: (1) no cover image
  (deliberately deferred at launch, not forgotten — flagged in
  `marketing/gumroad_listing_config.json`); (2) zero backlinks from any owned
  page (checked via `grep -r gumroad.com *.html`, confirmed empty). DECIDE:
  both are cheap, reversible, non-speculative fixes reusing existing assets —
  positive EV regardless of whether they move the needle much, and consistent
  with "reuse existing assets in a more effective offer." EXECUTE: read
  Gumroad's actual production source (`thumbnails_controller.rb`,
  `covers_controller.rb`, `direct_uploads_controller.rb`) via WebFetch — same
  discipline as every prior Gumroad fix — confirming `POST
  /v2/products/:id/thumbnail` accepts a standard Rails ActiveStorage
  `signed_blob_id` (unlike the digital ZIP, an image IS what `/v2/direct_uploads`
  accepts, so no S3-multipart workaround needed here). Wrote
  `scripts/gumroad_add_thumbnail.mjs` (idempotent), wired it into
  `gumroad-publish.yml`, pushed, and triggered the workflow for real on this
  branch — confirmed live success from the job log: "thumbnail attached to
  product KVChszgZy59QBao2fz609A== (01-cover.png, 891604 bytes)." Added a
  Gumroad link to `index.html` only — deliberately not to `/store/`, to avoid
  cannibalizing the $19 Stripe lane for visitors already mid-checkout there.
  Also resolved, from `sales-monitor.yml`'s own job logs (not new code), the
  2026-09-03 open question of whether `GUMROAD_ACCESS_TOKEN` carries
  `view_sales` — it does; Gumroad sales detection needs no further owner
  action. RESULT: Gumroad lane is now materially more complete (image +
  backlink); Etsy blocker re-confirmed unchanged; revenue still ¥0 on both
  channels (too early to read anything into that — under 24h since the
  thumbnail went live). Updated `status/CURRENT_STATUS.json`,
  `status/cost_ledger.json`, `status/cadence.json` (held at 1x/day — this
  run's real, non-busywork findings are evidence the daily cadence still has
  positive EV even while Etsy is blocked), `status/EVENTS.jsonl`,
  `ops/GUMROAD_API_SETUP.md`, `marketing/gumroad_listing_config.json`, and
  `reports/data/2026-09-04.json`. NEXT: Gumroad lane is done for now — do not
  re-touch it without a new reason; if it shows zero sales after several more
  days, that becomes real evidence for re-diagnosis (cold-start/no-reviews,
  not the image) rather than more listing polish. Etsy OAuth grant remains
  the single highest-leverage unblock.

- 2026-09-03 (owner-directed, Etsy OAuth walkthrough begins, real fix
  mid-flow): guided the owner step-by-step through the Etsy Developer App
  registration and the local `etsy_oauth_setup.mjs` OAuth (PKCE) run.
  OAuth authorize + token exchange succeeded (Keystring/Access Token/
  Refresh Token obtained), but the script's automatic `ETSY_SHOP_ID`
  lookup failed with only "(could not auto-detect)" — a real bug: the
  lookup call never checked `res.ok`, silently swallowing whatever Etsy
  actually returned. Fixed that first (added status+body logging, handled
  both possible response shapes) and shipped a standalone
  `scripts/etsy_get_shop_id.mjs` recovery helper so the owner could retry
  just the lookup with their already-obtained Keystring/Access Token —
  no need to redo the OAuth authorize/approve step. That surfaced the
  REAL cause: `403 {"error":"Shared secret is required in x-api-key
  header."}`. This directly contradicted what `ops/ETSY_API_SETUP.md` and
  `scripts/etsy_oauth_setup.mjs` had claimed (PKCE means the Shared Secret
  is never needed) — true for the OAuth token exchange itself, false for
  Etsy's `/v3/application/*` REST endpoints, which need
  `x-api-key: {keystring}:{shared_secret}`. Fixed based strictly on this
  real error, not re-verified docs (sandbox egress to `developers.etsy.com`/
  `www.etsy.com` reconfirmed blocked this same session): added
  `ETSY_API_SHARED_SECRET` as a 5th required secret across
  `scripts/etsy_get_shop_id.mjs`, `scripts/etsy_oauth_setup.mjs`,
  `scripts/etsy_publish.mjs` (env check + masked + `x-api-key` header),
  `.github/workflows/etsy-publish.yml`, `ops/ETSY_API_SETUP.md`, and
  `status/CURRENT_STATUS.json` — correcting the earlier wrong claim rather
  than leaving it stand. OAuth itself was never redone. NEXT: owner runs
  `node scripts/etsy_get_shop_id.mjs` once more with the Shared Secret
  included; once all 5 secrets are in place, trigger `etsy-publish.yml`
  and iterate the same way (real error → minimal fix → re-run) if the
  listing-creation call rejects a field.

- 2026-09-03 (owner-directed, formalize Gumroad + build sale detection):
  owner asked to (1) formally record the Gumroad publish success as a live
  capability and (2) determine the minimal path for the AI to detect and
  record a real Gumroad sale, in priority order: official API → low-cost
  GitHub Actions → Routine-launch check → human dashboard fallback — with
  the explicit goal of not over-building monitoring infra and keeping
  detection cost well under the expected revenue (same discipline as the
  Stripe monitor). (1) EXECUTE: added a canonical
  `status/CURRENT_STATUS.json.live_capabilities` list distinguishing
  "confirmed working end-to-end" from "built/deployed"; also found and
  fixed a real idempotency bug while in `scripts/gumroad_publish.mjs`
  (`saveState()`'s two calls each started from the original in-memory
  `state`, so the 2nd call silently dropped the 1st call's `product_id` —
  confirmed by the fact `status/gumroad_listing.json` was actually missing
  `product_id` on disk; restored it from the already-recorded
  `EVENTS.jsonl` fact and fixed the function to accumulate). (2) OBSERVE:
  read Gumroad's actual production source directly (not docs) —
  `api/v2/sales_controller.rb` confirms `GET /v2/sales` is real, requires
  the `view_sales` OAuth scope, supports `after`/`before`/`page_key`;
  `purchase.rb#as_json(version: 2)` gives the exact response fields
  (`order_id`, `price` cents, `currency`, `created_at`, `refunded`,
  `gumroad_fee`). Also confirmed `view_sales` is an *optional* scope, not a
  default one (`doorkeeper.rb`), and a personal access token's scope comes
  from its owning OAuth application (`oauth_application.rb`) — so whether
  the existing `GUMROAD_ACCESS_TOKEN` actually has `view_sales` is a real
  open question, not assumed either way. DECIDE: tier 1 (official API) is
  viable and cheapest; tier 2 (GitHub Actions) needs no new schedule since
  the Stripe cron already fires every 4h — just add one step to it. EXECUTE:
  wrote `scripts/gumroad_sales_monitor.mjs` (dedup by `order_id`, converts
  USD→JPY at the same ~150 rate used elsewhere, records the Gumroad fee as
  a cost-ledger entry, fails soft with a clear log message rather than
  guessing if the API rejects the call for scope/permission reasons — same
  "diagnose from the real response, don't retry blindly" discipline used
  for the publish fix); added it as a step in the existing
  `sales-monitor.yml` job (zero new Actions runs); documented the full
  priority order, the open scope question, and the tier-4 fallback in
  `ops/GUMROAD_API_SETUP.md`. Added `gumroad_fees` to
  `status/cost_ledger.json`'s category list. NEXT: trigger
  `sales-monitor.yml` once and read its job log to find out empirically
  whether `view_sales` is actually granted — if not, ask the owner
  (low-priority, non-blocking) to regenerate the token with that scope, per
  the documented fallback; do not build a second monitoring path.

- 2026-09-02→03 (owner-directed, live Gumroad publish): owner registered
  `GUMROAD_ACCESS_TOKEN` as a repo secret and asked for a real end-to-end
  publish, not just capability-building — final judgment on product name/
  price/description/publish conditions explicitly delegated to the AI.
  OBSERVE/EXECUTE: triggered `gumroad-publish.yml` via GitHub MCP. 1st run
  FAILED with a real API error: `POST /v2/direct_uploads -> 400
  {"error":"content_type must be JPEG, PNG, GIF, or video."}` — this
  Rails ActiveStorage endpoint (used in the previous version of the script)
  turned out to be media-only, not usable for an arbitrary downloadable
  ZIP. DIAGNOSE: read Gumroad's actual production
  `app/controllers/api/v2/files_controller.rb` directly (not docs, not
  speculation) and found the real digital-file path is a separate
  S3-multipart flow: `POST /v2/files/presign` → `PUT` the bytes to the
  returned presigned URL → `POST /v2/files/complete`. Cross-checked the
  `files` array entry shape for `POST /v2/products` against
  `antiwork/gumroad-cli`'s own Go source (`internal/cmd/products/
  file_updates.go`): `{id, url}` using the presign response's `key` as
  `id`. DECIDE: minimal fix only, no speculative retry — rewrote
  `uploadFile()` in `scripts/gumroad_publish.mjs` to the correct flow, kept
  everything else (idempotency via `status/gumroad_listing.json`,
  `marketing/gumroad_listing_config.json`'s existing $9 name/price/
  description — no market evidence to change it) unchanged. EXECUTE:
  `node --check`, `leak_check.mjs`, `promotion_check.mjs` all clean;
  committed, pushed to `claude/beautiful-goodall-nfphnl`; re-triggered the
  Action. 2nd run SUCCEEDED: file uploaded to S3, draft product created,
  published. RESULT: a real, live, third-party-purchasable listing —
  https://feverish50.gumroad.com/l/uhajxo ($9, "ChatGPT Prompts + AI
  Automation Toolkit"). `status/gumroad_listing.json` and
  `status/EVENTS.jsonl` were auto-committed by the Action itself
  (`e810ea3`). No sale yet — reported explicitly as "listing published",
  distinct from "first sale." Updated `status/CURRENT_STATUS.json`
  (channel_inventory.gumroad → live_published, blockers/human_actions_
  required drop the Gumroad item, current_focus/action/next_action/
  latest_result/latest_strategy_decision rewritten), this file, and
  `reports/data/2026-09-03.json`. Logged this run's cost to
  `status/cost_ledger.json`. NEXT: watch for the first real Gumroad sale;
  primary focus returns to the Etsy OAuth grant (the last remaining
  blocked channel) per the owner's own stated sequencing.

- 2026-09-02 (scheduled cadence run, day 2, early-stop): OBSERVE — no open GitHub
  issues, no "Promotion blocked" issue, main in sync with this branch (c5113d9),
  Sales Monitor's latest run (2026-09-02T04:35 UTC) detected no new revenue.
  Rather than assume yesterday's blocker state carried over unchanged, actually
  triggered `etsy-publish.yml` and `gumroad-publish.yml` via GitHub MCP
  (`actions_run_trigger`) — costs only free Actions minutes. Both jobs completed
  with `conclusion=success`, but each run's own log step is explicitly labeled
  "no-ops without credentials", and neither `status/etsy_listing.json` nor
  `status/gumroad_listing.json` was created. DIAGNOSE: unchanged — both the Etsy
  OAuth token and GUMROAD_ACCESS_TOKEN are still not granted, now confirmed
  empirically rather than by assumption. DECIDE: no revenue-moving action is
  available; producing new content/product would be busywork since the
  bottleneck is channel access, not offer/demand. Cadence kept at 1x/day — only
  one day since the blocker was last confirmed, not enough evidence yet to slow
  further. EXECUTE (near-zero cost): wrote `reports/data/2026-09-02.json`
  (was empty, generated by the scheduled Sales Monitor run only as a stub),
  logged this run's estimated cost (~$0.35) to `status/cost_ledger.json`.
  NEXT: unchanged — trigger both Actions again once their respective secrets
  exist; watch for the first real sale.

- 2026-09-01 (owner-directed, Gumroad browser/Computer-Use re-check):
  owner asked to try Browser/Computer-Use publishing for Gumroad
  specifically, before treating the REST API as the path — same priority
  order as the earlier Etsy investigation, deliberately re-applied fresh
  rather than assumed to carry over. Investigated with live tests this
  turn: re-searched the tool surface (no browser-driving/computer-use tool,
  same as before), and ran a direct connectivity test — `gumroad.com`,
  `app.gumroad.com`, and `gumroad.com/login` all returned `403
  connect_rejected` at the sandbox egress proxy, confirming a whole-domain
  block, not a narrower subdomain restriction like the earlier Creem-docs
  case. No Gumroad credentials/session exist anywhere accessible to the AI
  either way. CONCLUSION: browser-based publish is technically impossible
  in this session (no tool + no network path), which per the owner's own
  fallback rule confirms the already-built REST API pipeline
  (`scripts/gumroad_publish.mjs`) as necessary, not merely convenient. No
  code changes needed — recorded the investigation in
  `ops/GUMROAD_API_SETUP.md`, `status/CURRENT_STATUS.json`, and
  `status/EVENTS.jsonl`. NEXT: unchanged — GUMROAD_ACCESS_TOKEN grant
  remains the active next step for this lane.

- 2026-09-01 (owner correction #2 — verification rigor on Gumroad):
  owner flagged that the just-built Gumroad pipeline rested on an
  insufficiently verified premise: `scripts/gumroad_publish.mjs` shelled
  out to `antiwork/gumroad-cli`, trusting that CLI's own README/SKILL.md
  as evidence its `products create`/`publish` commands work. Owner's own
  check of Gumroad's official help center found the CLI documented there
  only for Pages/Profile publishing, not product management, and
  distinguished it from an unrelated third-party "GumroadPro CLI" that
  shows up in searches — a real category error risk (repo-org CLI ≠
  officially-documented-and-supported CLI). OBSERVE: re-ran verification
  from scratch, this time reading Gumroad's actual production Rails
  source directly (`antiwork/gumroad` — `config/routes.rb` +
  `app/controllers/api/v2/{links,direct_uploads}_controller.rb`) instead
  of the CLI's docs or WebSearch summaries, one of which had separately
  (and, per the source, incorrectly) claimed `POST /v2/products` returns
  404. The routes and controller logic are real: `POST /v2/products`
  (create, requires `edit_products` scope, no feature flag, creates in
  draft), `PUT /v2/products/:id/enable` (publish), and a standard Rails
  ActiveStorage direct-upload flow (`POST /v2/direct_uploads` → presigned
  PUT → reference the blob in the `files` array) for the deliverable
  file. DECIDE: drop the CLI dependency entirely per the owner's explicit
  instruction (no first- or third-party CLI), rebuild
  `scripts/gumroad_publish.mjs` to call the REST API directly, and switch
  the owner's one-time grant to Gumroad's long-documented simplest path
  (Settings → Advanced → generate a personal access token) instead of the
  CLI's device-flow login — fewer moving parts, nothing to install.
  EXECUTE: rewrote the publish script (fetch-based, MD5 checksum for the
  ActiveStorage blob, defensive parsing since two response-shape details
  are still unverified against a live call), simplified
  `.github/workflows/gumroad-publish.yml` (no CLI install step), replaced
  `ops/GUMROAD_CLI_SETUP.md` with `ops/GUMROAD_API_SETUP.md`. Did NOT
  claim full certainty this works — explicitly flagged the two remaining
  unverified details (direct_uploads response field names; files-array
  entry shape) rather than presenting the rebuild as fully confirmed.
  Strategic conclusion held but now on firmer footing: Gumroad's grant is
  still simpler than Etsy's, verified against primary source this time,
  not repo-adjacent documentation.

- 2026-09-01 (owner correction + Gumroad activation): owner corrected the
  prior inventory's core error — "no GitHub record" had been wrongly read
  as "capability doesn't exist." Owner directly confirmed: Gumroad account
  open (Japan, bank registered, Stripe-based identity verification done,
  prior warnings resolved, $100 JP payout threshold seen) and Creem account
  open (Store/business info, KYC/PEP, bank/payout done, last known state
  under review). Both existed before this experiment's GitHub memory
  captured them — a migration gap, not a capability that was never granted.
  RE-EVALUATED (not just recorded) using real verification this time:
  WebSearch/WebFetch confirmed Gumroad ships an official CLI
  (`antiwork/gumroad-cli`) purpose-built for CI/agent product publishing —
  single access-token auth (device-flow login, no OAuth app registration),
  full create/upload/publish support. This is genuinely lower friction than
  Etsy's OAuth+PKCE flow, and the account is already fully KYC'd/bank-ready.
  DECIDED: build the Gumroad publish capability now, as a parallel low-cost
  addition to Etsy (not a replacement — Etsy still has the stronger
  validated buyer-search demand). Creem stays deprioritized regardless of
  its confirmed account/API, since it duplicates Stripe's payment-rail role
  with no identified distribution advantage — recommended a quick owner
  status re-check, not a build. Corrected `status/CURRENT_STATUS.json`,
  this file, and `status/EVENTS.jsonl` with an explicit verification-level
  taxonomy (confirmed_in_repo / confirmed_by_owner / status_unknown /
  needs_re_verification) so this class of error — silence read as absence —
  isn't repeated.

- 2026-09-01 (owner-directed, full channel inventory): owner asked to
  inventory ALL sales channels (Stripe/Etsy/Gumroad/Creem/Lemon Squeezy)
  before continuing further with Etsy, specifically to catch any
  already-human-opened capability being overlooked while new API
  infrastructure gets built. OBSERVE: checked git history, EVENTS.jsonl,
  GitHub issues, and connectors for each. No repo evidence Gumroad or Creem
  were EVER opened — both remain 2026-08-25 research-stage skips, not
  human-opened channels; the 2026-08-25 Gumroad skip reason ("no
  create-product API") was itself factually wrong — Gumroad does have one,
  and it's lower-friction than Etsy's OAuth (personal access token, no PKCE
  redirect flow). DIAGNOSE: the real question isn't "which is technically
  easiest" but "which is confirmed to actually exist" — building toward an
  unconfirmed channel would repeat the exact mistake being corrected, aimed
  at a channel instead of at a blocker. DECIDE: keep Etsy as the primary
  next action (confirmed open + validated demand + fully scoped remaining
  step); do not build any Gumroad/Creem integration code without confirmed
  account existence; ask the owner one factual, non-blocking status
  question instead of guessing. Creem specifically stays deprioritized even
  if opened, since it's payment infra duplicating Stripe's already-live
  role with no identified distribution advantage. Lemon Squeezy: no
  re-investigation, stays abandoned per explicit instruction. EXECUTE:
  recorded the full inventory + reasoning in
  `status/CURRENT_STATUS.json.channel_inventory`, this file, and
  `status/EVENTS.jsonl`. No code changes. NEXT: Etsy OAuth grant remains
  the active next step (walkthrough already given); Gumroad/Creem wait on
  the owner's answer.

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

- 2026-09-01 (official window opens, owner check-in): owner asked to confirm everything
  is ready. OBSERVE: live Stripe MCP re-confirms ¥0 (0 charges). Owner stated "Stripe is
  connected via MCP" -- verified this is real but is a DIFFERENT thing from the
  `STRIPE_RESTRICTED_KEY` repo secret: MCP only works while a Claude session is live;
  pulled the actual sales-monitor.yml job log (2026-08-31T21:28 JST run) and confirmed
  the env var is empty and the script no-ops. So the 4-hourly headless revenue monitor
  is still blind between loop sessions. All three human-gated blockers (Etsy shop,
  STRIPE_RESTRICTED_KEY, X credentials) unchanged since 2026-08-26. Gave the owner an
  honest, non-optimistic status: infra (payment rail, reporting, promotion pipeline) is
  solid and tested, but the actual demand-side lever (Etsy) hasn't moved, so day 1 of
  the official window starts from the same ¥0 as prep. NEXT: same as ever — Etsy KYC
  is the single highest-leverage unblock; STRIPE_RESTRICTED_KEY is second (closes the
  headless-monitoring gap even before Etsy).

- 2026-09-01 (official day 1, scheduled cadence run, early-stop): OBSERVE — this
  fired session had NO Stripe MCP tools (auth required, unavailable headlessly),
  confirming that direct-MCP access is session-dependent, not guaranteed on every
  fire as 2026-08-28 speculated. Verified via GitHub API instead: 0 open issues,
  no "Promotion blocked" issue (main already fast-forwarded to the prior branch
  head 0136763 — promotion pipeline working as designed), and the Sales Monitor
  Action's latest run (2026-09-01T05:09 UTC, #23) completed but produced no new
  revenue commit. DIAGNOSE: unchanged — all three human-gated blockers (Etsy shop,
  STRIPE_RESTRICTED_KEY, X credentials) still open since 2026-08-26; no new
  evidence to act on. DECIDE: no revenue-moving action is available; producing
  more content/product without a distribution channel would be negative-EV
  busywork (consistent with prior iterations' reasoning). EXECUTE (near-zero
  cost, correctness only): found and fixed a real gap — `reports/data/2026-09-01.json`
  was missing, so the Day-1 public report (required daily during the official
  period per experiment config) had rendered with empty narrative fields. Wrote
  it honestly (¥0 revenue, blockers unchanged, no wins/product this run). Logged
  ~$0.40 official-period cost. NEXT: unchanged — Etsy KYC is still the single
  highest-leverage unblock; STRIPE_RESTRICTED_KEY second (closes headless
  monitoring gap even before Etsy). Cadence (1x/day) confirmed still rational —
  nothing this run would have differed at a higher frequency.

- 2026-09-01 (owner correction, record-accuracy fix, not a strategy change):
  owner pointed out `human_actions_required` incorrectly conflated a true
  blocker (Etsy shop KYC/bank) with two optional capability grants
  (`STRIPE_RESTRICTED_KEY`, X API credentials) that only enhance monitoring/
  commentary and do not gate revenue. Reclassified in
  `status/CURRENT_STATUS.json`: `human_actions_required` now holds only Etsy
  shop access + Stripe payout/bank/KYC settlement; the two optional items
  moved to `additional_permissions_requested` with an explicit per-run
  observation fallback (Stripe MCP if available this run, else
  revenue_ledger.json + sales-monitor log; never assume MCP presence/absence
  across runs). Diagnosed bottleneck is unchanged: Etsy shop access remains
  the true binding constraint.

- 2026-09-01 (owner-directed capability grant, off-cycle judgment run):
  owner reported the Etsy shop is now open (KYC/bank/card done, taxpayer info
  confirmed) and explicitly delegated ALL listing/pricing/content/strategy
  decisions to the AI going forward. This qualifies as an off-cycle trigger
  event (`new_capability_granted`) per `status/cadence.json`'s gate —
  expected marginal benefit clearly exceeds the marginal AI cost, since it
  could unlock the entire revenue mechanism. RE-DIAGNOSE: shop access alone
  doesn't publish anything — there was no technical mechanism to write a
  listing to Etsy (no MCP connector, no API integration, no browser session
  with Etsy credentials). This is the actual re-diagnosed bottleneck, not
  "no distribution channel" anymore. DECIDE: build the publish mechanism via
  Etsy API v3 + OAuth (the sanctioned, ToS-compliant path — explicitly
  avoided browser-automating the human seller dashboard, which risks
  anti-bot detection / ToS violation and account risk) rather than asking
  the owner to manually paste the listing (would violate the standing "not a
  copy/paste operator" rule, and an AI-executable path exists). EXECUTE:
  built `marketing/etsy_listing_config.json` (machine-readable content,
  reusing the existing $9 kit/images/ZIP unchanged — no market evidence yet
  to justify changing price or copy pre-launch), `scripts/etsy_publish.mjs`
  (create draft → upload images → upload digital file → activate; idempotent
  via `status/etsy_listing.json` to prevent duplicate listings; masks
  rotating OAuth tokens from public Action logs via `::add-mask::`),
  `scripts/etsy_oauth_setup.mjs` (local-only PKCE OAuth helper for the
  owner — cannot run in this sandbox, no egress to Etsy), and
  `.github/workflows/etsy-publish.yml` (`workflow_dispatch`, triggerable by
  a future Claude session via GitHub MCP with no further owner action).
  Documented the mechanism, the refresh-token-rotation caveat, and the
  "untested against the live API" honesty note in `ops/ETSY_API_SETUP.md`.
  Updated `status/CURRENT_STATUS.json` blockers: Etsy shop KYC is resolved;
  the Etsy OAuth token is now the sole true `human_actions_required` item.
  Did NOT claim a listing is live or a sale occurred — nothing has actually
  been published to Etsy yet. NEXT: once the four `ETSY_*` secrets exist,
  trigger `etsy-publish.yml` (AI can do this itself via GitHub MCP), verify
  the result, iterate against the live API's actual error messages if any
  field is rejected.

- 2026-09-01 (owner-directed, browser/Computer-Use investigation): owner
  asked to keep the Etsy API pipeline as a future stable capability but NOT
  treat it as the required path for the first listing — try a Browser/
  Computer-Use route through the Seller Dashboard first, since the goal is
  fast real revenue, not a finished API. Investigated genuinely: ToolSearch
  (multiple keyword sets) and ListConnectors found no interactive
  browser-driving/computer-use tool in this session — only a read-only fetch
  tool. Confirmed Chromium IS installed locally, but a live connectivity
  test shows sandbox egress to `www.etsy.com` is blocked at the network
  policy level (403 connect_rejected), matching the same class of block
  already documented for other external hosts during prep. No Etsy
  credentials/session exist anywhere accessible to the AI either way.
  Considered and rejected a 4th option (GitHub-Actions browser automation
  using the owner's real Etsy password): likely to trigger Etsy's bot/2FA
  detection on a new automated login (human-only anyway) and risks violating
  Etsy's ToS against automating the human seller UI outside the API — a real
  risk to the only working channel, squarely matching the owner's own
  "technically unstable / ToS-inappropriate" fallback condition. CONCLUSION:
  the Etsy API v3 + OAuth grant (already built) is confirmed necessary, not
  merely convenient — recorded in `ops/ETSY_API_SETUP.md`'s new "why not
  browser automation" section, `status/EVENTS.jsonl`, and
  `status/CURRENT_STATUS.json`. No code changes needed (the pipeline was
  already built); this iteration was investigation + honest recording only.
  NEXT: unchanged — the Etsy OAuth grant remains the single true blocker.

- 2026-08-28 (owner-directed, capability build): the owner confirmed the prior
  branch-push finding was a genuine harness policy (Routine sessions push to a
  `claude/**` branch, never `main`) and asked for an unattended promotion layer
  instead of manual PR merges each time. BUILT: `.github/workflows/promote-branch.yml`
  (fast-forward-only `claude/**` → `main` auto-promotion, gated on ahead/0-behind +
  `leak_check.mjs` + new `scripts/promotion_check.mjs`; opens/closes a single
  "Promotion blocked: <branch>" GitHub issue instead of ever merging or force-pushing)
  + `scripts/promotion_check.mjs` (structural JSON/ledger sanity gate). Documented the
  mechanism in `ops/LOOP_PROTOCOL.md`, `ops/LOOP_PROMPT.txt`, `ops/ROUTINE_SETUP.md`.
  Smoke-tested by pushing this very change on `claude/jolly-albattani-f01mzh` (see
  EVENTS.jsonl for the run result). This is infrastructure, not a revenue action —
  logged as `other`/`ai_compute` cost, not attributed to any revenue lane.
