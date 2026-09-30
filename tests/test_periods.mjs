// Run: node tests/test_periods.mjs
// Verifies period routing in scripts/lib/periods.mjs against a throwaway copy
// of the real ledgers: Oct-dated revenue must never touch the Sept ledger.
import { mkdtempSync, mkdirSync, cpSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import assert from 'assert/strict';

const repo = join(import.meta.dirname, '..');
const tmp = mkdtempSync(join(tmpdir(), 'periods-'));
for (const p of ['scripts/lib', 'experiment/periods.json', 'status/revenue_ledger.json', 'status/cost_ledger.json', 'status/2026-10/revenue_ledger.json', 'status/2026-10/cost_ledger.json']) {
  mkdirSync(join(tmp, p, '..'), { recursive: true });
  cpSync(join(repo, p), join(tmp, p), { recursive: true });
}
mkdirSync(join(tmp, 'status/2026-10/events'), { recursive: true });
const { Books, periodFor, dayNumber } = await import(join(tmp, 'scripts/lib/periods.mjs'));

const septBefore = readFileSync(join(tmp, 'status/revenue_ledger.json'), 'utf8');
assert.equal(periodFor('2026-09-30').id, '2026-09');
assert.equal(periodFor('2026-10-01').id, '2026-10');
assert.equal(periodFor('2026-08-27').id, '2026-08-prep');
assert.equal(periodFor('2026-11-01'), null);
assert.equal(dayNumber('2026-10-01', periodFor('2026-10-01')), 1);
assert.equal(dayNumber('2026-10-31', periodFor('2026-10-31')), 31);

let b = new Books();
assert.equal(b.bookRevenue({ date: '2026-10-01', gross: 3000, currency: 'jpy', jpy_equivalent: 3000, source: 'stripe', reference: 'txn_oct', verified: true },
  { type: 'revenue_detected' }), '2026-10');
b.bookCost({ date: '2026-10-01', category: 'stripe_fees', amount: 108, currency: 'jpy', jpy_equivalent: 108, reference: 'fee:txn_oct' });
b.save();
assert.equal(readFileSync(join(tmp, 'status/revenue_ledger.json'), 'utf8'), septBefore, 'Sept ledger must be untouched by an Oct sale');
const oct = JSON.parse(readFileSync(join(tmp, 'status/2026-10/revenue_ledger.json'), 'utf8'));
assert.equal(oct.totals.gross_revenue_jpy, 3000);
assert.equal(oct.entries[0].phase, '2026-10');
const octCost = JSON.parse(readFileSync(join(tmp, 'status/2026-10/cost_ledger.json'), 'utf8'));
assert.equal(octCost.totals.known_cost_jpy, 108);
assert.ok(readFileSync(join(tmp, 'status/2026-10/events/sales-monitor.jsonl'), 'utf8').includes('"phase":"2026-10"'));

// Dedup across periods; a late-detected Sept 30 sale goes to Sept.
b = new Books();
assert.ok(b.seenRevenue().has('txn_oct'));
assert.equal(b.bookRevenue({ date: '2026-09-30', gross: 1, currency: 'jpy', jpy_equivalent: 1, source: 'stripe', reference: 'txn_sep' }), '2026-09');
b.save();
const sept = JSON.parse(readFileSync(join(tmp, 'status/revenue_ledger.json'), 'utf8'));
assert.equal(sept.official_entries.at(-1).reference, 'txn_sep');
assert.equal(sept.totals.official_revenue_jpy_equivalent, 1);
console.log('test_periods: all assertions passed');
