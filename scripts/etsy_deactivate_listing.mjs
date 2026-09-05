#!/usr/bin/env node
/**
 * ONE-OFF cleanup helper: deactivates a single Etsy listing by id via
 * PATCH /v3/application/shops/{shop_id}/listings/{listing_id}
 * ({ state: 'inactive' }). Used to remove an accidental duplicate listing
 * (a race between two etsy-publish.yml runs happened before
 * scripts/etsy_publish.mjs's idempotency bug was fixed -- see
 * status/EVENTS.jsonl for the incident).
 *
 * Needs env: ETSY_API_KEYSTRING, ETSY_API_SHARED_SECRET, ETSY_ACCESS_TOKEN,
 * ETSY_REFRESH_TOKEN, ETSY_SHOP_ID (same secrets as etsy_publish.mjs) plus
 * ETSY_DEACTIVATE_LISTING_ID (the listing to deactivate). If any are
 * absent, no-ops cleanly.
 *
 * This is NOT wired into any scheduled workflow -- it exists only to fix
 * this one incident and is safe to leave in the repo (no-ops without the
 * specific listing id env var).
 */
const { ETSY_API_KEYSTRING, ETSY_API_SHARED_SECRET, ETSY_ACCESS_TOKEN, ETSY_REFRESH_TOKEN, ETSY_SHOP_ID, ETSY_DEACTIVATE_LISTING_ID } = process.env;
if (!ETSY_API_KEYSTRING || !ETSY_API_SHARED_SECRET || !ETSY_ACCESS_TOKEN || !ETSY_REFRESH_TOKEN || !ETSY_SHOP_ID || !ETSY_DEACTIVATE_LISTING_ID) {
  console.log('etsy_deactivate_listing: required env not fully set -- skipping (no-op).');
  process.exit(0);
}

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
if (!refreshRes.ok) { console.error('etsy_deactivate_listing: token refresh failed:', refreshed); process.exit(1); }
console.log(`::add-mask::${ETSY_ACCESS_TOKEN}`);
console.log(`::add-mask::${ETSY_REFRESH_TOKEN}`);
console.log(`::add-mask::${refreshed.access_token}`);
console.log(`::add-mask::${refreshed.refresh_token}`);
console.log('etsy_deactivate_listing: refreshed access token OK.');
console.log('etsy_deactivate_listing: NOTE -- the refresh token rotated again; ETSY_REFRESH_TOKEN is now stale.');

const res = await fetch(`https://api.etsy.com/v3/application/shops/${ETSY_SHOP_ID}/listings/${ETSY_DEACTIVATE_LISTING_ID}`, {
  method: 'PATCH',
  headers: {
    Authorization: `Bearer ${refreshed.access_token}`,
    'x-api-key': `${ETSY_API_KEYSTRING}:${ETSY_API_SHARED_SECRET}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ state: 'inactive' }),
});
const json = await res.json();
if (!res.ok) {
  console.error(`etsy_deactivate_listing: FAILED -- PATCH .../listings/${ETSY_DEACTIVATE_LISTING_ID} -> ${res.status} ${JSON.stringify(json)}`);
  process.exit(1);
}
console.log(`etsy_deactivate_listing: listing ${ETSY_DEACTIVATE_LISTING_ID} is now INACTIVE.`);
