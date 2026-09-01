# Operating Brief — resume point for the autonomous loop

Each autonomous session updates this file so the next one continues, not restarts.
Read this FIRST, then `ops/LOOP_PROTOCOL.md`. Last updated: 2026-09-01 (official day 1).

## Current phase
**OFFICIAL (Sep 1–30, Asia/Tokyo) — started 2026-09-01.** Official revenue ¥0,
official cost small (see cost_ledger.json). Target ¥50,000 equivalent in 30 days.
2026-09-01 update: the Etsy shop was granted (owner KYC/bank/card done). The
publish mechanism itself is now built (this session) but untested/ungranted —
still ¥0 revenue, not a running start yet, but the last blocking piece is
now purely technical (an OAuth grant), not a market or product problem.

## Current strategy (as of last update)
- **Primary revenue lane: Etsy** — the only channel with real cold-buyer search
  traffic. Listing content finalized (`marketing/etsy_listing_config.json`,
  reused from `marketing/ETSY_LISTING_KIT.md` unchanged — no market evidence
  yet to justify changing it) + 4 images + product zip. Shop is open. Publish
  mechanism (`scripts/etsy_publish.mjs` + `.github/workflows/etsy-publish.yml`)
  is built. **Blocked ONLY on a one-time Etsy API OAuth token grant** —
  `ops/ETSY_API_SETUP.md` — after which a Claude session triggers the publish
  Action itself (GitHub MCP `actions_run_trigger`), no manual paste needed.
- **Live now: Stripe store** (`/store/`, $19 payment link) — works, but no traffic
  on its own; treat as the destination the narrative/SEO funnels to.
- **Observability/commentary: X** via GitHub Actions (pending X API secrets, optional).
- **Gumroad: account confirmed by owner, being activated in parallel with
  Etsy** — see corrected inventory below. Publishes via Gumroad's official
  REST API v2 directly (verified against actual production source code,
  2026-09-01) — no CLI, first- or third-party. Still simpler grant than
  Etsy (one personal access token from account settings, no app registration).
- **Creem: account confirmed by owner, last known state = under review** —
  deprioritized regardless of approval outcome; functionally duplicates
  Stripe's already-live role, no distribution-value differentiator found.
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
| Etsy | **shop open / publishing capability setup in progress** | confirmed_by_owner (shop) + confirmed_in_repo (pipeline) | primary discovery channel | Publish pipeline built + spec-verified; blocked only on the owner's OAuth walkthrough |
| Gumroad | **account + KYC + bank confirmed by owner; current selling/product state needs re-verification** | confirmed_by_owner (account) + needs_re_verification (live selling status) | candidate parallel discovery channel | Owner: JP account, bank registered, Stripe-based identity verification done, prior warnings resolved, $100 JP payout threshold seen. Technical path RE-verified 2026-09-01T16:00 UTC against actual production source code (antiwork/gumroad routes.rb + controllers), after the owner flagged that the CLI's own docs weren't sufficient evidence -- confirmed `POST /v2/products`, file upload via direct_uploads, and `PUT .../enable` (publish) are real, unguarded routes requiring only the `edit_products` OAuth scope. Publishes via direct REST API calls, no CLI. **Built this iteration.** |
| Creem | **account + KYC + bank confirmed by owner; last known state = under review, current approval needs re-verification** | confirmed_by_owner (account) + needs_re_verification (approval outcome) | payment rail, duplicates Stripe's role | API confirmed to exist (verified live), but Creem doesn't add buyer-search discovery beyond what Stripe already provides. Deprioritized regardless of approval status absent a specific advantage — worth a quick owner re-check, not a build target. |
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
0. Gumroad account is confirmed (owner, 2026-09-01). Check whether
   `GUMROAD_ACCESS_TOKEN` now exists as a repo secret (`ops/GUMROAD_API_SETUP.md`
   has the owner's steps — Settings → Advanced → generate an access token,
   no CLI install). If so → trigger the "Gumroad publish" Action
   (`gumroad-publish.yml`), verify `status/gumroad_listing.json` shows a
   published product and the URL is real. If the API rejects a field or the
   direct-upload response shape doesn't match, read the job log and fix
   `scripts/gumroad_publish.mjs` against the exact response — the two
   specific unverified details are flagged in `ops/GUMROAD_API_SETUP.md`.
   Etsy stays primary; this is a parallel addition, not a substitute — don't
   let it distract from finishing Etsy.
