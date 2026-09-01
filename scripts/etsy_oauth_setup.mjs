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
 * (needs your own Etsy login) and note its "Keystring" (Client ID) and
 * a Redirect URI you register on the app (any URI works, even one that
 * doesn't resolve to a real server — see the prompt below).
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
  const redirectUri = (await rl.question('Redirect URI registered on the app (e.g. http://localhost:3003/callback): ')).trim();

  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const state = b64url(randomBytes(12));
  const scopes = ['listings_w', 'listings_r', 'shops_r', 'shops_w', 'transactions_r'].join('%20');

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
    headers: { Authorization: `Bearer ${tok.access_token}`, 'x-api-key': keystring },
  });
  const shops = await shopsRes.json();
  const shopId = shops.shop_id ?? (Array.isArray(shops.results) ? shops.results[0]?.shop_id : undefined);

  console.log('\nSuccess. Add these as GitHub repo secrets');
  console.log('(repo -> Settings -> Secrets and variables -> Actions -> New repository secret):\n');
  console.log('ETSY_API_KEYSTRING =', keystring);
  console.log('ETSY_ACCESS_TOKEN  =', tok.access_token);
  console.log('ETSY_REFRESH_TOKEN =', tok.refresh_token);
  console.log('ETSY_SHOP_ID       =', shopId ?? '(could not auto-detect — check the shops endpoint manually)');
  console.log('\nNote: the access token expires in ~1h, but scripts/etsy_publish.mjs refreshes it');
  console.log('automatically from ETSY_REFRESH_TOKEN on every run. Etsy ROTATES the refresh token on');
  console.log('each use, so after the publish workflow runs once, ETSY_REFRESH_TOKEN must be updated');
  console.log('to the new value for the next run to keep working — see ops/ETSY_API_SETUP.md.');
  rl.close();
}
main().catch(e => { console.error(e); process.exit(1); });
