#!/usr/bin/env node
/**
 * ONE-TIME, LOCAL-ONLY helper. Run this on your own machine (it needs
 * internet access to Etsy — the sandboxed Claude session's egress is
 * blocked, so this cannot be run there). It completes the Etsy API v3
 * OAuth 2.0 (PKCE) authorization for your shop and prints the values to
 * paste into GitHub repo Settings -> Secrets and variables -> Actions.
 * Nothing here is committed or sent anywhere but Etsy's own API.
 *
 * Prereq: register an app at https://www.etsy.com/developers/register
 * (needs your own Etsy login), for PERSONAL/OWN-SHOP use (not a commercial
 * multi-shop app — that needs Etsy's review, personal use doesn't). Note
 * both its "Keystring" (Client ID) and its "Shared Secret".
 *
 * CORRECTED after a live run: PKCE means the token exchange itself (the
 * authorization_code -> access_token call below) never needs the Shared
 * Secret — that part was right. But Etsy's `/v3/application/*` REST
 * endpoints (the shop lookup this script also does, and everything
 * scripts/etsy_publish.mjs calls) DO require it: the real error was
 * `403 {"error":"Shared secret is required in x-api-key header."}`. The
 * `x-api-key` header on those calls must be `{keystring}:{shared_secret}`,
 * not the keystring alone — so the Shared Secret IS needed after all, just
 * not for the OAuth step itself. It must be added as a repo secret
 * (ETSY_API_SHARED_SECRET) alongside the other four.
 *
 * Redirect URI: register one on the app. Etsy requires it to be HTTPS,
 * EXCEPT it allows plain http://localhost (or http://127.0.0.1) for local
 * testing — that's why the example below is localhost, not "any URI works."
 * It does not need to resolve to a real running server; you'll copy the
 * `code` out of the browser's address bar after the redirect fails to load.
 *
 * Usage: node scripts/etsy_oauth_setup.mjs
 */
import { randomBytes, createHash } from 'crypto';
import { createInterface } from 'readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function main() {
  console.log('Etsy API v3 OAuth (PKCE) one-time setup\n');
  const keystring = (await rl.question('Paste your Etsy app Keystring (Client ID): ')).trim();
  const sharedSecret = (await rl.question('Paste your Etsy app Shared Secret (needed for REST calls, not the OAuth exchange itself): ')).trim();
  const redirectUri = (await rl.question('Redirect URI registered on the app (must be HTTPS, or http://localhost:PORT/... for testing): ')).trim();

  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(12));
  // Minimum scope for what scripts/etsy_publish.mjs actually does: create/
  // update a listing + upload its images/file (listings_w), read listing/
  // taxonomy data (listings_r), and look up the shop id during this setup
  // (shops_r). No shop-settings writes and no order/transaction reads happen
  // anywhere in this pipeline, so shops_w and transactions_r are deliberately
  // NOT requested (least privilege).
  const scopes = ['listings_w', 'listings_r', 'shops_r'].join('%20');

  const authorizeUrl = `https://www.etsy.com/oauth/connect?response_type=code&client_id=${encodeURIComponent(keystring)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}&code_challenge=${challenge}&code_challenge_method=S256`;

  console.log('\n1. Open this URL in a browser where you are logged in as the shop owner:\n');
  console.log(authorizeUrl);
  console.log('\n2. Approve access. Etsy redirects to your redirect URI with ?code=...&state=...');
  console.log('   If the redirect URI is not a real running server, the browser will show a');
  console.log('   connection-error page — that is fine, just copy the "code" value out of the');
  console.log('   browser\'s address bar.\n');

  const code = (await rl.question('Paste the "code" value from the redirect URL: ')).trim();

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: keystring,
    redirect_uri: redirectUri,
    code,
    code_verifier: verifier,
  });
  const res = await fetch('https://api.etsy.com/v3/public/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const tok = await res.json();
  if (!res.ok) { console.error('\nToken exchange failed:', tok); rl.close(); process.exit(1); }

  const userId = tok.access_token.split('.')[0];
  const shopsRes = await fetch(`https://api.etsy.com/v3/application/users/${userId}/shops`, {
    headers: { Authorization: `Bearer ${tok.access_token}`, 'x-api-key': `${keystring}:${sharedSecret}` },
  });
  const shops = await shopsRes.json().catch(() => ({}));
  // GET .../users/{user_id}/shops has returned either a single Shop object
  // (shop_id at the top level) or a {count, results:[...]} list wrapper in
  // different observations -- handle both rather than assuming one. A
  // non-2xx response is also logged (no secrets in Etsy's error body) so a
  // real failure here is diagnosable instead of silently becoming "could
  // not auto-detect".
  if (!shopsRes.ok) console.error(`\n(shop lookup: GET .../users/${userId}/shops -> ${shopsRes.status} ${JSON.stringify(shops)})`);
  const shopId = shops.shop_id ?? (Array.isArray(shops.results) ? shops.results[0]?.shop_id : undefined);

  console.log('\nSuccess. Add these as GitHub repo secrets');
  console.log('(repo -> Settings -> Secrets and variables -> Actions -> New repository secret):\n');
  console.log('ETSY_API_KEYSTRING     =', keystring);
  console.log('ETSY_API_SHARED_SECRET =', sharedSecret);
  console.log('ETSY_ACCESS_TOKEN  =', tok.access_token);
  console.log('ETSY_REFRESH_TOKEN =', tok.refresh_token);
  console.log('ETSY_SHOP_ID       =', shopId ?? '(could not auto-detect — check the shops endpoint manually)');
  console.log('\nNote: the access token expires in ~1h, but scripts/etsy_publish.mjs refreshes it');
  console.log('automatically from ETSY_REFRESH_TOKEN on every run. The refresh token itself is valid');
  console.log('~90 days AND rotates (single-use) on every refresh call, so after the publish workflow');
  console.log('runs once, ETSY_REFRESH_TOKEN must be updated to the new value for the next run to keep');
  console.log('working — see ops/ETSY_API_SETUP.md.');
  rl.close();
}
main().catch(e => { console.error(e); process.exit(1); });
