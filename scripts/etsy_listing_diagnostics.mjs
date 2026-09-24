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

// 4. Compact summary for every listing we have published (ids from status/etsy_listing*.json).
const { readdirSync, readFileSync } = await import('node:fs');
const ids = readdirSync('status').filter((f) => /^etsy_listing.*\.json$/.test(f))
  .map((f) => { try { return JSON.parse(readFileSync(`status/${f}`, 'utf8')).listing_id; } catch { return null; } })
  .filter(Boolean);
console.log(`\n=== SUMMARY shop transaction_sold_count=${shopJson.transaction_sold_count} ===`);
// Space calls and retry 429s: Etsy's per-second rate limit otherwise drops some listings.
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
for (const id of ids) {
  let r;
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(1000 * (attempt + 1));
    r = await fetch(`https://api.etsy.com/v3/application/listings/${id}`, { headers });
    if (r.status !== 429) break;
  }
  const j = await r.json().catch(() => ({}));
  console.log(`SUMMARY listing ${id} -> ${r.status} state=${j.state} views=${j.views} favorers=${j.num_favorers} price=${j.price ? j.price.amount / j.price.divisor : '?'} taxonomy=${j.taxonomy_id}`);
}

// 5. Search visibility: does Etsy's public search return our listings for their own title keywords?
// Only public listing ids/ranks are printed. rank=null for every query suggests the listings are not
// in the search index at all (a shop/account-level issue), not merely low-ranked.
const ownIds = new Set(ids.map(String));
const queries = [];
for (const f of readdirSync('marketing').filter((f) => /^etsy_listing_config.*\.json$/.test(f))) {
  try {
    const c = JSON.parse(readFileSync(`marketing/${f}`, 'utf8'));
    const head = String(c.title || '').split(',')[0].split(' — ')[0].trim();
    if (head) queries.push(head);
    if (Array.isArray(c.tags) && c.tags[0]) queries.push(c.tags[0]);
  } catch { /* skip unreadable config */ }
}
console.log(`\n=== SEARCH VISIBILITY (${queries.length} queries, top 100 by score) ===`);
for (const q of queries) {
  let r;
  for (let attempt = 0; attempt < 4; attempt++) {
    await sleep(1000 * (attempt + 1));
    r = await fetch(`https://api.etsy.com/v3/application/listings/active?keywords=${encodeURIComponent(q)}&limit=100&sort_on=score`, { headers });
    if (r.status !== 429) break;
  }
  const j = await r.json().catch(() => ({}));
  const results = Array.isArray(j.results) ? j.results : [];
  const hits = results.map((x, i) => (ownIds.has(String(x.listing_id)) ? `${x.listing_id}@${i + 1}` : null)).filter(Boolean);
  console.log(`SEARCH ${r.status} q="${q}" total=${j.count ?? '?'} own_hits=${hits.length ? hits.join(',') : 'none'}`);
}
// Exact-title lookups: a listing absent even for its own full title is effectively unsearchable.
for (const id of ids) {
  await sleep(1000);
  const lr = await fetch(`https://api.etsy.com/v3/application/listings/${id}`, { headers });
  const lj = await lr.json().catch(() => ({}));
  if (!lj.title) continue;
  await sleep(1000);
  const sr = await fetch(`https://api.etsy.com/v3/application/listings/active?keywords=${encodeURIComponent(lj.title)}&limit=100`, { headers });
  const sj = await sr.json().catch(() => ({}));
  const pos = (Array.isArray(sj.results) ? sj.results : []).findIndex((x) => String(x.listing_id) === String(id));
  console.log(`EXACT_TITLE ${sr.status} listing ${id} total=${sj.count ?? '?'} rank=${pos >= 0 ? pos + 1 : 'null'}`);
}

console.log('\netsy_listing_diagnostics: done. Read the raw JSON above to determine which real fields are available (views, num_favorers, tags, taxonomy, state, etc.) -- do not assume any field exists beyond what is actually printed.');
