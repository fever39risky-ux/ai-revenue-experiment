#!/usr/bin/env node
/**
 * Diagnostic (not a scheduled monitor): fetches the real Gumroad product
 * resource for the live listing and prints the FULL raw response, to see
 * exactly which engagement/traffic fields the API actually returns
 * (views, favorites, etc. if any) -- verified against the real response,
 * not assumed. Mirrors scripts/etsy_listing_diagnostics.mjs for an
 * apples-to-apples cross-channel comparison.
 *
 * Needs env GUMROAD_ACCESS_TOKEN. Optional: GUMROAD_PRODUCT_ID (defaults
 * to the known live product).
 */
const { GUMROAD_ACCESS_TOKEN } = process.env;
if (!GUMROAD_ACCESS_TOKEN) {
  console.log('gumroad_listing_diagnostics: GUMROAD_ACCESS_TOKEN not set -- skipping (no-op).');
  process.exit(0);
}
const PRODUCT_ID = process.env.GUMROAD_PRODUCT_ID || 'KVChszgZy59QBao2fz609A==';
const API = 'https://api.gumroad.com/v2';

async function get(path) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${GUMROAD_ACCESS_TOKEN}` } });
  const json = await res.json().catch(() => ({}));
  console.log(`\n=== GET ${path} -> ${res.status} ===`);
  console.log(JSON.stringify(json, null, 2));
  return json;
}

await get(`/products/${PRODUCT_ID}`);
await get(`/sales`);

console.log('\ngumroad_listing_diagnostics: done. Read the raw JSON above to determine which real fields are available (any views/favorites/traffic fields, sales_count, etc.) -- do not assume any field exists beyond what is actually printed.');
