#!/usr/bin/env node
/**
 * Stripe sales monitor — runs in GitHub Actions (open egress), NOT in the
 * sandbox. Detects real charges and books them into the ledger of the period
 * their Asia/Tokyo date falls in (experiment/periods.json), dedup by txn id.
 *
 * Needs env STRIPE_RESTRICTED_KEY (a Stripe *restricted* key with read access
 * to Balance transactions / Charges). If absent, it no-ops cleanly so the
 * workflow never fails before the credential is granted.
 *
 * The Stripe account currency is JPY, so balance-transaction amounts are the
 * authoritative JPY-equivalent revenue (USD store charges are already converted).
 */
import { Books } from './lib/periods.mjs';

const KEY = process.env.STRIPE_RESTRICTED_KEY;

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

// Period-routed books (experiment/periods.json): Sept-dated charges go to the
// frozen Phase-1 ledgers, Oct-dated ones to status/2026-10/*. Dedup spans all.
const books = new Books();
const seen = books.seenRevenue();
const costSeen = books.seenCost();

// type=charge balance transactions = money received, already in account currency (JPY).
const bt = await stripeGet('balance_transactions?type=charge&limit=100');
let added = 0;
for (const t of (bt.data || [])) {
  if (seen.has(t.id)) continue;
  const date = tokyoDate(t.created);
  const entry = {
    date,
    gross: t.amount, currency: (t.currency || 'jpy'),
    jpy_equivalent: t.amount,   // account currency is JPY
    net: t.net,
    source: 'stripe',
    reference: t.id,
    verified: t.status === 'available' || t.status === 'pending',
    third_party: true, is_test: false,
  };
  const phase = books.bookRevenue(entry, {
    type: 'revenue_detected', timestamp: new Date().toISOString(), actor: 'sales-monitor',
    details: { source: 'stripe', jpy_equivalent: t.amount, currency: t.currency, reference: t.id, date }
  });
  if (!phase) continue;
  // Record the Stripe fee for this charge as an experiment cost.
  if (Number(t.fee) > 0 && !costSeen.has('fee:' + t.id)) {
    books.bookCost({ date, category: 'stripe_fees', amount: t.fee, currency: (t.currency || 'jpy'), jpy_equivalent: t.fee, reference: 'fee:' + t.id, note: 'Stripe fee for ' + t.id });
    costSeen.add('fee:' + t.id);
  }
  added++;
  console.log(`+ ${phase} revenue ${entry.jpy_equivalent} JPY (${t.id}) on ${date}, fee ${t.fee} JPY`);
}

books.save();
console.log(`sales_monitor: ${added} new charge(s) booked (period-routed via experiment/periods.json).`);
