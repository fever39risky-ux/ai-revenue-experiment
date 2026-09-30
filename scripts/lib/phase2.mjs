/**
 * Phase 2 (October 2026) shared state readers: events (one JSONL file per
 * operator under status/2026-10/events/), KPI rollup, operator registry.
 * Single-writer files keep parallel operators from git-conflicting:
 *   status/2026-10/operators/<id>.json   written only by operator <id>
 *   status/2026-10/events/<id>.jsonl     appended only by operator <id>
 *   status/2026-10/tasks/<task>.json     created by anyone, claimed via lease
 *   status/2026-10/STATE.json            written only by the Founder
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ROOT, tokyoDate } from './periods.mjs';

export const P2 = 'status/2026-10';
export const START = '2026-10-01', END = '2026-10-31';
const r = p => join(ROOT, p);
const readJSON = (p, f) => { try { return JSON.parse(readFileSync(r(p), 'utf8')); } catch { return f; } };

export function readEvents() {
  const dir = r(`${P2}/events`);
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.jsonl')).sort()) {
    readFileSync(join(dir, f), 'utf8').split('\n').forEach((l, i) => {
      if (!l.trim()) return;
      try { out.push({ ...JSON.parse(l), _file: f }); } catch { out.push({ type: 'invalid_line', _file: f, _line: i + 1 }); }
    });
  }
  return out.sort((a, b) => String(a.ts || a.timestamp).localeCompare(String(b.ts || b.timestamp)));
}
const evDate = e => tokyoDate(new Date(e.ts || e.timestamp));
const inWindow = (e, upto) => { const d = evDate(e); return d >= START && d <= (upto || END); };

export const SIGNAL_METRICS = ['qualified_reach', 'profile_visit', 'link_click', 'follower_delta', 'inquiry', 'sales_conversation', 'proposal_sent', 'checkout_started', 'order', 'repeat_buyer', 'valid_demand_signal'];

/** Official October KPI as of `upto` (YYYY-MM-DD JST, default end of period). */
export function computeKpi(upto) {
  const rev = readJSON(`${P2}/revenue_ledger.json`, { entries: [] }).entries || [];
  const cost = readJSON(`${P2}/cost_ledger.json`, { entries: [] }).entries || [];
  const lim = e => e.date >= START && e.date <= (upto || END);
  const third = rev.filter(lim).filter(e => e.third_party !== false && e.is_test !== true);
  const gross = third.reduce((s, e) => s + Number(e.jpy_equivalent || 0), 0);
  const costs = cost.filter(lim);
  const knownCost = costs.filter(e => e.jpy_equivalent != null).reduce((s, e) => s + Number(e.jpy_equivalent), 0);
  const events = readEvents().filter(e => inWindow(e, upto));
  const hi = events.filter(e => e.type === 'human_intervention');
  const signals = {};
  for (const e of events.filter(e => e.type === 'signal')) {
    signals[e.metric] ||= { total: 0, by_channel: {} };
    signals[e.metric].total += Number(e.count || 1);
    signals[e.metric].by_channel[e.channel || 'unknown'] = (signals[e.metric].by_channel[e.channel || 'unknown'] || 0) + Number(e.count || 1);
  }
  const byChannel = {};
  for (const e of third) byChannel[e.source] = (byChannel[e.source] || 0) + Number(e.jpy_equivalent || 0);
  return {
    as_of: upto || tokyoDate(),
    gross_revenue_jpy: gross,
    verified_gross_revenue_jpy: third.filter(e => e.verified === true).reduce((s, e) => s + Number(e.jpy_equivalent || 0), 0),
    orders: third.length,
    revenue_by_channel: byChannel,
    cost_known_jpy: knownCost,
    cost_unknown_entries: costs.filter(e => e.jpy_equivalent == null).length,
    net_profit_jpy: gross - knownCost,
    net_profit_note: costs.some(e => e.jpy_equivalent == null) ? 'upper bound: some attributable costs are unknown (null)' : 'all booked costs known',
    human_intervention_count: hi.length,
    human_working_minutes: hi.reduce((s, e) => s + Number(e.minutes || 0), 0),
    human_interventions_avoidable: hi.filter(e => e.avoidable === true).length,
    human_by_category: hi.reduce((m, e) => (m[e.category || 'other'] = (m[e.category || 'other'] || 0) + 1, m), {}),
    signals,
  };
}

export function readOperators() {
  const dir = r(`${P2}/operators`);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => readJSON(`${P2}/operators/${f}`, { id: f, invalid: true }));
}
export function readTasks() {
  const dir = r(`${P2}/tasks`);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.json')).map(f => readJSON(`${P2}/tasks/${f}`, { id: f, invalid: true }));
}
export function readState() { return readJSON(`${P2}/STATE.json`, null); }
