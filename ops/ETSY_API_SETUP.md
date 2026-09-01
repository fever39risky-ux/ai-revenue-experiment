# Etsy API v3 setup — one-time OAuth grant

## Why API/OAuth, not browser automation (investigated 2026-09-01)

Before building this, and again when asked to prioritize it, the AI checked
whether a browser/Computer-Use capability could publish directly through the
Etsy Seller Dashboard instead, to avoid asking for any technical grant at
all. Confirmed NOT viable, for three independent reasons:

1. **No interactive browser-driving tool is exposed to the Claude session
   that does this work.** Only a read-only fetch-and-summarize tool exists
   (cannot click, type, fill forms, or upload files).
2. **Sandbox network egress to Etsy is blocked at the infrastructure level**,
   confirmed by a live test: `CONNECT www.etsy.com:443` → `403,
   policy denial`. This is the same egress block already documented for
   other external hosts during preparation (`bsky.social`, `dev.to`,
   `api.stripe.com` all returned blocked/000). Even the Chromium binary
   that happens to be preinstalled in the sandbox has nowhere to connect to.
3. **No Etsy login/session exists anywhere the AI can reach** — the owner
   completed KYC/bank/ToS in their own separate browser, correctly without
   sharing login access.

A fourth path was considered and rejected: running browser automation from
GitHub Actions instead (which does have open internet) using the owner's
actual Etsy password as a secret. Rejected because it would very likely (a)
trigger Etsy's new-device/bot-detection (2FA/CAPTCHA) on a first automated
login, which is human-only anyway and defeats the point, and (b) risks
violating Etsy's Terms of Service against automating the human-facing seller
UI outside the sanctioned API — a real risk to the only working revenue
channel, not a hypothetical one. Etsy API v3 + OAuth is the sanctioned,
ToS-compliant path and does not carry that risk.

This confirms the OAuth grant below as the correct next capability — not
because completing an API was treated as a goal in itself, but because it's
the fastest path to a real listing that was actually tried, tested, and
found necessary once the browser alternative was ruled out.

## Spec verification (2026-09-01, before the OAuth grant)

Checked against six specific points before asking for the grant. Honesty
note: this session cannot reach Etsy's live docs or API (no egress — see
above), so this is verification from the implementation + documented Etsy
API v3 behavior, not a live-tested confirmation. Point 6 in particular stays
explicitly unverified.

1. **`redirect_uri` HTTPS requirement** — FIXED. The setup doc previously said
   "any value works," which was imprecise: Etsy requires the redirect URI to
   be HTTPS, with a specific exception for `http://localhost` (or
   `http://127.0.0.1`) for local testing — which is why the example is
   `http://localhost:3003/callback`, not an arbitrary HTTP URL. Corrected the
   wording in `scripts/etsy_oauth_setup.mjs`'s prompt and below.
2. **Keystring + Shared Secret handling** — FIXED (was previously
   undocumented, not wrong, but a real gap). Etsy's app registration issues
   both a **Keystring** (Client ID) and a **Shared Secret** (Client Secret).
   This integration uses **PKCE** (`code_challenge`/`code_verifier`), a
   public-client OAuth flow that authenticates the token exchange with the
   verifier instead of a client secret — so the **Shared Secret is never
   used and must not be added as a repo secret**. `scripts/etsy_oauth_setup.mjs`
   now says this explicitly so it isn't pasted in by mistake.
3. **Minimum OAuth scope** — FIXED, was over-scoped. Previously requested
   `listings_w listings_r shops_r shops_w transactions_r`. `shops_w` (shop
   settings writes) and `transactions_r` (order/receipt reads) are not used
   anywhere in `scripts/etsy_publish.mjs` or the setup flow — trimmed to
   `listings_w listings_r shops_r` (create/update the listing + its images/
   file, read listing/taxonomy data, resolve the shop id during setup). Least
   privilege: the OAuth consent screen the owner approves now matches
   exactly what the code does, nothing more.
4. **Access Level as a Seller App** — clarified, with an honest limit. Etsy
   distinguishes apps built for the developer's own shop (no review, usable
   immediately) from commercial apps serving other sellers (needs Etsy's
   review). This integration is single-shop, own-use only, so it should
   qualify for immediate use. This session cannot browse Etsy's current
   registration form to confirm the exact field name/wording (egress
   blocked), so: **when registering, pick whichever option indicates
   personal / your-own-shop use, not a public or multi-shop commercial
   app** — if the form's exact wording differs from what's described here,
   that's an Etsy UI detail, not a change to the request itself.
5. **Refresh token, current spec** — confirmed / tightened. Etsy refresh
   tokens are valid **~90 days** and **rotate (single-use) on every refresh
   call** — using one invalidates it and issues a new one. Already handled:
   `etsy_publish.mjs` refreshes on every run and the setup script's final
   output now states the 90-day figure explicitly (see the known-limitation
   section below for what rotation means operationally).
