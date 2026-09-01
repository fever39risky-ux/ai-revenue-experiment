# Etsy API v3 setup — one-time OAuth grant

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
   Experiment Publisher"). No special review needed for your own shop's
   listings. Set a **Redirect URI** — any value works, even a non-running
   URL like `http://localhost:3003/callback` (see step 3).
2. Copy the app's **Keystring** (Client ID) once created.
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

Etsy **rotates the refresh token on every use**. `etsy_publish.mjs` refreshes
the access token each run, and the workflow log will note the new refresh
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
