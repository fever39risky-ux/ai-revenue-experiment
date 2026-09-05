#!/usr/bin/env node
/**
 * Uploads a thumbnail image to the already-published Gumroad listing. This
 * is a follow-up step, not part of the original publish flow: the first
 * live publish (2026-09-02) deliberately shipped without a thumbnail
 * because the image-upload endpoint's exact shape hadn't been verified
 * against Gumroad's production source yet (marketing/gumroad_listing_config.json's
 * cover_image_note flagged this explicitly as deferred, not forgotten).
 *
 * Spec source: verified against Gumroad's actual production Rails source
 * (antiwork/gumroad), same discipline as scripts/gumroad_publish.mjs --
 * config/routes.rb -> POST /v2/products/:id/thumbnail (thumbnails#create),
 * and app/controllers/api/v2/{thumbnails,direct_uploads}_controller.rb.
 * Unlike the digital-file delivery (which needed the separate S3-multipart
 * /v2/files/presign flow because /v2/direct_uploads rejects non-media
 * content types -- see gumroad_publish.mjs's correction note), an image
 * IS exactly the content type /v2/direct_uploads accepts. The flow is
 * standard Rails ActiveStorage direct upload:
 *   1. POST /v2/direct_uploads { blob: { filename, byte_size, checksum,
 *      content_type } } -> { signed_id, direct_upload: { url, headers } }.
 *      checksum is the base64-encoded MD5 digest of the raw file bytes.
 *   2. PUT the file bytes to direct_upload.url with direct_upload.headers.
 *   3. POST /v2/products/:id/thumbnail { signed_blob_id: <signed_id> }.
 * Requires the same edit_products OAuth scope already granted via
 * GUMROAD_ACCESS_TOKEN -- no new grant needed.
 *
 * Idempotent: no-ops if status/gumroad_listing.json already records
 * thumbnail_uploaded, or if no product has been published yet (nothing to
 * attach a thumbnail to).
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const { GUMROAD_ACCESS_TOKEN } = process.env;
if (!GUMROAD_ACCESS_TOKEN) {
  console.log('gumroad_add_thumbnail: GUMROAD_ACCESS_TOKEN not set — skipping (no-op).');
  process.exit(0);
}

const STATE = 'status/gumroad_listing.json';
const EVENTS = 'status/EVENTS.jsonl';
const CONFIG = 'marketing/gumroad_listing_config.json';
const API = 'https://api.gumroad.com/v2';

let state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
if (!state.product_id) {
  console.log('gumroad_add_thumbnail: no product_id in status/gumroad_listing.json yet — nothing to attach a thumbnail to (skipping).');
  process.exit(0);
}
if (state.thumbnail_uploaded) {
  console.log(`gumroad_add_thumbnail: thumbnail already recorded for product ${state.product_id} — skipping (idempotent no-op).`);
  process.exit(0);
}

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const imagePath = cfg.cover_image;
if (!imagePath || !existsSync(imagePath)) {
  console.error(`gumroad_add_thumbnail: image path ${imagePath} not found — cannot proceed.`);
  process.exit(1);
}

function saveState(patch) {
  state = { ...state, ...patch };
  writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
  return state;
}

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

try {
  const bytes = readFileSync(imagePath);
  const filename = imagePath.split('/').pop();
  const checksum = createHash('md5').update(bytes).digest('base64');

  const blob = await gumroadApi('POST', '/direct_uploads', {
    blob: { filename, byte_size: bytes.length, checksum, content_type: 'image/png' },
  });
  const signedId = blob.signed_id;
  const directUpload = blob.direct_upload;
  if (!signedId || !directUpload?.url) {
    throw new Error(`direct_uploads response missing expected fields: ${JSON.stringify(blob)}`);
  }

  const putRes = await fetch(directUpload.url, {
    method: 'PUT',
    headers: directUpload.headers || {},
    body: bytes,
  });
  if (!putRes.ok) throw new Error(`direct upload PUT failed: ${putRes.status} ${await putRes.text()}`);

  const attached = await gumroadApi('POST', `/products/${state.product_id}/thumbnail`, {
    signed_blob_id: signedId,
  });
  if (attached.success === false) throw new Error(`thumbnail attach rejected: ${JSON.stringify(attached)}`);

  console.log(`gumroad_add_thumbnail: thumbnail attached to product ${state.product_id} (${filename}, ${bytes.length} bytes).`);
  saveState({ thumbnail_uploaded: true, thumbnail_uploaded_at: new Date().toISOString() });

  appendFileSync(EVENTS, JSON.stringify({
    type: 'gumroad_thumbnail_uploaded', timestamp: new Date().toISOString(), phase: 'official', actor: 'gumroad-publish-action',
    details: { product_id: state.product_id, image: imagePath },
  }) + '\n');
} catch (e) {
  console.error('gumroad_add_thumbnail: FAILED —', e.message);
  console.error('Non-fatal to the listing itself (it stays published without a thumbnail); check the job log above for the real API response.');
  process.exit(1);
}
