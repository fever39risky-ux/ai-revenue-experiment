#!/usr/bin/env node
/**
 * One-off fix (not a scheduled job): the live Gumroad product was created
 * without a taxonomy_id (scripts/gumroad_publish.mjs never set one), so
 * Gumroad defaulted it to taxonomy_id 266 / category "Other" -- a real,
 * confirmed discoverability defect found via scripts/gumroad_listing_diagnostics.mjs.
 *
 * The replacement category was chosen from Gumroad's own real taxonomy tree
 * (fetched live via GET /v2/categories, confirmed against
 * api/v2/categories_controller.rb + api/v2/links_controller.rb in Gumroad's
 * production source -- update accepts taxonomy_id or category, not both),
 * not guessed: "self-improvement/productivity" (taxonomy_id 85) is the
 * closest real category to this product's actual pitch (a no-code
 * productivity/automation toolkit for solopreneurs and small teams) and
 * matches the "productivity" tag already on the listing. No PHP-specific
 * "ai-tools" leaf exists that fits (that one is scoped under PHP Scripts,
 * a wrong audience for this product).
 *
 * Needs env GUMROAD_ACCESS_TOKEN. Optional: GUMROAD_PRODUCT_ID,
 * GUMROAD_TAXONOMY_ID (defaults below).
 */
const { GUMROAD_ACCESS_TOKEN } = process.env;
if (!GUMROAD_ACCESS_TOKEN) {
  console.log('gumroad_fix_category: GUMROAD_ACCESS_TOKEN not set -- skipping (no-op).');
  process.exit(0);
}
const PRODUCT_ID = process.env.GUMROAD_PRODUCT_ID || 'KVChszgZy59QBao2fz609A==';
const TAXONOMY_ID = Number(process.env.GUMROAD_TAXONOMY_ID || '85');
const API = 'https://api.gumroad.com/v2';
const headers = { Authorization: `Bearer ${GUMROAD_ACCESS_TOKEN}` };

async function getProduct() {
  const res = await fetch(`${API}/products/${PRODUCT_ID}`, { headers });
  const json = await res.json();
  return json.product || {};
}

const before = await getProduct();
console.log(`gumroad_fix_category: before -- taxonomy_id=${before.taxonomy_id} category=${before.category} category_label=${before.category_label}`);

const res = await fetch(`${API}/products/${PRODUCT_ID}`, {
  method: 'PUT',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ taxonomy_id: TAXONOMY_ID }),
});
const json = await res.json().catch(() => ({}));
console.log(`PUT /products/${PRODUCT_ID} (taxonomy_id=${TAXONOMY_ID}) -> ${res.status}`);
console.log(JSON.stringify(json, null, 2));
if (!res.ok || json.success === false) {
  console.error('gumroad_fix_category: update failed -- see response above.');
  process.exit(1);
}

const after = await getProduct();
console.log(`gumroad_fix_category: after -- taxonomy_id=${after.taxonomy_id} category=${after.category} category_label=${after.category_label}`);
if (after.taxonomy_id === before.taxonomy_id) {
  console.error('gumroad_fix_category: taxonomy_id unchanged after update -- treat as unresolved, do not assume success.');
  process.exit(1);
}
console.log('gumroad_fix_category: done -- category confirmed changed via a real re-fetch, not assumed from the PUT response alone.');
