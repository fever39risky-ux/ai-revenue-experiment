#!/usr/bin/env node
/**
 * Phase 2 coordination CLI — the one tool every October operator uses to tell
 * the others who it is, what it is doing, and what the market returned.
 * Pure Node, no deps. Writes only single-writer files (see scripts/lib/phase2.mjs),
 * so parallel operators never git-conflict on shared state.
 *
 *   node scripts/oct/ops.mjs board                         # who is doing what, stale heartbeats, open tasks, KPI
 *   node scripts/oct/ops.mjs heartbeat <op> --status working --doing "..." --next "..." [--lanes a,b] [--runtime ...] [--kind ...] [--capabilities x,y]
 *   node scripts/oct/ops.mjs event <op> <type> --summary "..." [--lane x] [--hypothesis H1] [--k v ...]
 *   node scripts/oct/ops.mjs signal <op> <metric> <count> --channel x --evidence "url/run id"
 *   node scripts/oct/ops.mjs human <op> --minutes N --category login|2fa|kyc|password|legal|banking|permission|decision|other --reason "..." [--avoidable true]
 *   node scripts/oct/ops.mjs revenue <op> --date YYYY-MM-DD --gross N --currency jpy --jpy N --source coconala --reference ID [--hypothesis H]
 *   node scripts/oct/ops.mjs cost <op> --date YYYY-MM-DD --category ai_compute --jpy N|null --note "..." [--reference ID]
 *   node scripts/oct/ops.mjs task-new <op> <task-id> --title "..." --lane x [--requires local_browser] [--site coconala.com] [--priority 1] [--detail "..."] [--not-before ISO] [--due ISO]
 *   node scripts/oct/ops.mjs claim <op> <task-id> [--hours 6]       # take a task (fails if another live lease holds it)
 *   node scripts/oct/ops.mjs done <op> <task-id> --result "..."      # or: release <op> <task-id> --reason "..."
 *   node scripts/oct/ops.mjs kpi [YYYY-MM-DD]
 *
 * All timestamps UTC ISO. Commit + `git pull --rebase` + push after writing.
 */
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ROOT, tokyoDate } from '../lib/periods.mjs';
import { P2, computeKpi, readOperators, readTasks, readState, SIGNAL_METRICS } from '../lib/phase2.mjs';
import { Books } from '../lib/periods.mjs';

const r = p => join(ROOT, p);
// OPS_NOW (ISO) overrides the clock — tests only; never set it in real runs.
const now = () => process.env.OPS_NOW || new Date().toISOString();
const [cmd, ...rest] = process.argv.slice(2);
const pos = [], opt = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) { opt[rest[i].slice(2)] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : 'true'; }
  else pos.push(rest[i]);
}
const die = m => { console.error('ops: ' + m); process.exit(1); };
const idOk = s => /^[a-z0-9][a-z0-9-]{1,40}$/.test(s || '');
const opId = () => { const o = pos[0]; if (!idOk(o)) die(`operator id must match [a-z0-9-] (got "${o}")`); return o; };
const HEARTBEAT_STALE_MIN = 180;

function appendEvent(op, ev) {
  mkdirSync(r(`${P2}/events`), { recursive: true });
  const line = { ts: now(), operator: op, ...ev };
  appendFileSync(r(`${P2}/events/${op}.jsonl`), JSON.stringify(line) + '\n');
  return line;
}
const list = v => v ? String(v).split(',').map(s => s.trim()).filter(Boolean) : undefined;
const num = v => v === undefined || v === 'null' ? null : Number(v);