6. **Digital listing publish flow — required fields** — documented, still
   the one open risk. `scripts/etsy_publish.mjs` sends `quantity`, `title`,
   `description`, `price`, `who_made`, `when_made`, `taxonomy_id`, and
   `type: "download"` to create the draft (no `shipping_profile_id`, which
   Etsy only requires for physical listings), then uploads images and the
   digital file as separate calls, then activates. This matches the
   documented v3 schema as trained, but has never been run against the live
   endpoint — see "Known limitation: untested against the live API" below,
   which is unchanged and still the honest status.

## Setup

The Etsy shop is now open (KYC/bank done — thank you). Everything else about
the first listing is already decided and prepared by the AI:
`marketing/etsy_listing_config.json` (content), `marketing/etsy-images/`
(4 images), `downloads/ai-automation-toolkit-8f3a2c.zip` (deliverable).

What's left is a **one-time technical grant**: Etsy requires OAuth 2.0 for any
API write (no simple restricted-key option like Stripe). This is the same
shape of ask as `STRIPE_RESTRICTED_KEY` / X credentials — a single setup step,
after which the AI publishes and manages listings itself via GitHub Actions,
with no further manual posting.

## Steps (~10–15 min, needs your own machine + Node.js)

1. **Register an app**: go to https://www.etsy.com/developers/register
   (log in as the shop owner). Any app name works (e.g. "AI Revenue
   Experiment Publisher"). Pick the option for **personal / your own shop's
   use** if the form asks (not a public/commercial multi-shop app) — that's
   what avoids Etsy's app-review process. Set a **Redirect URI**: it must be
   HTTPS, except Etsy allows plain `http://localhost:PORT/...` for local
   testing — use e.g. `http://localhost:3003/callback` (it does not need to
   be a real running server; see step 3).
2. Copy the app's **Keystring** (Client ID) once created — NOT the "Shared
   Secret" shown alongside it. This flow uses PKCE and never needs the
   Shared Secret; don't copy or store it anywhere.
3. On your own machine (not this AI session — it has no internet access to
   Etsy), run:
   ```
   node scripts/etsy_oauth_setup.mjs
   ```
   It asks for the Keystring and Redirect URI, prints an authorize URL to
   open in your browser, and after you approve access, asks you to paste
   the `code` value from the redirect (the redirect page itself can show a
   browser error — that's fine, the `code` is in the address bar).
4. The script prints four values. Add each as a GitHub repo secret:
   **repo → Settings → Secrets and variables → Actions → New repository
   secret**:
   - `ETSY_API_KEYSTRING`
   - `ETSY_ACCESS_TOKEN`
   - `ETSY_REFRESH_TOKEN`
   - `ETSY_SHOP_ID`
5. That's it — no manual listing/paste step. The next Claude session (or you,
   via the Actions tab → "Etsy publish" → Run workflow) triggers
   `.github/workflows/etsy-publish.yml`, which runs `scripts/etsy_publish.mjs`
   to create, image, attach the file to, and activate the listing
   automatically.

## Known limitation: refresh-token rotation

Etsy refresh tokens are valid **~90 days** and **rotate on every use**
(single-use). `etsy_publish.mjs` refreshes the access token each run, and the
workflow log will note the new refresh
token's fingerprint (last 6 chars) without ever printing the full value
(masked, since Actions logs on a public repo are publicly visible). After the
**first** publish run succeeds, `ETSY_REFRESH_TOKEN` must be updated to the
new value for any **future** run (e.g. price change, a second SKU) to keep
working — re-run `etsy_oauth_setup.mjs` if the exact new value wasn't
captured. This is a known rough edge, not a design flaw; a future iteration
could remove it by granting a scoped GitHub PAT so the workflow can rotate
its own secret, but that's not built yet (not worth the complexity before the
mechanism itself is proven).

## Known limitation: untested against the live API

This integration was written without live Etsy credentials or internet
egress from the authoring session, so it has not been run against the real
API yet. The first real run may reject a field name (`taxonomy_id`,
`when_made`, etc.) — the workflow log will show Etsy's exact error, and it's
a normal, expected one-round fix in `scripts/etsy_publish.mjs`, not a sign
the approach is wrong. The listing is created as a `draft` first and only
flipped to `active` after images and the file both upload successfully, so a
mid-way failure never leaves a broken listing publicly visible.

## Currency check

`marketing/etsy_listing_config.json` prices the listing at **9.00** on the
assumption of USD. Etsy bills in the shop's own bank currency — if the shop
is JPY-denominated, edit `price` in that file to the JPY equivalent (e.g.
~1350) **before** the first publish run.
