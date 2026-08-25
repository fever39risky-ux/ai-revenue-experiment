#!/usr/bin/env node
/**
 * Daily report generator for the AI Revenue Experiment.
 * Pure Node (no deps) so it runs locally and in GitHub Actions.
 *
 * Usage: node scripts/gen_report.mjs [YYYY-MM-DD]
 *   - default date = today in Asia/Tokyo
 *   - reads reports/data/<date>.json  (narrative, written by the AI)
 *   - reads status/revenue_ledger.json (revenue, written by the sales monitor)
 *   - writes reports/<official: 2026-09-DD | prep: prep-YYYY-MM-DD>.html
 *   - updates reports/manifest.json and regenerates reports/index.html
 *
 * Official KPI counts ONLY period="official" (date >= 2026-09-01). Preparation
 * revenue is shown separately and NEVER added to the official total.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OFFICIAL_START = '2026-09-01';
const OFFICIAL_END = '2026-09-30';

function tokyoToday() {
  // en-CA gives YYYY-MM-DD
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date());
}
function readJSON(p, fallback) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fallback; }
}
function dayNumber(date) {
  const d = new Date(date + 'T00:00:00+09:00');
  const s = new Date(OFFICIAL_START + 'T00:00:00+09:00');
  return Math.floor((d - s) / 86400000) + 1;
}
function isOfficial(date) { return date >= OFFICIAL_START && date <= OFFICIAL_END; }
function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function yen(n) { return '¥' + Number(n || 0).toLocaleString('en-US'); }

// Render a field that may be a string (HTML/text) or an array of bullet items.
function field(v, emptyText = '—') {
  if (v == null || (Array.isArray(v) && v.length === 0) || v === '') return `<span class="meta">${emptyText}</span>`;
  if (Array.isArray(v)) return '<ul>' + v.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>';
  return esc(v).replace(/\n/g, '<br>');
}
function lanes(l) {
  l = l || {};
  const started = (l.started && l.started.length) ? '<b>開始 / Started:</b><ul>' + l.started.map(x=>`<li>${esc(x)}</li>`).join('') + '</ul>' : '';
  const stopped = (l.stopped && l.stopped.length) ? '<b>停止 / Stopped:</b><ul>' + l.stopped.map(x=>`<li>${esc(x)}</li>`).join('') + '</ul>' : '';
  return (started + stopped) || '<span class="meta">変更なし / no lane changes</span>';
}

function computeRevenue(ledger, date) {
  const off = (ledger.official_entries || []);
  const prep = (ledger.preparation_entries || []);
  const officialCumulative = off.filter(e => e.date <= date).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  const dayEntries = (isOfficial(date) ? off : prep).filter(e => e.date === date);
  const daily = dayEntries.reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  const prepTotal = prep.reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  return { officialCumulative, daily, prepTotal, hasOfficial: off.length>0 };
}

function main() {
  const date = process.argv[2] || tokyoToday();
  const official = isOfficial(date);
  const data = readJSON(join(ROOT, 'reports/data', date + '.json'), {});
  const status = readJSON(join(ROOT, 'status/CURRENT_STATUS.json'), {});
  const ledger = readJSON(join(ROOT, 'status/revenue_ledger.json'), { official_entries: [], preparation_entries: [] });
  const rev = computeRevenue(ledger, date);

  const day = official ? dayNumber(date) : null;
  const headline = official ? `Day ${day}` : `準備期間 / Preparation`;
  const outName = official ? `${date}.html` : `prep-${date}.html`;
  const periodClass = official ? 'official' : 'prep';
  const periodBanner = official
    ? `正式検証期間 Day ${day}/30 — この期間の第三者収益のみが公式KPIに計上されます。`
    : `準備期間（${data.prep_range || '2026-08-26〜2026-08-31'}）— ここでの収益は「準備期間収益」として記録し、公式30日間（9/1開始, ¥0スタート）とは分離します。`;
  const revenueNote = official
    ? `公式累計 = 9/1以降の第三者検証収益のみ。準備期間の収益（${yen(rev.prepTotal)}）は含みません。`
    : `準備期間収益（分離計上）: ${yen(rev.prepTotal)}。公式KPIは9/1に¥0から開始します。`;

  const tpl = readFileSync(join(ROOT, 'reports/TEMPLATE.html'), 'utf8');
  const html = tpl
    .replaceAll('{{TITLE}}', official ? `Day ${day} (${date})` : `Preparation ${date}`)
    .replaceAll('{{META_DESC}}', `AI Revenue Experiment ${official ? 'Day '+day : 'preparation'} report for ${date}.`)
    .replaceAll('{{PERIOD_CLASS}}', periodClass)
    .replaceAll('{{PERIOD_BANNER}}', periodBanner)
    .replaceAll('{{HEADLINE}}', headline)
    .replaceAll('{{DATE}}', date)
    .replaceAll('{{OFFICIAL_CUMULATIVE}}', yen(rev.officialCumulative))
    .replaceAll('{{DAILY_REVENUE}}', yen(rev.daily))
    .replaceAll('{{HUMAN_MINUTES}}', String(data.human_minutes_today ?? 0))
    .replaceAll('{{FOCUS}}', esc(data.focus || status.current_focus || '—'))
    .replaceAll('{{REVENUE_NOTE}}', revenueNote)
    .replaceAll('{{ACTIONS}}', field(data.actions))
    .replaceAll('{{DECISIONS}}', field(data.decisions))
    .replaceAll('{{STRATEGY}}', field(data.strategy))
    .replaceAll('{{LANES}}', lanes(data.lanes))
    .replaceAll('{{OBSERVED}}', field(data.observed, '本日の外部実データなし / no external data yet'))
    .replaceAll('{{WINS_FAILS}}', field(data.wins_failures || [...(data.wins||[]).map(w=>'✓ '+w), ...(data.failures||[]).map(f=>'✗ '+f), ...(data.surprises||[]).map(s=>'? '+s)]))
    .replaceAll('{{LEARNINGS}}', field(data.learnings))
    .replaceAll('{{CAPABILITIES}}', field(data.capabilities))
    .replaceAll('{{SOCIAL}}', field(data.social))
    .replaceAll('{{NEXT}}', field(data.next));

  writeFileSync(join(ROOT, 'reports', outName), html);
  console.log('wrote reports/' + outName);

  updateManifest(ROOT, ledger);
  regenIndex(ROOT);
}

function updateManifest(ROOT, ledger) {
  const manifestPath = join(ROOT, 'reports/manifest.json');
  const m = readJSON(manifestPath, { official_start: OFFICIAL_START, official_end: OFFICIAL_END, latest_report: null, reports: [] });
  const dir = join(ROOT, 'reports');
  const officialFiles = readdirSync(dir).filter(f => /^2026-09-\d{2}\.html$/.test(f)).sort();
  const off = ledger.official_entries || [];
  let cumulative = 0;
  const reports = officialFiles.map(f => {
    const date = f.replace('.html','');
    const day = dayNumber(date);
    const daily = off.filter(e=>e.date===date).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
    cumulative += daily;
    const data = readJSON(join(ROOT,'reports/data',date+'.json'), {});
    return { day, date, path: 'reports/'+f, summary: data.summary || data.focus || '', daily_revenue_jpy_equivalent: daily, cumulative_revenue_jpy_equivalent: cumulative };
  });
  m.official_start = OFFICIAL_START; m.official_end = OFFICIAL_END;
  m.reports = reports;
  m.latest_report = reports.length ? reports[reports.length-1].path : null;
  m.preparation_revenue_jpy_equivalent = (ledger.preparation_entries||[]).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  m.official_revenue_jpy_equivalent = cumulative;
  writeFileSync(manifestPath, JSON.stringify(m, null, 2) + '\n');
  console.log('updated reports/manifest.json');
}

function regenIndex(ROOT) {
  const dir = join(ROOT, 'reports');
  const official = readdirSync(dir).filter(f=>/^2026-09-\d{2}\.html$/.test(f)).sort();
  const prep = readdirSync(dir).filter(f=>/^prep-\d{4}-\d{2}-\d{2}\.html$/.test(f)).sort();
  const m = readJSON(join(dir,'manifest.json'), { reports: [] });
  const row = (f) => {
    const date = f.replace(/^prep-/,'').replace('.html','');
    const rec = (m.reports||[]).find(r=>r.path==='reports/'+f);
    const label = f.startsWith('prep-') ? `準備 / Prep ${date}` : `Day ${rec?rec.day:'?'} — ${date}`;
    const rev = rec ? ` · ${yen(rec.daily_revenue_jpy_equivalent)}` : '';
    return `<li><a href="./${f}">${label}</a>${rev}</li>`;
  };
  const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Revenue Experiment — 日報一覧 / Daily Reports</title>
<style>body{margin:0;background:linear-gradient(180deg,#0b1020,#0f172a);color:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7}main{max-width:820px;margin:0 auto;padding:42px 20px 72px}.eyebrow{color:#7dd3fc;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.82rem}h1{font-size:clamp(1.8rem,5vw,3rem);margin:.3em 0}h2{margin-top:28px}a{color:#7dd3fc}ul{padding-left:1.2rem}li{margin:.3em 0}.kpi{color:#86efac;font-weight:800}.nav{display:flex;gap:16px;margin-top:6px;flex-wrap:wrap}.meta{color:#a9b3c9}</style>
</head><body><main>
<div class="eyebrow">AI Revenue Experiment</div>
<h1>日報一覧 / Daily Reports</h1>
<p class="meta">公式検証期間: 2026-09-01 〜 2026-09-30（Asia/Tokyo）. 公式累計収益: <span class="kpi">${yen(m.official_revenue_jpy_equivalent||0)}</span> ／ 準備期間収益(分離): ${yen(m.preparation_revenue_jpy_equivalent||0)}</p>
<div class="nav"><a href="../">← Experiment status</a><a href="../store/">Store</a></div>
<h2>公式日報 / Official (Sep)</h2>
<ul>${official.length?official.map(row).join(''):'<li class="meta">9月1日に開始します。</li>'}</ul>
<h2>準備期間ログ / Preparation log</h2>
<ul>${prep.length?prep.map(row).join(''):'<li class="meta">—</li>'}</ul>
</main></body></html>`;
  writeFileSync(join(dir,'index.html'), html);
  console.log('regenerated reports/index.html');
}

main();
