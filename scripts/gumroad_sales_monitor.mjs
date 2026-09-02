#!/usr/bin/env node
/**
 * Gumroad sales monitor — runs in GitHub Actions (open egress), NOT in the
 * sandbox. Piggybacks on the existing sales-monitor.yml cron (every 4h,
 * already budgeted for Stripe polling) so this adds no new scheduled runs
 * or Actions minutes of its own -- just one extra HTTP call per firing.
 *
 * Detects real Gumroad sales via the official REST API v2 (GET /v2/sales,
 * `view_sales` OAuth scope), appends them to status/revenue_ledger.json
 * (preparation vs official by date) and status/EVENTS.jsonl, dedup by
 * order_id. Mirrors scripts/sales_monitor.mjs's structure and conventions.
 *
 * Spec source: GET /v2/sales (view_sales scope, after/before/page_key
 * params) and Purchase#as_json(version: 2) field names (id, order_id,
 * price [cents], currency, created_at, email, refunded, gumroad_fee
 * [cents]) verified directly against antiwork/gumroad's production source
 * (api/v2/sales_controller.rb, app/models/purchase.rb), same methodology
 * used for the publish pipeline -- not assumed from docs.
 *
 * Needs env GUMROAD_ACCESS_TOKEN (the same personal access token already
 * granted for publishing). If absent, no-ops cleanly.
 *
 * Known open question, deliberately NOT assumed either way: a personal
 * access token's scopes come from the OAuth application it belongs to
 * (see ops/GUMROAD_API_SETUP.md), and `view_sales` is an optional scope,
 * not a default one -- the existing token is confirmed to carry
 * `edit_products` (the publish run succeeded) but `view_sales` was never
 * separately verified. If the API rejects the call for insufficient scope,
 * this script logs that fact plainly and no-ops (exit 0, not a failure) --
 * it does NOT retry or guess. See ops/GUMROAD_API_SETUP.md's "Sales
 * detection" section for the fallback if that happens.
 */
import { readFileSync, writeFileSync, appendFileSync } from 'fs';

const TOKEN = process.env.GUMROAD_ACCESS_TOKEN;
if (!TOKEN) { console.log('gumroad_sales_monitor: no GUMROAD_ACCESS_TOKEN set — skipping (no-op).'); process.exit(0); }

const OFFICIAL_START = '2026-09-01';
const USD_TO_JPY = 150; // matches status/cost_ledger.json's fx_note; provider payout is authoritative
const LEDGER = 'status/revenue_ledger.json';
const COSTS = 'status/cost_ledger.json';
const EVENTS = 'status/EVENTS.jsonl';
const API = 'https://api.gumroad.com/v2';

function tokyoDate(isoOrEpoch) {
  const d = typeof isoOrEpoch === 'number' ? new Date(isoOrEpoch * 1000) : new Date(isoOrEpoch);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(d);
}

const res = await fetch(`${API}/sales`, { headers: { Authorization: `Bearer ${TOKEN}` } });
const json = await res.json().catch(() => ({}));
if (!res.ok || json.success === false) {
  // Distinguish "no view_sales scope" from other errors so this is
  // diagnosable from the job log without guessing.
  console.log(`gumroad_sales_monitor: GET /sales -> ${res.status} ${JSON.stringify(json)} — skipping this run (no-op, not a failure).`);
  console.log('gumroad_sales_monitor: if this is a scope/permission error, the access token likely lacks the view_sales scope — see ops/GUMROAD_API_SETUP.md "Sales detection" for the fallback (owner re-checks the Gumroad dashboard directly; no code change needed until scope is confirmed missing).');
  process.exit(0);
}

const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
ledger.preparation_entries ||= [];
ledger.official_entries ||= [];
const seen = new Set([...ledger.preparation_entries, ...ledger.official_entries].map(e => e.reference));

let costs = null;
try { costs = JSON.parse(readFileSync(COSTS, 'utf8')); } catch { costs = null; }
if (costs) { costs.preparation_entries ||= []; costs.official_entries ||= []; costs.totals ||= {}; }
const costSeen = costs ? new Set([...costs.preparation_entries, ...costs.official_entries].filter(e => e.reference).map(e => e.reference)) : new Set();

let added = 0;
for (const sale of (json.sales || [])) {
  const reference = 'gumroad:' + (sale.order_id ?? sale.id);
  if (seen.has(reference)) continue;
  if (sale.refunded || sale.chargedback) continue; // no net revenue to record

  const date = tokyoDate(sale.created_at);
  const period = date >= OFFICIAL_START ? 'official' : 'preparation';
  const currency = (sale.currency || 'usd').toLowerCase();
  const gross = Number(sale.price || 0) / 100; // Gumroad returns price in cents
  const jpyEquivalent = currency === 'jpy' ? gross : Math.round(gross * USD_TO_JPY);

  const entry = {
    date, period, gross, currency, jpy_equivalent: jpyEquivalent,
    source: 'gumroad', reference, verified: true,
  };
  (period === 'official' ? ledger.official_entries : ledger.preparation_entries).push(entry);
  appendFileSync(EVENTS, JSON.stringify({
    type: 'revenue_detected', timestamp: new Date().toISOString(), period, actor: 'gumroad-sales-monitor',
    details: { source: 'gumroad', jpy_equivalent: jpyEquivalent, currency, reference, date },
  }) + '\n');

  if (costs && Number(sale.gumroad_fee || 0) > 0) {
    const feeRef = 'fee:' + reference;
    if (!costSeen.has(feeRef)) {
      const feeGross = Number(sale.gumroad_fee) / 100;
      const feeJpy = currency === 'jpy' ? feeGross : Math.round(feeGross * USD_TO_JPY);
      const c = { date, period, category: 'gumroad_fees', amount: feeGross, currency, jpy_equivalent: feeJpy, reference: feeRef, note: 'Gumroad fee for ' + reference };
      (period === 'official' ? costs.official_entries : costs.preparation_entries).push(c);
      costSeen.add(feeRef);
    }
  }

  added++;
  console.log(`+ ${period} revenue ${jpyEquivalent} JPY (${reference}) on ${date}`);
}

ledger.totals ||= {};
ledger.totals.preparation_revenue_jpy_equivalent = ledger.preparation_entries.reduce((s, e) => s + Number(e.jpy_equivalent || 0), 0);
ledger.totals.official_revenue_jpy_equivalent = ledger.official_entries.reduce((s, e) => s + Number(e.jpy_equivalent || 0), 0);
writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');

if (costs) {
  costs.totals.preparation_cost_jpy_equivalent = costs.preparation_entries.reduce((s, e) => s + Number(e.jpy_equivalent || 0), 0);
  costs.totals.official_cost_jpy_equivalent = costs.official_entries.reduce((s, e) => s + Number(e.jpy_equivalent || 0), 0);
  writeFileSync(COSTS, JSON.stringify(costs, null, 2) + '\n');
}
console.log(`gumroad_sales_monitor: ${added} new sale(s). official rev=${ledger.totals.official_revenue_jpy_equivalent} prep rev=${ledger.totals.preparation_revenue_jpy_equivalent} JPY`);