1. If `ETSY_API_KEYSTRING`/`ETSY_ACCESS_TOKEN`/`ETSY_REFRESH_TOKEN`/`ETSY_SHOP_ID`
   now exist as repo secrets → trigger the "Etsy publish" Action yourself
   (`mcp__github__actions_run_trigger`, workflow `etsy-publish.yml`), then
   verify `status/etsy_listing.json` shows `state: "active"` and the URL is
   real. If the API rejected a field, read the job log, fix
   `scripts/etsy_publish.mjs` against the exact error, re-run — expected
   first-run friction, not a design failure.
2. Once live: queue an honest "listing is live" X post (not "first sale" —
   don't conflate a listing going live with a sale) and watch
   `status/etsy_listing.json` / Etsy's own order notifications for the first
   real purchase.
3. Else (still no OAuth grant) → advance a non-blocked lane: sharpen store
   SEO/conversion, or evaluate a 2nd SKU only once there's real Etsy signal
   to act on (not before — avoid duplicate products with no evidence).
4. Always: check for any real sale first; if found, it's the headline.

## Blocked on human — TRUE blocker only (revised 2026-09-01)
- **Etsy API v3 OAuth token** (`ops/ETSY_API_SETUP.md`, ~10-15 min): the shop
  itself is open, but Etsy requires OAuth for any API write and there is no
  simpler restricted-key option. This is now the single binding constraint on
  the next revenue milestone — everything else (content, images, ZIP, publish
  script, workflow) is ready.
- (Stripe payouts/bank/KYC settlement is also human-only, but is about money
  reaching the owner, not about whether the AI can operate — not a lane blocker.)

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

## Open tasks / lanes
- [ ] Trigger Etsy publish Action once OAuth secrets exist (AI-executable, no owner step)
- [ ] Verify the live Etsy listing matches the config; fix/re-run if the API rejected a field
- [ ] Wire Stripe restricted key → sales monitor live (optional)
- [ ] Wire X credentials → live commentary (optional)
- [ ] Evaluate a 2nd product/variant only once there's real Etsy signal to act on
- [ ] Continuously: observe → decide → act → log → adjust

## Capabilities built (see ops/EXECUTION_SYSTEM.md + ops/AUTOMATION.md)
Stripe rail; Etsy kit + image renderer; Etsy API v3 publish pipeline (config +
script + workflow + local OAuth helper, untested pending credentials);
daily-report generator; revenue ledger; leak checker; sales monitor;
revenue→X hook; X poster; phase-aware hub. 0 standing subagents (research
agents were one-shot and pruned).

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
Official revenue: ¥0. Official cost: ¥60 (as of 2026-09-01 cadence run). Preparation
revenue: ¥0 (verified directly against live Stripe on 2026-08-28: 0 charges).
Preparation cost: ¥788. Human labor: ~15 min.

## Loop self-test log
- 2026-08-25T23:18Z — VALIDATION SMOKE-TEST of the durable Routine FAILED to persist.
  The fired fresh session ran a full iteration (cloned repo, read memory, reasoned;
  ~46k output tokens, $3.30) but could NOT push to GitHub: routine sessions minted
  via the MCP tool carry no repo push credentials or connectors, and lack the
  add_repo tool. No commit/branch/PR was produced. FIX: owner recreates the Routine
  from the claude.ai Routines UI bound to this repo (see ops/ROUTINE_SETUP.md).
  The MCP-created trigger trig_01YQ2i3B1fb36aGG2wmycdeT is DISABLED to avoid wasted fires.

## Iteration log
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
