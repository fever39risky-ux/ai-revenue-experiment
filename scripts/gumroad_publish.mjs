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
 * Spec source: this endpoint sequence was verified 2026-09-01 against
 * Gumroad's actual production Rails source (antiwork/gumroad on GitHub --
 * config/routes.rb + app/controllers/api/v2/{links,direct_uploads}_controller.rb),
 * NOT the antiwork/gumroad-cli tool's own docs and NOT a third-party CLI.
 * An earlier version of this pipeline depended on gumroad-cli's documented
 * `products create`/`publish` commands, which turned out to be an
 * unverified premise -- Gumroad's help center only documents the CLI for
 * Pages/Profile publishing, not product management, and a search result
 * separately (and, per the source-code read below, apparently incorrectly)
 * claimed POST /v2/products 404s. Reading the actual routes.rb and
 * controller source directly resolved the contradiction: the route and
 * controller action are real, unguarded by any feature flag, and require
 * only the `edit_products` OAuth scope.
 *
 * Flow (per that source read):
 *   1. POST /v2/direct_uploads (blob: filename, byte_size, checksum,
 *      content_type) -> presigned upload URL/headers + a blob reference
 *      to use in the products call. This is standard Rails ActiveStorage
 *      direct upload.
 *   2. PUT the raw file bytes to the presigned URL.
 *   3. POST /v2/products (draft created automatically: draft=true,
 *      purchase_disabled_at set) with name/price/description/tags/files.
 *   4. PUT /v2/products/:id/enable to publish (calls @product.publish!).
 *
 * Confidence note: the route/controller code is a strong primary source,
 * but two details were NOT confirmed against a live call and are the most
 * likely spots to need a one-round fix: (a) the exact response JSON key
 * names from POST /v2/direct_uploads (the upload URL/headers/blob
 * reference), and (b) the exact shape of an entry in the `files` array
 * passed to POST /v2/products (does it take the blob's signed_id directly,
 * or a constructed URL referencing it?). Both are handled defensively
 * below and fail with the raw response body if not found where expected.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { createHash } from 'crypto';

const { GUMROAD_ACCESS_TOKEN } = process.env;
if (!GUMROAD_ACCESS_TOKEN) {
  console.log('gumroad_publish: GUMROAD_ACCESS_TOKEN not set — skipping (no-op).');
  process.exit(0);
}

const STATE = 'status/gumroad_listing.json';
const EVENTS = 'status/EVENTS.jsonl';
const CONFIG = 'marketing/gumroad_listing_config.json';
const API = 'https://api.gumroad.com/v2';

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
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

function saveState(patch) {
  const next = { ...state, ...patch };
  writeFileSync(STATE, JSON.stringify(next, null, 2) + '\n');
  return next;
}

// Direct upload the digital deliverable via Gumroad's ActiveStorage flow.
// Returns a blob reference to include in the product's `files` array.
async function uploadFile(filePath, contentType) {
  const bytes = readFileSync(filePath);
  const filename = filePath.split('/').pop();
  const checksum = createHash('md5').update(bytes).digest('base64');

  const presign = await gumroadApi('POST', '/direct_uploads', {
    blob: { filename, byte_size: bytes.length, checksum, content_type: contentType },
  });

  const uploadUrl = presign.direct_upload?.url ?? presign.url;
  const uploadHeaders = presign.direct_upload?.headers ?? presign.headers ?? {};
  const blobRef = presign.signed_id ?? presign.direct_upload?.signed_id ?? presign.blob_signed_id;
  if (!uploadUrl || !blobRef) {
    throw new Error(`direct_uploads response missing expected fields: ${JSON.stringify(presign)}`);
  }

  const putRes = await fetch(uploadUrl, { method: 'PUT', headers: uploadHeaders, body: bytes });
  if (!putRes.ok) throw new Error(`Direct upload PUT failed: ${putRes.status} ${await putRes.text()}`);

  console.log(`gumroad_publish: uploaded ${filename} (${bytes.length} bytes) -> blob ${blobRef}`);
  return blobRef;
}

try {
  const fileBlobRef = await uploadFile(cfg.digital_file, 'application/zip');

  const created = await gumroadApi('POST', '/products', {
    name: cfg.name,
    price: Math.round(Number(cfg.price) * 100), // Gumroad prices are in cents
    price_currency_type: cfg.currency ?? 'usd',
    description: cfg.description,
    tags: cfg.tags || [],
    files: [{ signed_id: fileBlobRef, name: cfg.digital_file_name || cfg.digital_file.split('/').pop() }],
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
