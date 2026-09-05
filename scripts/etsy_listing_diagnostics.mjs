#!/usr/bin/env node
/**
 * Diagnostic (not a scheduled monitor): fetches the real Etsy listing
 * resource for the live listing and prints the FULL raw response, so we
 * can see exactly which engagement/visibility fields the public API v3
 * actually returns (views, num_favorers, state, quality flags, etc.) --
 * verified against the real response, not assumed from docs or training
 * knowledge. This sandbox has no egress to Etsy at all, so this can only
 * be answered by running this from GitHub Actions and reading the log.
 *
 * Needs env: ETSY_API_KEYSTRING, ETSY_API_SHARED_SECRET, ETSY_ACCESS_TOKEN,
 * ETSY_REFRESH_TOKEN, ETSY_SHOP_ID (same secrets as etsy_publish.mjs).
 * Optional: ETSY_LISTING_ID (defaults to the known live listing).
 */
const { ETSY_API_KEYSTRING, ETSY_API_SHARED_SECRET, ETSY_ACCESS_TOKEN, ETSY_REFRESH_TOKEN, ETSY_SHOP_ID } = process.env;
if (!ETSY_API_KEYSTRING || !ETSY_API_SHARED_SECRET || !ETSY_ACCESS_TOKEN || !ETSY_REFRESH_TOKEN || !ETSY_SHOP_ID) {
  console.log('etsy_listing_diagnostics: required env not fully set -- skipping (no-op).');
  process.exit(0);
}
const LISTING_ID = process.env.ETSY_LISTING_ID || '4569271638';

const refreshRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: (() => {
    const p = new URLSearchParams();
    p.set('grant_type', 'refresh_token');
    p.set('client_id', ETSY_API_KEYSTRING);
    p.set('refresh_token', ETSY_REFRESH_TOKEN);
    return p;
  })(),
});
const refreshed = await refreshRes.json();
if (!refreshRes.ok) { console.error('etsy_listing_diagnostics: token refresh failed:', JSON.stringify(refreshed)); process.exit(1); }
console.log(`::add-mask::${ETSY_ACCESS_TOKEN}`);
console.log(`::add-mask::${ETSY_REFRESH_TOKEN}`);
console.log(`::add-mask::${refreshed.access_token}`);
console.log(`::add-mask::${refreshed.refresh_token}`);
console.log('etsy_listing_diagnostics: refreshed access token OK.');

const headers = { Authorization: `Bearer ${refreshed.access_token}`, 'x-api-key': `${ETSY_API_KEYSTRING}:${ETSY_API_SHARED_SECRET}` };

// 1. The listing resource itself -- look for views/num_favorers/state/quality fields.
const listingRes = await fetch(`https://api.etsy.com/v3/application/listings/${LISTING_ID}`, { headers });
const listingJson = await listingRes.json();
console.log(`\n=== GET /v3/application/listings/${LISTING_ID} -> ${listingRes.status} ===`);
console.log(JSON.stringify(listingJson, null, 2));

// 2. Shop-level resource -- check for any aggregate stats fields.
const shopRes = await fetch(`https://api.etsy.com/v3/application/shops/${ETSY_SHOP_ID}`, { headers });
const shopJson = await shopRes.json();
console.log(`\n=== GET /v3/application/shops/${ETSY_SHOP_ID} -> ${shopRes.status} ===`);
console.log(JSON.stringify(shopJson, null, 2));

// 3. Ping the shop's own active listings list, in case it surfaces ranking-relevant fields.
const activeRes = await fetch(`https://api.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/active?listing_ids=${LISTING_ID}`, { headers });
const activeJson = await activeRes.json().catch(() => ({}));
console.log(`\n=== GET /v3/application/shops/${ETSY_SHOP_ID}/listings/active?listing_ids=${LISTING_ID} -> ${activeRes.status} ===`);
console.log(JSON.stringify(activeJson, null, 2));

console.log('\netsy_listing_diagnostics: done. Read the raw JSON above to determine which real fields are available (views, num_favorers, tags, taxonomy, state, etc.) -- do not assume any field exists beyond what is actually printed.');
