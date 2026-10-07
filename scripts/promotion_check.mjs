#!/usr/bin/env node
/**
 * Promotion sanity gate for the claude/** -> main auto-promotion Action.
 * Pure Node, no deps. Cheap, structural checks only (not a full test suite):
 * every durable-memory JSON file the loop writes must still parse, and the
 * few filename/date conventions the report pipeline relies on must hold.
 * Exit 1 with a clear reason on the first problem found; exit 0 if clean.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';

let problems = 0;
function fail(msg) { problems++; console.log(`FAIL  ${msg}`); }

function readJSON(path) {
  if (!existsSync(path)) { fail(`${path}: missing`); return null; }
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    fail(`${path}: invalid JSON (${e.message})`);
    return null;
  }
}

// Core ledgers/state files the whole loop depends on.
for (const p of [
  'status/CURRENT_STATUS.json',
  'status/cadence.json',
  'status/cost_ledger.json',
  'status/revenue_ledger.json',
  'reports/manifest.json',
  'experiment/EXPERIMENT_CONFIG.json',
]) readJSON(p);

// Every daily report data file must at least parse and carry its own date.
const dataDir = 'reports/data';
if (existsSync(dataDir)) {
  for (const f of readdirSync(dataDir)) {
    if (!f.endsWith('.json')) continue;
    const j = readJSON(`${dataDir}/${f}`);
    if (j && j.date && `${j.date}.json` !== f) {
      fail(`${dataDir}/${f}: internal date "${j.date}" does not match filename`);
    }
  }
}

// EVENTS.jsonl: every non-empty line must be one JSON object.
const eventsPath = 'status/EVENTS.jsonl';
if (existsSync(eventsPath)) {
  const lines = readFileSync(eventsPath, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    try { JSON.parse(line); } catch (e) { fail(`${eventsPath}:${i + 1}: invalid JSON line (${e.message})`); }
  });
} else {
  fail(`${eventsPath}: missing`);
}

// Revenue/cost ledgers must not silently mix official and preparation periods.
const revenue = readJSON('status/revenue_ledger.json');
if (revenue) {
  for (const e of [...(revenue.official_entries || [])]) {
    if (e.period && e.period !== 'official') fail(`revenue_ledger.json: entry dated ${e.date} is in official_entries but period="${e.period}"`);
  }
  for (const e of [...(revenue.preparation_entries || [])]) {
    if (e.period && e.period !== 'preparation') fail(`revenue_ledger.json: entry dated ${e.date} is in preparation_entries but period="${e.period}"`);
  }
}

// ---- Phase 2 (October 2026) guards -----------------------------------------
// Phase 1 ledgers are frozen history: nothing dated in October may land there.
for (const [p, keys] of [['status/revenue_ledger.json', ['official_entries', 'preparation_entries']], ['status/cost_ledger.json', ['official_entries', 'preparation_entries']]]) {
  const j = readJSON(p);
  if (!j) continue;
  for (const k of keys) for (const e of (j[k] || [])) {
    if (e.date && e.date >= '2026-10-01') fail(`${p}: ${k} contains an entry dated ${e.date} — October entries belong in status/2026-10/ (see experiment/periods.json)`);
  }
}
if (existsSync('experiment/periods.json')) {
  readJSON('experiment/periods.json');
  for (const p of ['status/2026-10/revenue_ledger.json', 'status/2026-10/cost_ledger.json', 'status/2026-10/STATE.json']) {
    const j = readJSON(p);
    if (!j) continue;
    for (const e of (j.entries || [])) {
      if (!e.date || e.date < '2026-10-01' || e.date > '2026-10-31') fail(`${p}: entry ${e.reference || '?'} dated ${e.date} is outside Phase 2 (2026-10-01..31)`);
      if (p.includes('revenue') && !e.reference) fail(`${p}: revenue entry dated ${e.date} has no reference (dedup key)`);
    }
  }
  // STATE.json is the Founder's working memory, not an archive: keep it small.
  if (existsSync('status/2026-10/STATE.json')) {
    const size = readFileSync('status/2026-10/STATE.json').length;
    if (size > 40000) fail(`status/2026-10/STATE.json is ${size} bytes (> 40000). Move history to events/reports; STATE holds only the current picture.`);
  }
  for (const dir of ['status/2026-10/operators', 'status/2026-10/tasks']) {
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir)) if (f.endsWith('.json')) readJSON(`${dir}/${f}`);
  }
  const evDir = 'status/2026-10/events';
  if (existsSync(evDir)) {
    for (const f of readdirSync(evDir)) {
      if (!f.endsWith('.jsonl')) continue;
      readFileSync(`${evDir}/${f}`, 'utf8').split('\n').forEach((line, i) => {
        if (!line.trim()) return;
        try { JSON.parse(line); } catch (e) { fail(`${evDir}/${f}:${i + 1}: invalid JSON line (${e.message})`); }
      });
    }
  }
}

// Founder decision reports must be complete (ops/2026-10/DECISION_REPORT.md).
{
  const { check } = await import('./oct/decision_check.mjs');
  const dd = 'status/2026-10/decisions';
  if (existsSync(dd)) for (const f of readdirSync(dd).filter(f => f.endsWith('.json'))) {
    const j = readJSON(`${dd}/${f}`);
    if (j) for (const prob of check(j)) fail(`${dd}/${f}: ${prob}`);
    const m = f.match(/(\d{4}-\d{2}-\d{2})T20\d{2}\.json$/);
    const rv = (readJSON('status/2026-10/STATE.json') || {}).reviews || [];
    if (j && m && m[1] >= '2026-10-08' && rv.includes(m[1]) && !j.review) fail(`${dd}/${f}: 20:xx report on a weekly review date must set "review": true (ops/2026-10/REVIEW_SPEC.md)`);
  }
}

console.log(`\npromotion_check: ${problems} problem(s) found.`);
if (problems > 0) { console.error('BLOCK: durable state looks malformed — do not promote to main.'); process.exit(1); }
process.exit(0);
