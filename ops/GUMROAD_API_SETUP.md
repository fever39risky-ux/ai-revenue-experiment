# Gumroad publish setup — one-time access-token grant

## STATUS: DONE — listing is live

The grant below was completed by the owner and the publish pipeline ran
successfully end-to-end on 2026-09-02. A real listing is live and
purchasable at **https://feverish50.gumroad.com/l/uhajxo** ($9, "ChatGPT
Prompts + AI Automation Toolkit"). No further owner action is needed for
Gumroad unless building a new listing. The rest of this doc is kept for
reference/history.

## Why API, not Browser/Computer-Use (investigated 2026-09-01, second time)

Before finalizing the API path, the owner asked to try browser automation
FIRST — same priority order as the earlier Etsy decision, re-applied to
Gumroad specifically rather than assumed to carry over. Investigated fresh,
with live tests this time, not reused claims:

1. **No interactive browser-driving/Computer-Use/GUI-automation tool is
   exposed to this session.** Re-searched the full tool surface; only a
   read-only fetch-and-summarize tool exists (cannot click, type, fill
   forms, or upload files).
2. **No network path to Gumroad at all**, confirmed by a direct live test:
   `gumroad.com`, `app.gumroad.com`, and `gumroad.com/login` all returned
   `403 connect_rejected` (organization policy) at the sandbox's egress
   proxy — not a narrower subdomain-specific block, the whole domain.
3. **No existing Gumroad login/session** exists anywhere accessible to the
   AI — the owner's account access lives only in their own browser,
   correctly never shared.

(1) and (2) alone make browser-based publish technically impossible in this
session — reaching the product-creation screen, uploading files, or
publishing without human confirmation are moot questions when there is no
network path to the site at all. Per the owner's own fallback rule
("confirmed technically impossible → use the API path"), this confirms the
REST API pipeline below as necessary, not merely convenient.

## Correction (2026-09-01): dropped the CLI dependency

An earlier version of this pipeline was built around Gumroad's first-party
CLI (`antiwork/gumroad-cli`), whose own docs described full product
create/publish commands. The owner flagged a real gap in that verification:
Gumroad's official help center only documents the CLI for Pages/Profile
publishing, not product management, and a separate check suggested the
`POST /v2/products` API endpoint might not be implemented (returns 404).

Re-verified from the actual source, not secondary claims: Gumroad's own
production Rails repo (`antiwork/gumroad` on GitHub — `config/routes.rb`
and `app/controllers/api/v2/{links,direct_uploads}_controller.rb`) shows
`POST /v2/products`, `PUT /v2/products/:id`, and `PUT /v2/products/:id/enable`
(publish) are real, implemented routes, gated only by the `edit_products`
OAuth scope, no feature flag. The earlier "404" claim doesn't match what's
in the actual controller code. This pipeline now calls that REST API
**directly** (`scripts/gumroad_publish.mjs`) — no CLI, first-party or
third-party, is used or required.

## What's needed

Your Gumroad account is already fully ready (confirmed by you, 2026-09-01):
account open, Japan, bank account registered, identity verification via
Stripe done, prior warnings resolved. The only remaining step is generating
a personal access token — Gumroad's long-documented, simplest API auth path
for using the API on your own account (distinct from registering a full
OAuth application, which is for apps acting on OTHER people's accounts).

## Steps (a couple of minutes, in your browser — nothing to install)

1. Sign in to Gumroad, go to **Settings → Advanced**.
2. Find the API / Applications section and generate a personal
   **access token** for your own account (Gumroad's help center documents
   this as the simpler path when you only need API access to your own
   account, as opposed to registering a full OAuth application).
3. Copy the token.
4. Add it as a GitHub repo secret (never paste it into chat): **repo →
   Settings → Secrets and variables → Actions → New repository secret** —
   Name: `GUMROAD_ACCESS_TOKEN`, Value: the token from step 2.
5. That's it — one secret. The next Claude session (or you, via the
   Actions tab → "Gumroad publish" → Run workflow) triggers
   `.github/workflows/gumroad-publish.yml`, which runs
   `scripts/gumroad_publish.mjs` to upload the file, create the draft
   product, and publish it.

## What the script actually does (confirmed by a real successful run, 2026-09-02)

1. `POST /v2/files/presign` — registers the deliverable ZIP for an
   S3-multipart upload; returns `{ upload_id, key, parts: [{ part_number,
   presigned_url }] }`.
2. `PUT` the raw file bytes to the part's presigned URL; read back the S3
   `ETag` response header.
3. `POST /v2/files/complete` — completes the multipart upload with
   `{ upload_id, key, parts: [{ part_number, etag }] }`; returns
   `{ file_url }`.
4. `POST /v2/products` — creates the listing (name/price/description/tags/
   `files: [{ id: key, url: file_url, display_name }]`). Gumroad creates it
   in **draft** state automatically.
5. `PUT /v2/products/:id/enable` — publishes it.

**Correction from an earlier version of this doc:** step 1 originally used
`POST /v2/direct_uploads` (Rails ActiveStorage's generic direct-upload
endpoint). The first live run rejected this with `400 {"error":"content_type
must be JPEG, PNG, GIF, or video."}` — that endpoint is media-only, not for
arbitrary downloadable files. Diagnosed by reading Gumroad's actual
production `files_controller.rb` directly, fixed to the S3-multipart flow
above, and the very next run succeeded. Both previously-flagged uncertain
details (the file-upload response shape and the `files` array entry shape,
`{ id: key, url: file_url }`) are now **confirmed correct by a live
successful publish**, not just source-reading.

