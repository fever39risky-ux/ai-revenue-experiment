/**
 * Period resolution + period-routed ledger booking shared by the sales
 * monitors and the report generator. See experiment/periods.json.
 *
 * Rule: an entry is booked into the ledger of the period its Asia/Tokyo date
 * falls in. September (Phase 1) files are only written for September-dated
 * entries (e.g. a late-detected Sept 30 sale), never for October ones.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const r = p => join(ROOT, p);

export function loadPeriods() {
  return JSON.parse(readFileSync(r('experiment/periods.json'), 'utf8')).periods;
}
export function tokyoDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(d);
}
/** Period containing `date` (YYYY-MM-DD), or null (before prep / gap / after last). */
export function periodFor(date, periods = loadPeriods()) {
  return periods.find(p => date >= p.start && date <= p.end) || null;
}
export function dayNumber(date, period) {
  const d = new Date(date + 'T00:00:00+09:00'), s = new Date(period.start + 'T00:00:00+09:00');
  return Math.floor((d - s) / 86400000) + 1;
}
export function periodDays(period) { return dayNumber(period.end, period); }

function readJSON(p) { return JSON.parse(readFileSync(r(p), 'utf8')); }
const sum = a => a.reduce((s, e) => s + Number(e.jpy_equivalent || 0), 0);

/**
 * Loads every ledger file referenced by the registry once, and books entries
 * into the right one. Call save() at the end; only touched files are written.
 */
export class Books {
  constructor(periods = loadPeriods()) {
    this.periods = periods;
    this.files = new Map(); // path -> {data, dirty}
    for (const p of periods) { this._file(p.revenue_ledger); this._file(p.cost_ledger); }
  }
  _file(path) {
    if (!this.files.has(path)) {
      if (!existsSync(r(path))) throw new Error(`ledger missing: ${path}`);
      this.files.set(path, { data: readJSON(path), dirty: false });
    }
    return this.files.get(path);
  }
  _allEntries(kind) {
    const out = [];
    for (const p of this.periods) {
      const f = this._file(kind === 'revenue' ? p.revenue_ledger : p.cost_ledger);
      const b = kind === 'revenue' ? p.revenue_bucket : p.cost_bucket;
      out.push(...(f.data[b] || []));
    }
    return out;
  }
  seenRevenue() { return new Set(this._allEntries('revenue').map(e => e.reference).filter(Boolean)); }
  seenCost() { return new Set(this._allEntries('cost').map(e => e.reference).filter(Boolean)); }

  _target(date, kind) {
    const p = periodFor(date, this.periods);
    if (!p) return null;
    const f = this._file(kind === 'revenue' ? p.revenue_ledger : p.cost_ledger);
    const b = kind === 'revenue' ? p.revenue_bucket : p.cost_bucket;
    f.data[b] ||= [];
    return { p, f, b };
  }
  /** Returns the period id booked into, or null if the date is outside every period. */
  bookRevenue(entry, event) {
    const t = this._target(entry.date, 'revenue');
    if (!t) { console.log(`periods: revenue ${entry.reference} dated ${entry.date} is outside every period — not booked`); return null; }
    const period = t.p.kind === 'preparation' ? 'preparation' : 'official';
    t.f.data[t.b].push({ ...entry, period, phase: t.p.id });
    t.f.dirty = true;
    if (event) {
      const ev = t.p.events;
      mkdirSync(dirname(r(ev)), { recursive: true });
      appendFileSync(r(ev), JSON.stringify({ ...event, period, phase: t.p.id }) + '\n');
    }
    return t.p.id;
  }
  bookCost(entry) {
    const t = this._target(entry.date, 'cost');
    if (!t) return null;
    const period = t.p.kind === 'preparation' ? 'preparation' : 'official';
    t.f.data[t.b].push({ ...entry, period, phase: t.p.id });
    t.f.dirty = true;
    return t.p.id;
  }
  save() {
    for (const [path, f] of this.files) {
      if (!f.dirty) continue;
      const d = f.data;
      d.totals ||= {};
      if ('official_entries' in d || 'preparation_entries' in d) {
        // Phase 1 schema (keep its existing totals keys)
        const isCost = path.includes('cost');
        if (isCost) {
          d.totals.preparation_cost_jpy_equivalent = sum(d.preparation_entries || []);
          d.totals.official_cost_jpy_equivalent = sum(d.official_entries || []);
        } else {
          d.totals.preparation_revenue_jpy_equivalent = sum(d.preparation_entries || []);
          d.totals.official_revenue_jpy_equivalent = sum(d.official_entries || []);
        }
      } else {
        recomputePhase2Totals(d, path.includes('cost'));
      }
      writeFileSync(r(path), JSON.stringify(d, null, 2) + '\n');
    }
  }
}

export function recomputePhase2Totals(d, isCost) {
  const es = d.entries || [];
  d.totals ||= {};
  if (isCost) {
    d.totals.known_cost_jpy = sum(es.filter(e => e.jpy_equivalent != null));
    d.totals.unknown_cost_entries = es.filter(e => e.jpy_equivalent == null).length;
  } else {
    const third = es.filter(e => e.third_party !== false && e.is_test !== true);
    d.totals.gross_revenue_jpy = sum(third);
    d.totals.verified_gross_revenue_jpy = sum(third.filter(e => e.verified === true));
    d.totals.orders = third.length;
  }
  return d;
}
