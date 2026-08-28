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

console.log(`\npromotion_check: ${problems} problem(s) found.`);
if (problems > 0) { console.error('BLOCK: durable state looks malformed — do not promote to main.'); process.exit(1); }
process.exit(0);
