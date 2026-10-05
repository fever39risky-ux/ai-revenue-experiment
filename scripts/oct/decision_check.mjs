#!/usr/bin/env node
// Validates Founder decision reports (ops/2026-10/DECISION_REPORT.md).
//   node scripts/oct/decision_check.mjs [file ...]   (default: all status/2026-10/decisions/*.json)
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
export const REQUIRED_LANES = ['company', 'x', 'coconala_proposals', 'coconala_listing', 'booth', 'stripe_gumroad', 'note', 'zenn', 'etsy'];
export const DECISIONS = ['continue', 'improve', 'shrink', 'stop', 'expand'];
const FIELDS = ['fact', 'interpretation', 'decision', 'next_action', 'deadline_trigger'];
const DATE = /(\d{4}-\d{2}-\d{2}|\b\d{1,2}\/\d{1,2}\b)/;
export function check(obj) {
  const p = [];
  if (!obj || typeof obj !== 'object') return ['not an object'];
  if (!obj.fire) p.push('missing fire');
  const lanes = obj.lanes || {};
  for (const l of REQUIRED_LANES) {
    const e = lanes[l];
    if (!e) { p.push(`lane ${l} missing`); continue; }
    for (const f of FIELDS) if (!String(e[f] ?? '').trim()) p.push(`${l}.${f} empty`);
    if (e.decision && !DECISIONS.includes(e.decision)) p.push(`${l}.decision "${e.decision}" not in ${DECISIONS.join('|')}`);
    if (e.deadline_trigger && !DATE.test(e.deadline_trigger)) p.push(`${l}.deadline_trigger has no date`);
    if (e.interpretation && !/strength|weaken|unchanged|強ま|弱ま|変わらず/i.test(e.interpretation)) p.push(`${l}.interpretation does not state the hypothesis effect`);
  }
  return p;
}
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const dir = 'status/2026-10/decisions';
  const files = process.argv.slice(2).length ? process.argv.slice(2)
    : (existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')).map(f => join(dir, f)) : []);
  let bad = 0;
  for (const f of files) {
    let obj; try { obj = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { console.log(`FAIL ${f}: invalid JSON`); bad++; continue; }
    const p = check(obj);
    console.log(p.length ? `FAIL ${f}: ${p.join('; ')}` : `ok   ${f}`);
    bad += p.length ? 1 : 0;
  }
  process.exit(bad ? 1 : 0);
}