## Cover image / thumbnail: deferred, not built

Gumroad also has `POST /v2/products/:id/covers` and `.../thumbnail`
endpoints, but their exact request format wasn't verified this round. The
first version of this pipeline publishes a working text+price+file listing
without a cover image — a real but non-blocking gap; add cover upload in a
later iteration once the core flow is confirmed working.

## Sales detection (revenue monitoring, added 2026-09-03)

Goal: never miss a real Gumroad sale in `status/revenue_ledger.json`, at a
detection cost that stays well under the expected revenue from a $9 item —
mirroring the existing Stripe monitor's cost discipline, not building
monitoring infrastructure for its own sake. Evaluated in priority order:

1. **Official API (`GET /v2/sales`)** — verified to exist and be real by
   reading Gumroad's actual production source directly
   (`app/controllers/api/v2/sales_controller.rb`,
   `app/models/purchase.rb`), same methodology used for the publish
   pipeline. Requires the `view_sales` OAuth scope; returns `order_id`
   (dedup key), `price`/`currency` (cents), `created_at`, `refunded`,
   `gumroad_fee`. **Chosen — this is what `scripts/gumroad_sales_monitor.mjs`
   calls.**
2. **GitHub Actions, low-cost** — implemented by adding one step to the
   *existing* `sales-monitor.yml` cron (every 4h, already running for
   Stripe) rather than creating a new scheduled workflow. This adds **zero**
   new Actions runs — just one extra HTTP GET inside a job that fires
   anyway. Reuses `GUMROAD_ACCESS_TOKEN` (already granted).
3. **Routine-launch check** — not needed as a separate mechanism: every
   scheduled/off-cycle session already reads `status/revenue_ledger.json` +
   the sales-monitor Action's own job log as part of its normal observe
   step (same pattern already documented for Stripe in `ops/AGENT_LOOP.md`'s
   optional-capabilities section). No new code required for this tier.
4. **Human dashboard check (final fallback)** — only needed if tier 1 turns
   out to be blocked by scope. See below.

### Known open question: does the existing token have `view_sales`?

A personal access token's scopes come from the OAuth application it
belongs to (`Doorkeeper::Application#get_or_generate_access_token` uses
`self.scopes`, verified against `app/models/oauth_application.rb`), and
`view_sales` is an **optional** scope, not a default one (verified against
`config/initializers/doorkeeper.rb`). The existing `GUMROAD_ACCESS_TOKEN`
is confirmed to carry `edit_products` (the publish run succeeded), but
`view_sales` was never separately confirmed — this is a genuinely open
question, not assumed either way.

`scripts/gumroad_sales_monitor.mjs` is written to find out empirically, the
same way the file-upload path's real shape was found: it calls the real
API and, if the response indicates missing scope/permission, logs that
plainly and **no-ops** (exits 0, does not fail the workflow, does not
guess or retry). Check the `sales-monitor.yml` job log after it next runs
to see which case applies.

**If `view_sales` turns out to be missing** (tier 1 fails): the fallback is
tier 4, not a new build — ask the owner to either (a) regenerate the
Gumroad access token with the `view_sales` scope included (same Settings →
Advanced flow as before, a couple of minutes, non-blocking for the
existing listing), or (b) periodically glance at the Gumroad
sales/analytics dashboard and report any sale. Not treated as urgent: at
$9/sale the cost of a short delay in automated detection is far below the
cost of building a second monitoring path.

**Resolved 2026-09-04, empirically:** the `sales-monitor.yml` job log
(run `33691834156`, and every scheduled run since) shows
`gumroad_sales_monitor: 0 new sale(s). official rev=... prep rev=...` —
that message only prints after successfully parsing a real `GET /v2/sales`
response (the scope/permission-error branch logs a different, distinct
message and would never reach this line). `view_sales` IS granted on the
existing token. No owner action needed for sales detection.

## Cover image / thumbnail (built 2026-09-04)

Verified against Gumroad's actual production source: `config/routes.rb`
(`POST /v2/products/:id/thumbnail` -> `thumbnails#create`, `POST
/v2/products/:id/covers` -> `covers#create`) and
`thumbnails_controller.rb`/`covers_controller.rb`, both gated by
`edit_products` (already granted, no new scope needed). Both accept
either a `signed_blob_id` (standard Rails ActiveStorage direct upload) or
a plain `url`. Unlike the digital ZIP file (which needed the separate
S3-multipart `/v2/files` flow because `/v2/direct_uploads` rejects
non-media content types), a PNG image IS exactly the content type
`/v2/direct_uploads` accepts — so the standard flow works directly:
`POST /v2/direct_uploads` (blob metadata + MD5 checksum) -> `PUT` the
bytes to the returned presigned URL -> `POST
/v2/products/:id/thumbnail` with the resulting `signed_blob_id`.
Implemented in `scripts/gumroad_add_thumbnail.mjs`, wired as a follow-up
step in `gumroad-publish.yml` (idempotent, no-ops if already done or if
no product exists yet). Reuses the existing `marketing/etsy-images/01-cover.png`
— no new asset created. Only the `thumbnail` endpoint was built this
round (the single image Discover/search results and link previews show);
`covers` (the product-page gallery) is the same call shape and can be
added the same way later if there's evidence it matters.

## Currency check

`marketing/gumroad_listing_config.json` prices the listing at **9.00 USD**
(the API takes price in cents; the script converts). Adjust `price`/
`currency` in that file first if the account settles in a different
currency.