switch (cmd) {
  case 'heartbeat': {
    const op = opId(), p = r(`${P2}/operators/${op}.json`);
    const prev = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { id: op, registered_at: now() };
    const next = { ...prev, id: op,
      kind: opt.kind ?? prev.kind, runtime: opt.runtime ?? prev.runtime, role: opt.role ?? prev.role,
      lanes: list(opt.lanes) ?? prev.lanes ?? [], capabilities: list(opt.capabilities) ?? prev.capabilities ?? [],
      status: opt.status ?? prev.status ?? 'working', doing: opt.doing ?? prev.doing, progress: opt.progress ?? prev.progress,
      next: opt.next ?? prev.next, blocked_on: opt['blocked-on'] ?? (opt.status === 'blocked' ? prev.blocked_on : null),
      last_commit: opt.commit ?? prev.last_commit, heartbeat_at: now() };
    for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
    mkdirSync(r(`${P2}/operators`), { recursive: true });
    writeFileSync(p, JSON.stringify(next, null, 2) + '\n');
    // Lane collision warning (two live operators on one lane without a hand-off).
    const live = readOperators().filter(o => o.id !== op && o.status !== 'retired' && o.heartbeat_at && (Date.now() - Date.parse(o.heartbeat_at)) / 60000 < HEARTBEAT_STALE_MIN);
    for (const l of next.lanes) for (const o of live) if ((o.lanes || []).includes(l)) console.log(`WARN lane "${l}" is also held by live operator ${o.id} — coordinate via a task/hand-off before touching it.`);
    console.log(`heartbeat ${op} ${next.status}`); break;
  }
  case 'event': {
    const op = opId(), type = pos[1]; if (!type) die('event type required');
    const { summary, ...extra } = opt;
    console.log(JSON.stringify(appendEvent(op, { type, summary, ...extra }))); break;
  }
  case 'signal': {
    const op = opId(), metric = pos[1], count = Number(pos[2] ?? 1);
    if (!SIGNAL_METRICS.includes(metric)) die(`metric must be one of ${SIGNAL_METRICS.join(', ')}`);
    if (!opt.channel || !opt.evidence) die('--channel and --evidence are required (no evidence = not a signal)');
    console.log(JSON.stringify(appendEvent(op, { type: 'signal', metric, count, channel: opt.channel, evidence: opt.evidence, hypothesis: opt.hypothesis, note: opt.note }))); break;
  }
  case 'human': {
    const op = opId();
    if (opt.minutes === undefined || !opt.reason) die('--minutes and --reason are required');
    const cats = ['login', '2fa', 'kyc', 'password', 'legal', 'banking', 'permission', 'decision', 'manual_work', 'other'];
    if (!cats.includes(opt.category || 'other')) die(`--category must be one of ${cats.join(', ')}`);
    console.log(JSON.stringify(appendEvent(op, { type: 'human_intervention', minutes: Number(opt.minutes), category: opt.category || 'other', reason: opt.reason, avoidable: opt.avoidable === 'true', lane: opt.lane, requested_by: opt['requested-by'] || op }))); break;
  }
  case 'revenue': {
    const op = opId();
    for (const k of ['date', 'gross', 'currency', 'jpy', 'source', 'reference']) if (!opt[k]) die(`--${k} required`);
    if (opt.date < '2026-10-01' || opt.date > '2026-10-31') die('Phase 2 revenue must be dated 2026-10-01..31 (JST)');
    const b = new Books();
    if (b.seenRevenue().has(opt.reference)) die(`reference ${opt.reference} already booked`);
    b.bookRevenue({ date: opt.date, gross: Number(opt.gross), currency: opt.currency, jpy_equivalent: Number(opt.jpy), source: opt.source, reference: opt.reference,
      verified: opt.verified !== 'false', third_party: opt['third-party'] !== 'false', is_test: opt.test === 'true', hypothesis: opt.hypothesis, booked_by: op });
    b.save();
    appendEvent(op, { type: 'revenue_booked', source: opt.source, jpy: Number(opt.jpy), reference: opt.reference, hypothesis: opt.hypothesis });
    console.log('booked'); break;
  }
  case 'cost': {
    const op = opId();
    if (!opt.date || !opt.category || opt.jpy === undefined || !opt.note) die('--date --category --jpy (number or null) --note required');
    if (opt.date < '2026-10-01' || opt.date > '2026-10-31') die('Phase 2 cost must be dated 2026-10-01..31 (JST)');
    const b = new Books();
    if (opt.reference && b.seenCost().has(opt.reference)) die(`reference ${opt.reference} already booked`);
    b.bookCost({ date: opt.date, category: opt.category, amount: num(opt.amount ?? opt.jpy), currency: opt.currency || 'jpy', jpy_equivalent: num(opt.jpy), note: opt.note, reference: opt.reference, operator: op });
    b.save(); console.log('booked'); break;
  }
  case 'task-new': {
    const op = opId(), id = pos[1]; if (!idOk(id)) die('task id must match [a-z0-9-]');
    const p = r(`${P2}/tasks/${id}.json`); if (existsSync(p)) die(`task ${id} exists`);
    if (!opt.title || !opt.lane) die('--title and --lane required');
    mkdirSync(r(`${P2}/tasks`), { recursive: true });
    writeFileSync(p, JSON.stringify({ id, title: opt.title, lane: opt.lane, detail: opt.detail, requires: list(opt.requires) || [], site: opt.site,
      priority: Number(opt.priority || 3), hypothesis: opt.hypothesis, acceptance: opt.acceptance, due_at: opt.due, not_before: opt['not-before'], created_by: op, created_at: now(), status: 'open',
      claimed_by: null, lease_until: null, result: null, history: [] }, null, 2) + '\n');
    appendEvent(op, { type: 'task_created', task: id, lane: opt.lane }); console.log(`task ${id} created`); break;
  }
  case 'claim': case 'done': case 'release': {
    const op = opId(), id = pos[1], p = r(`${P2}/tasks/${id}.json`);
    if (!existsSync(p)) die(`no task ${id}`);
    const t = JSON.parse(readFileSync(p, 'utf8'));
    const leaseLive = t.claimed_by && t.lease_until && Date.parse(t.lease_until) > Date.parse(now());
    if (cmd === 'claim') {
      if (t.status === 'done') die(`task ${id} already done`);
      if (t.not_before && Date.parse(t.not_before) > Date.parse(now())) die(`task ${id} not claimable before ${t.not_before}`);
      if (leaseLive && t.claimed_by !== op) die(`task ${id} is leased by ${t.claimed_by} until ${t.lease_until}`);
      t.claimed_by = op; t.status = 'claimed'; t.lease_until = new Date(Date.parse(now()) + Number(opt.hours || 6) * 3600e3).toISOString();
    } else {
      if (t.claimed_by && t.claimed_by !== op && leaseLive) die(`task ${id} is leased by ${t.claimed_by}`);
      if (cmd === 'done') { if (!opt.result) die('--result required'); t.status = 'done'; t.result = opt.result; }
      else { t.status = 'open'; t.claimed_by = null; t.lease_until = null; }
    }
    t.history.push({ ts: now(), op, action: cmd, note: opt.result || opt.reason });
    writeFileSync(p, JSON.stringify(t, null, 2) + '\n');
    appendEvent(op, { type: `task_${cmd}`, task: id, result: opt.result, reason: opt.reason });
    console.log(`${cmd} ${id} by ${op}`); break;
  }
  case 'kpi': console.log(JSON.stringify(computeKpi(pos[0]), null, 2)); break;
  case 'board': default: {
    const s = readState() || {}, k = computeKpi();
    console.log(`=== Phase 2 board — ${now()} (JST ${tokyoDate()}) ===`);
    console.log(`KPI  gross ¥${k.gross_revenue_jpy}  cost ¥${k.cost_known_jpy} (+${k.cost_unknown_entries} unknown)  net ¥${k.net_profit_jpy}  human ${k.human_intervention_count}x/${k.human_working_minutes}min`);
    if (s.bottleneck) console.log(`BOTTLENECK  ${s.bottleneck}`);
    if (s.priority_actions) { console.log('PRIORITY'); for (const a of s.priority_actions.slice(0, 5)) console.log(`  - [${a.owner || '?'}] ${a.action}`); }
    console.log('OPERATORS');
    for (const o of readOperators().sort((a, b) => String(a.id).localeCompare(b.id))) {
      const age = o.heartbeat_at ? Math.round((Date.now() - Date.parse(o.heartbeat_at)) / 60000) : null;
      const flag = o.status === 'retired' ? 'RETIRED' : age === null ? 'NEVER' : age > HEARTBEAT_STALE_MIN ? `STALE ${age}m` : `live ${age}m`;
      console.log(`  ${o.id.padEnd(22)} ${String(o.status).padEnd(9)} ${flag.padEnd(11)} lanes=${(o.lanes || []).join(',')}\n      doing: ${o.doing || '-'}\n      next:  ${o.next || '-'}`);
    }
    const open = readTasks().filter(t => t.status !== 'done');
    console.log(`TASKS (${open.length} not done)`);
    for (const t of open.sort((a, b) => (a.priority || 9) - (b.priority || 9))) console.log(`  P${t.priority} ${t.id.padEnd(30)} ${t.status.padEnd(8)} ${t.claimed_by || ''} [${(t.requires || []).join(',')}] ${t.title}${t.not_before ? ` (from ${t.not_before})` : ''}${t.due_at ? ` (due ${t.due_at})` : ''}`);
  }
}
