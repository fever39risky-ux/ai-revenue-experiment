# Gumroad publish setup — one-time access-token grant

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

## What the script actually does (verified against Gumroad's source)

1. `POST /v2/direct_uploads` — registers the deliverable ZIP for a direct
   (ActiveStorage) upload; gets back a presigned upload URL + a blob
   reference.
2. `PUT` the raw file bytes to that presigned URL.
3. `POST /v2/products` — creates the listing (name/price/description/tags/
   the uploaded file). Gumroad creates it in **draft** state automatically.
4. `PUT /v2/products/:id/enable` — publishes it.

## Known limitation: two details still unverified against a live call

The route and controller logic are read directly from Gumroad's production
source, which is high-confidence — but two specific details were not
confirmed against an actual live request, and are the most likely spots to
need a one-round fix if the first run fails:
- The exact JSON key names in the `direct_uploads` response (the presigned
  URL, headers, and blob reference field name).
- The exact shape Gumroad expects for an entry in the `files` array passed
  to `POST /v2/products` (this assumes `{ signed_id, name }`).

`scripts/gumroad_publish.mjs` fails loudly with the raw API response if
either isn't where expected, rather than silently guessing — check the
Action's job log and adjust the script against the real error.

## Cover image / thumbnail: deferred, not built

Gumroad also has `POST /v2/products/:id/covers` and `.../thumbnail`
endpoints, but their exact request format wasn't verified this round. The
first version of this pipeline publishes a working text+price+file listing
without a cover image — a real but non-blocking gap; add cover upload in a
later iteration once the core flow is confirmed working.

## Currency check

`marketing/gumroad_listing_config.json` prices the listing at **9.00 USD**
(the API takes price in cents; the script converts). Adjust `price`/
`currency` in that file first if the account settles in a different
currency.
