#!/usr/bin/env node
/**
 * Publishes the prepared Etsy listing via Etsy API v3, from GitHub Actions
 * (open egress) — NOT runnable from the sandboxed Claude session.
 *
 * Needs env: ETSY_API_KEYSTRING, ETSY_ACCESS_TOKEN, ETSY_REFRESH_TOKEN,
 * ETSY_SHOP_ID (all one-time secrets from scripts/etsy_oauth_setup.mjs).
 * If any are absent, this no-ops cleanly so the workflow never fails before
 * the grant exists.
 *
 * Idempotent: if status/etsy_listing.json already records a listing_id, this
 * does nothing (never creates a duplicate listing). To relist, edit that
 * file by hand first.
 *
 * Listing content lives in marketing/etsy_listing_config.json, not here —
 * edit that file to change title/price/tags/images, not this script.
 *
 * UNTESTED against the live Etsy API as of writing (no credentials, no
 * internet egress available from the authoring session). Expect to iterate
 * on exact field names against the real error response on first run — the
 * job log will show it, and the listing is left in DRAFT (not public) if
 * anything after creation fails.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

const { ETSY_API_KEYSTRING, ETSY_ACCESS_TOKEN, ETSY_REFRESH_TOKEN, ETSY_SHOP_ID, ETSY_TAXONOMY_ID } = process.env;
if (!ETSY_API_KEYSTRING || !ETSY_ACCESS_TOKEN || !ETSY_REFRESH_TOKEN || !ETSY_SHOP_ID) {
  console.log('etsy_publish: Etsy credentials not fully set — skipping (no-op).');
  process.exit(0);
}

const STATE = 'status/etsy_listing.json';
const EVENTS = 'status/EVENTS.jsonl';
const CONFIG = 'marketing/etsy_listing_config.json';

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
if (state.listing_id) {
  console.log(`etsy_publish: listing ${state.listing_id} already recorded — skipping (idempotent no-op).`);
  process.exit(0);
}

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
function mask(v) { if (v) console.log(`::add-mask::${v}`); return v; }
mask(ETSY_ACCESS_TOKEN); mask(ETSY_REFRESH_TOKEN);

// 1. Refresh the access token — Etsy rotates the refresh token on each use,
// so a fresh one is needed every run regardless of the stored token's age.
const refreshRes = await fetch('https://api.etsy.com/v3/public/oauth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'refresh_token', client_id: ETSY_API_KEYSTRING, refresh_token: ETSY_REFRESH_TOKEN }),
});
const refreshed = await refreshRes.json();
if (!refreshRes.ok) { console.error('etsy_publish: token refresh failed:', refreshed); process.exit(1); }
const accessToken = refreshed.access_token;
mask(accessToken); mask(refreshed.refresh_token);
console.log('etsy_publish: refreshed access token OK.');
console.log('etsy_publish: NOTE — the refresh token rotated. Update the ETSY_REFRESH_TOKEN repo secret');
console.log('to keep the NEXT run working (fingerprint of the new one: ...' + String(refreshed.refresh_token).slice(-6) + ').');

function etsyHeaders() { return { Authorization: `Bearer ${accessToken}`, 'x-api-key': ETSY_API_KEYSTRING }; }
async function etsyGet(path) {
  const res = await fetch(`https://api.etsy.com/v3/application/${path}`, { headers: etsyHeaders() });
  const json = await res.json();
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}
async function etsyJson(method, path, body) {
  const res = await fetch(`https://api.etsy.com/v3/application/${path}`, {
    method, headers: { ...etsyHeaders(), 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}
async function etsyForm(path, form) {
  const res = await fetch(`https://api.etsy.com/v3/application/${path}`, { method: 'POST', headers: etsyHeaders(), body: form });
  const json = await res.json();
  if (!res.ok) throw new Error(`POST ${path} (form) -> ${res.status} ${JSON.stringify(json)}`);
  return json;
}

// 2. Resolve a taxonomy_id (Etsy category) for a digital template-style
// listing by searching the live taxonomy tree, unless pinned via env.
async function resolveTaxonomyId() {
  if (ETSY_TAXONOMY_ID) return Number(ETSY_TAXONOMY_ID);
  const nodes = await etsyGet('seller-taxonomy/nodes');
  const flat = [];
  (function walk(list) { for (const n of (list || [])) { flat.push(n); walk(n.children); } })(nodes.results);
  const match = flat.find(n => /template/i.test(n.name)) || flat.find(n => /digital/i.test(n.name));
  if (!match) throw new Error('Could not auto-resolve a taxonomy_id — set ETSY_TAXONOMY_ID explicitly.');
  console.log(`etsy_publish: resolved taxonomy_id ${match.id} ("${match.name}")`);
  return match.id;
}

function saveState(patch) {
  const next = { ...state, ...patch };
  writeFileSync(STATE, JSON.stringify(next, null, 2) + '\n');
  return next;
}

try {
  const taxonomyId = await resolveTaxonomyId();

  // 3. Create as DRAFT first. Only flip to active after images + the
  // digital file both upload successfully, so a partial failure never
  // leaves a broken listing publicly live.
  const created = await etsyJson('POST', `shops/${ETSY_SHOP_ID}/listings`, {
    quantity: cfg.quantity ?? 999,
    title: cfg.title,
    description: cfg.description,
    price: cfg.price,
    who_made: cfg.who_made ?? 'i_did',
    when_made: cfg.when_made ?? '2020_2026',
    taxonomy_id: taxonomyId,
    type: 'download',
    tags: (cfg.tags || []).slice(0, 13),
    materials: cfg.materials || [],
    state: 'draft',
  });
  const listingId = created.listing_id;
  console.log(`etsy_publish: created draft listing ${listingId}`);
  saveState({ listing_id: listingId, created_at: new Date().toISOString(), state: 'draft' });

  // 4. Upload images in order.
  for (const [i, imgPath] of (cfg.images || []).entries()) {
    const bytes = readFileSync(imgPath);
    const form = new FormData();
    form.append('image', new Blob([bytes]), imgPath.split('/').pop());
    form.append('rank', String(i + 1));
    await etsyForm(`shops/${ETSY_SHOP_ID}/listings/${listingId}/images`, form);
    console.log(`etsy_publish: uploaded image ${i + 1}/${cfg.images.length}`);
  }

  // 5. Upload the digital deliverable.
  const fileBytes = readFileSync(cfg.digital_file);
  const fileForm = new FormData();
  const fileName = cfg.digital_file_name || cfg.digital_file.split('/').pop();
  fileForm.append('file', new Blob([fileBytes]), fileName);
  fileForm.append('name', fileName);
  await etsyForm(`shops/${ETSY_SHOP_ID}/listings/${listingId}/files`, fileForm);
  console.log('etsy_publish: uploaded digital file');

  // 6. Flip the listing live.
  await etsyJson('PATCH', `shops/${ETSY_SHOP_ID}/listings/${listingId}`, { state: 'active' });
  const url = `https://www.etsy.com/listing/${listingId}`;
  console.log(`etsy_publish: listing ${listingId} is now ACTIVE — ${url}`);
  saveState({ activated_at: new Date().toISOString(), state: 'active', url, price: cfg.price, title: cfg.title });

  appendFileSync(EVENTS, JSON.stringify({
    type: 'etsy_listing_published', timestamp: new Date().toISOString(), phase: 'official', actor: 'etsy-publish-action',
    details: { listing_id: listingId, price: cfg.price, title: cfg.title, url },
  }) + '\n');
} catch (e) {
  console.error('etsy_publish: FAILED —', e.message);
  console.error('Expected to need at least one iteration against the live API on first run — check');
  console.error(`the exact rejected field above, fix scripts/etsy_publish.mjs, and re-run. ${STATE}`);
  console.error('reflects whatever got created (a DRAFT is safe — it is not public).');
  process.exit(1);
}
