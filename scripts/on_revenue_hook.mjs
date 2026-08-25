#!/usr/bin/env node
/**
 * When the sales monitor records new revenue, queue an honest X post about it.
 * Runs in Actions after sales_monitor. Dedups via social/announced.json.
 * Does not post directly — it only enqueues; post_x.mjs (or the X workflow) posts.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';

const LEDGER = 'status/revenue_ledger.json';
const ANNOUNCED = 'social/announced.json';
const STORE = 'https://fever39risky-ux.github.io/ai-revenue-experiment/';
mkdirSync('social/queue', { recursive: true });

const ledger = JSON.parse(readFileSync(LEDGER, 'utf8'));
const announced = existsSync(ANNOUNCED) ? JSON.parse(readFileSync(ANNOUNCED, 'utf8')) : [];
const seen = new Set(announced);

const official = ledger.official_entries || [];
const prep = ledger.preparation_entries || [];
const officialTotal = official.reduce((s, e) => s + Number(e.jpy_equivalent || 0), 0);

let queued = 0;
function yen(n) { return '¥' + Number(n || 0).toLocaleString('en-US'); }

// Announce official entries (highest value); milestone text for the very first.
official.forEach((e, i) => {
  if (seen.has(e.reference)) return;
  const isFirst = i === 0;
  const text = isFirst
    ? `First real revenue in the official 30-day window: ${yen(e.jpy_equivalent)} from a third party via ${e.source}. This is what the experiment was for — an AI earning, not a human earning with AI. KPI: ${yen(officialTotal)} / ¥50,000. ${STORE}`
    : `New verified sale (official window): ${yen(e.jpy_equivalent)} via ${e.source}. KPI so far: ${yen(officialTotal)} / ¥50,000. ${STORE}`;
  writeFileSync(`social/queue/rev-${e.reference}.json`, JSON.stringify({ text, ref: e.reference }, null, 2) + '\n');
  seen.add(e.reference); queued++;
});
// Preparation entries: log honestly as NOT counted.
prep.forEach((e) => {
  if (seen.has(e.reference)) return;
  const text = `Preparation-period sale (NOT counted in the official 30 days, which start 9/1 at ¥0): ${yen(e.jpy_equivalent)} via ${e.source}. Logged separately for transparency. ${STORE}`;
  writeFileSync(`social/queue/rev-${e.reference}.json`, JSON.stringify({ text, ref: e.reference }, null, 2) + '\n');
  seen.add(e.reference); queued++;
});

writeFileSync(ANNOUNCED, JSON.stringify([...seen], null, 2) + '\n');
console.log(`on_revenue_hook: queued ${queued} post(s).`);
