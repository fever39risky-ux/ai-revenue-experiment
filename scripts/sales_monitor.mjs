#!/usr/bin/env node
/**
 * Stripe sales monitor — runs in GitHub Actions (open egress), NOT in the
 * sandbox. Detects real charges, appends them to status/revenue_ledger.json
 * (preparation vs official by date) and status/EVENTS.jsonl, dedup by txn id.
 *
 * Needs env STRIPE_RESTRICTED_KEY (a Stripe *restricted* key with read access
 * to Balance transactions / Charges). If absent, it no-ops cleanly so the
 * workflow never fails before the credential is granted.
 *
 * The Stripe account currency is JPY, so balance-transaction amounts are the
 * authoritative JPY-equivalent revenue (USD store charges are already converted).
 */
import { readFileSync, writeFileSync, appendFileSync } from 'fs';

const KEY = process.env.STRIPE_RESTRICTED_KEY;
const OFFICIAL_START = '2026-09-01';
const LEDGER = 'status/revenue_ledger.json';
const COSTS = 'status/cost_ledger.json';
const EVENTS = 'status/EVENTS.jsonl';

if (!KEY) { console.log('sales_monitor: no STRIPE_RESTRICTED_KEY set — skipping (no-op).'); process.exit(0); }

function tokyoDate(unixSec) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date(unixSec * 1000));
}
async function stripeGet(path) {
  const res = await fetch('https://api.stripe.com/v1/' + path, {
    headers: { Authorization: 'Bearer ' + KEY },
  });
  if (!res.ok) throw new Error(`Stripe ${path} -> ${res.status} ${await res.text()}`);
  return res.json();
}

const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
ledger.preparation_entries ||= [];
ledger.official_entries ||= [];
const seen = new Set([...ledger.preparation_entries, ...ledger.official_entries].map(e => e.reference));

// Cost ledger — capture Stripe fees automatically (fee is in account currency, JPY).
let costs = null;
try { costs = JSON.parse(readFileSync(COSTS, 'utf8')); } catch { costs = null; }
if (costs) { costs.preparation_entries ||= []; costs.official_entries ||= []; costs.totals ||= {}; }
const costSeen = costs ? new Set([...costs.preparation_entries, ...costs.official_entries].filter(e => e.reference).map(e => e.reference)) : new Set();

// type=charge balance transactions = money received, already in account currency (JPY).
const bt = await stripeGet('balance_transactions?type=charge&limit=100');
let added = 0;
for (const t of (bt.data || [])) {
  if (seen.has(t.id)) continue;
  const date = tokyoDate(t.created);
  const period = date >= OFFICIAL_START ? 'official' : 'preparation';
  const entry = {
    date, period,
    gross: t.amount, currency: (t.currency || 'jpy'),
    jpy_equivalent: t.amount,   // account currency is JPY
    net: t.net,
    source: 'stripe',
    reference: t.id,
    verified: t.status === 'available' || t.status === 'pending',
  };
  (period === 'official' ? ledger.official_entries : ledger.preparation_entries).push(entry);
  appendFileSync(EVENTS, JSON.stringify({
    type: 'revenue_detected', timestamp: new Date().toISOString(), period, actor: 'sales-monitor',
    details: { source: 'stripe', jpy_equivalent: t.amount, currency: t.currency, reference: t.id, date }
  }) + '\n');
  // Record the Stripe fee for this charge as an experiment cost.
  if (costs && Number(t.fee) > 0 && !costSeen.has('fee:' + t.id)) {
    const c = { date, period, category: 'stripe_fees', amount: t.fee, currency: (t.currency || 'jpy'), jpy_equivalent: t.fee, reference: 'fee:' + t.id, note: 'Stripe fee for ' + t.id };
    (period === 'official' ? costs.official_entries : costs.preparation_entries).push(c);
    costSeen.add('fee:' + t.id);
  }
  added++;
  console.log(`+ ${period} revenue ${entry.jpy_equivalent} JPY (${t.id}) on ${date}, fee ${t.fee} JPY`);
}

ledger.totals ||= {};
ledger.totals.preparation_revenue_jpy_equivalent = ledger.preparation_entries.reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
ledger.totals.official_revenue_jpy_equivalent = ledger.official_entries.reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
writeFileSync(LEDGER, JSON.stringify(ledger, null, 2) + '\n');

if (costs) {
  costs.totals.preparation_cost_jpy_equivalent = costs.preparation_entries.reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  costs.totals.official_cost_jpy_equivalent = costs.official_entries.reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  writeFileSync(COSTS, JSON.stringify(costs, null, 2) + '\n');
}
console.log(`sales_monitor: ${added} new charge(s). official rev=${ledger.totals.official_revenue_jpy_equivalent} prep rev=${ledger.totals.preparation_revenue_jpy_equivalent} JPY`);
