#!/usr/bin/env node
/**
 * ONE-TIME, LOCAL-ONLY recovery helper for when etsy_oauth_setup.mjs's
 * automatic ETSY_SHOP_ID lookup fails to auto-detect it, but the OAuth
 * authorize/approve step itself already succeeded (Keystring/Access
 * Token/Refresh Token were obtained fine) -- this does NOT redo OAuth, it
 * only retries the shop lookup call using the access token you already have.
 *
 * The original lookup (GET /v3/application/users/{user_id}/shops) never
 * checked res.ok, so a non-2xx response was silently swallowed into
 * "could not auto-detect" with no visibility into why. This prints Etsy's
 * exact status + response body on failure (no secrets in an error body) and
 * extracts shop_id from either response shape seen in practice: a single
 * Shop object (shop_id at the top level) or a {count, results:[...]} list.
 *
 * CORRECTED after a live run: the OAuth token exchange itself (PKCE) never
 * needs the Shared Secret, but Etsy's `/v3/application/*` REST endpoints
 * (this shop lookup included) do -- the real error was
 * `403 {"error":"Shared secret is required in x-api-key header."}`. The
 * `x-api-key` header must be `{keystring}:{shared_secret}`, not the
 * keystring alone.
 *
 * Usage: node scripts/etsy_get_shop_id.mjs
 */
import { createInterface } from 'readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stdout });

async function main() {
  const keystring = (await rl.question('Paste ETSY_API_KEYSTRING: ')).trim();
  const sharedSecret = (await rl.question('Paste ETSY_API_SHARED_SECRET: ')).trim();
  const accessToken = (await rl.question('Paste ETSY_ACCESS_TOKEN: ')).trim();
  rl.close();

  const userId = accessToken.split('.')[0];
  if (!/^\d+$/.test(userId)) {
    console.error(`\nCould not extract a numeric user_id from the access token (got "${userId}"). Expected the format "{user_id}.{rest}".`);
    process.exit(1);
  }

  const res = await fetch(`https://api.etsy.com/v3/application/users/${userId}/shops`, {
    headers: { Authorization: `Bearer ${accessToken}`, 'x-api-key': `${keystring}:${sharedSecret}` },
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error(`\nGET /v3/application/users/${userId}/shops -> ${res.status}`);
    console.error(JSON.stringify(body, null, 2));
    console.error('\nThis is Etsy\'s real error response (no secrets in it) -- share this back so the next fix can target the exact cause.');
    process.exit(1);
  }

  const shopId = body.shop_id ?? (Array.isArray(body.results) ? body.results[0]?.shop_id : undefined);
  if (!shopId) {
    console.error('\nCall succeeded but no shop_id found in this response shape:');
    console.error(JSON.stringify(body, null, 2));
    console.error('\nShare this back (no secrets in it) so the extraction logic can target the real shape.');
    process.exit(1);
  }

  console.log('\nETSY_SHOP_ID =', shopId);
  console.log('\nAdd this as a GitHub repo secret (Settings -> Secrets and variables -> Actions -> New repository secret).');
  console.log('Also add ETSY_API_SHARED_SECRET (the value you just entered above) as its own repo secret if you have not already -- see ops/ETSY_API_SETUP.md.');
}
main().catch(e => { console.error(e); process.exit(1); });
