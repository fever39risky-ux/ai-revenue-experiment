#!/usr/bin/env node
/**
 * Publishes the prepared Gumroad listing via the official `gumroad` CLI
 * (github.com/antiwork/gumroad-cli), from GitHub Actions (open egress) —
 * NOT runnable from the sandboxed Claude session. The CLI must already be
 * installed on PATH (the workflow installs it before this runs).
 *
 * Needs env GUMROAD_ACCESS_TOKEN (a one-time personal access token from
 * `gumroad auth login` + `gumroad auth token` — see ops/GUMROAD_CLI_SETUP.md).
 * If absent, this no-ops cleanly so the workflow never fails before the grant.
 *
 * Idempotent: if status/gumroad_listing.json already records a product id,
 * this does nothing (never creates a duplicate listing).
 *
 * Listing content lives in marketing/gumroad_listing_config.json, not here.
 *
 * Confidence note: unlike the Etsy pipeline (built from training-memory
 * knowledge of the API), this was written from LIVE documentation fetched
 * 2026-09-01 (the CLI's own README + skill reference), so the command
 * surface itself is high-confidence. What's still unverified is the exact
 * JSON shape of a successful `products create` response -- this parses it
 * defensively and fails loudly with the raw output if the expected fields
 * aren't where expected, rather than guessing.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';

const { GUMROAD_ACCESS_TOKEN } = process.env;
if (!GUMROAD_ACCESS_TOKEN) {
  console.log('gumroad_publish: GUMROAD_ACCESS_TOKEN not set — skipping (no-op).');
  process.exit(0);
}

const STATE = 'status/gumroad_listing.json';
const EVENTS = 'status/EVENTS.jsonl';
const CONFIG = 'marketing/gumroad_listing_config.json';

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
if (state.product_id) {
  console.log(`gumroad_publish: product ${state.product_id} already recorded — skipping (idempotent no-op).`);
  process.exit(0);
}

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));

function gumroad(args) {
  const out = execFileSync('gumroad', args, { encoding: 'utf8' });
  try { return JSON.parse(out); } catch {
    throw new Error(`gumroad CLI returned non-JSON output for [${args.join(' ')}]:\n${out}`);
  }
}

function saveState(patch) {
  const next = { ...state, ...patch };
  writeFileSync(STATE, JSON.stringify(next, null, 2) + '\n');
  return next;
}

// Best-effort extraction across plausible response shapes -- the exact
// schema of `products create`'s JSON output wasn't confirmed live.
function extractProduct(result) {
  const p = result.product ?? result.data ?? result;
  const id = p.id ?? p.product_id ?? p.unique_permalink;
  const url = p.url ?? p.short_url ?? p.permalink ?? (p.custom_permalink ? `https://gumroad.com/l/${p.custom_permalink}` : undefined);
  if (!id) throw new Error(`Could not find a product id in the CLI response: ${JSON.stringify(result)}`);
  return { id, url };
}

try {
  const createArgs = [
    'products', 'create',
    '--name', cfg.name,
    '--price', String(cfg.price),
    '--currency', cfg.currency ?? 'usd',
    '--description', cfg.description,
    '--type', cfg.type ?? 'digital',
    '--file', cfg.digital_file,
    '--file-name', cfg.digital_file_name || cfg.digital_file.split('/').pop(),
    '--cover-image', cfg.cover_image,
    '--json', '--no-input',
  ];
  for (const tag of (cfg.tags || [])) createArgs.push('--tag', tag);

  const created = gumroad(createArgs);
  if (created.success === false) throw new Error(`Gumroad rejected product creation: ${JSON.stringify(created)}`);
  const { id: productId, url: createUrl } = extractProduct(created);
  console.log(`gumroad_publish: created draft product ${productId}`);
  saveState({ product_id: productId, created_at: new Date().toISOString(), state: 'draft', url: createUrl });

  const published = gumroad(['products', 'publish', productId, '--json', '--no-input']);
  if (published.success === false) throw new Error(`Gumroad rejected publish: ${JSON.stringify(published)}`);
  const { url: publishUrl } = extractProduct(published);
  const url = publishUrl || createUrl || `https://gumroad.com/l/${productId}`;
  console.log(`gumroad_publish: product ${productId} is now PUBLISHED — ${url}`);
  saveState({ published_at: new Date().toISOString(), state: 'published', url });

  appendFileSync(EVENTS, JSON.stringify({
    type: 'gumroad_listing_published', timestamp: new Date().toISOString(), phase: 'official', actor: 'gumroad-publish-action',
    details: { product_id: productId, price: cfg.price, name: cfg.name, url },
  }) + '\n');
} catch (e) {
  console.error('gumroad_publish: FAILED —', e.message);
  console.error('Expected to possibly need a one-round fix against the CLI\'s real output on first run —');
  console.error(`check the job log above. ${STATE} reflects whatever got created (a draft is safe, not public).`);
  process.exit(1);
}
