#!/usr/bin/env node
/**
 * Publishes the prepared Gumroad listing via Gumroad's official REST API
 * v2 directly -- NOT via any CLI (first-party or third-party). From GitHub
 * Actions (open egress); NOT runnable from the sandboxed Claude session.
 *
 * Needs env GUMROAD_ACCESS_TOKEN -- a personal access token generated from
 * the seller's own account (Settings -> Advanced -> "Generate access
 * token"), NOT a CLI-issued token. See ops/GUMROAD_API_SETUP.md.
 * If absent, this no-ops cleanly so the workflow never fails before the
 * grant.
 *
 * Idempotent: if status/gumroad_listing.json already records a product id,
 * this does nothing (never creates a duplicate listing).
 *
 * Listing content lives in marketing/gumroad_listing_config.json, not here.
 *
 * Spec source: this endpoint sequence was verified against Gumroad's
 * actual production Rails source (antiwork/gumroad on GitHub), NOT the
 * antiwork/gumroad-cli tool's own docs and NOT a third-party CLI.
 *
 * CORRECTED 2026-09-02 after a live run: the first version of this script
 * used POST /v2/direct_uploads (Rails ActiveStorage) for the digital file
 * and got a real, concrete error back: `400 content_type must be JPEG,
 * PNG, GIF, or video` -- that endpoint is for media (covers/images), not
 * arbitrary downloadable files. The correct mechanism, per routes.rb, is a
 * SEPARATE S3-multipart flow under a different controller:
 *   1. POST /v2/files/presign { filename, file_size } -> { upload_id, key,
 *      file_url, parts: [{ part_number, presigned_url }] }.
 *   2. PUT the file bytes to each part's presigned_url (our file is small,
 *      so this is expected to be exactly one part -- code below fails
 *      loudly rather than guessing a byte-splitting scheme if the server
 *      ever returns more than one).
 *   3. POST /v2/files/complete { upload_id, key, parts: [{ part_number,
 *      etag }] } -> { file_url }.
 *   4. Reference the file in POST /v2/products' `files` array. The exact
 *      entry shape was reconstructed from antiwork/gumroad-cli's own
 *      source (internal/cmd/products/create.go): `{ id, url }`, where
 *      `url` is the `file_url` from step 3. `id`'s exact origin was NOT
 *      confirmed (a sibling code path used `external_id` instead of `id`,
 *      and its value's origin was unclear) -- using the presign response's
 *      `key` as a reasonable, but explicitly flagged, best guess.
 *   5. PUT /v2/products/:id/enable to publish (calls @product.publish!) --
 *      unaffected by this correction, not re-verified again here.
 *
 * Confidence note: steps 1-3 (the S3 multipart flow itself) come from a
 * primary source (the actual files_controller.rb) with reasonable
 * confidence. Step 4's exact `files` entry shape is the most likely
 * remaining spot to need another one-round fix -- code below fails with
 * the raw response body if the create call rejects it, rather than
 * retrying blindly.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';

const { GUMROAD_ACCESS_TOKEN } = process.env;
if (!GUMROAD_ACCESS_TOKEN) {
  console.log('gumroad_publish: GUMROAD_ACCESS_TOKEN not set — skipping (no-op).');
  process.exit(0);
}

const STATE = 'status/gumroad_listing.json';
const EVENTS = 'status/EVENTS.jsonl';
const CONFIG = 'marketing/gumroad_listing_config.json';
const API = 'https://api.gumroad.com/v2';

let state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
if (state.product_id) {
  console.log(`gumroad_publish: product ${state.product_id} already recorded — skipping (idempotent no-op).`);
  process.exit(0);
}

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));

async function gumroadApi(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${GUMROAD_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json)}`);
  }
  return json;
}

// Mutates the outer `state` so the 2nd call (publish) doesn't clobber
// fields the 1st call (create) already persisted, e.g. product_id -- losing
// that would break the idempotency check at the top of this file.
function saveState(patch) {
  state = { ...state, ...patch };
  writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
  return state;
}

// Upload the digital deliverable via Gumroad's S3-multipart /v2/files flow
// (NOT /v2/direct_uploads, which is media-only -- see the correction note
// above). Returns { id, url } to place directly into the product's `files`
// array entry.
async function uploadFile(filePath) {
  const bytes = readFileSync(filePath);
  const filename = filePath.split('/').pop();

  const presign = await gumroadApi('POST', '/files/presign', {
    filename, file_size: bytes.length,
  });
  const { upload_id: uploadId, key, parts } = presign;
  if (!uploadId || !key || !Array.isArray(parts) || parts.length === 0) {
    throw new Error(`files/presign response missing expected fields: ${JSON.stringify(presign)}`);
  }
  if (parts.length !== 1) {
    // Our deliverable is small; a multi-part response would mean the
    // server chunked it, and we'd need to know the exact byte-range
    // convention per part to split correctly. Rather than guess (risking
    // silent corruption), fail loudly so this can be handled deliberately.
    throw new Error(`files/presign returned ${parts.length} parts, expected 1 for a ${bytes.length}-byte file -- byte-range splitting not implemented, refusing to guess.`);
  }

  const part = parts[0];
  const putRes = await fetch(part.presigned_url, { method: 'PUT', body: bytes });
  if (!putRes.ok) throw new Error(`S3 part PUT failed: ${putRes.status} ${await putRes.text()}`);
  const etag = putRes.headers.get('etag');
  if (!etag) throw new Error('S3 part PUT succeeded but returned no ETag header -- cannot complete the multipart upload.');

  const completed = await gumroadApi('POST', '/files/complete', {
    upload_id: uploadId, key, parts: [{ part_number: part.part_number, etag }],
  });
  const fileUrl = completed.file_url;
  if (!fileUrl) throw new Error(`files/complete response missing file_url: ${JSON.stringify(completed)}`);

  console.log(`gumroad_publish: uploaded ${filename} (${bytes.length} bytes) -> ${fileUrl}`);
  return { id: key, url: fileUrl };
}

try {
  const uploadedFile = await uploadFile(cfg.digital_file);

  const created = await gumroadApi('POST', '/products', {
    name: cfg.name,
    price: Math.round(Number(cfg.price) * 100), // Gumroad prices are in cents
    price_currency_type: cfg.currency ?? 'usd',
    description: cfg.description,
    tags: cfg.tags || [],
    files: [{ ...uploadedFile, display_name: cfg.digital_file_name || cfg.digital_file.split('/').pop() }],
  });
  const product = created.product ?? created;
  const productId = product.id ?? product.custom_permalink;
  if (!productId) throw new Error(`Could not find a product id in the create response: ${JSON.stringify(created)}`);
  console.log(`gumroad_publish: created draft product ${productId}`);
  saveState({ product_id: productId, created_at: new Date().toISOString(), state: 'draft', url: product.short_url ?? product.url });

  const enabled = await gumroadApi('PUT', `/products/${productId}/enable`);
  const enabledProduct = enabled.product ?? enabled;
  const url = enabledProduct.short_url ?? enabledProduct.url ?? `https://gumroad.com/l/${productId}`;
  console.log(`gumroad_publish: product ${productId} is now PUBLISHED — ${url}`);
  saveState({ published_at: new Date().toISOString(), state: 'published', url });

  appendFileSync(EVENTS, JSON.stringify({
    type: 'gumroad_listing_published', timestamp: new Date().toISOString(), phase: 'official', actor: 'gumroad-publish-action',
    details: { product_id: productId, price: cfg.price, name: cfg.name, url },
  }) + '\n');
} catch (e) {
  console.error('gumroad_publish: FAILED —', e.message);
  console.error('Expected to possibly need a one-round fix against the API\'s real response shape on first run —');
  console.error(`check the job log above. ${STATE} reflects whatever got created (a draft is safe, not public).`);
  process.exit(1);
}
