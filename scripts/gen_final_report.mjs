#!/usr/bin/env node
/**
 * Final 30-day report generator (Sep 30). Pure Node.
 * Computes metrics from status/revenue_ledger.json + reports/manifest.json,
 * and renders narrative sections from reports/data/final.json (written by the
 * loop). Output: reports/FINAL.html
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

const read = (p, f) => { try { return JSON.parse(readFileSync(p,'utf8')); } catch { return f; } };
const yen = n => '¥' + Number(n||0).toLocaleString('en-US');
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const list = v => Array.isArray(v)&&v.length ? '<ul>'+v.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>' : (v?esc(v):'<span class="muted">—</span>');

const ledger = read('status/revenue_ledger.json', { official_entries:[], preparation_entries:[] });
const costLedger = read('status/cost_ledger.json', { official_entries:[], preparation_entries:[] });
const n = read('reports/data/final.json', {});
const official = (ledger.official_entries||[]).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
const prep = (ledger.preparation_entries||[]).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
const sales = (ledger.official_entries||[]).length;
const officialCost = (costLedger.official_entries||[]).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
const prepCost = (costLedger.preparation_entries||[]).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
const netOfficial = official - officialCost;
const costByCat = {};
for (const e of (costLedger.official_entries||[])) costByCat[e.category] = (costByCat[e.category]||0) + Number(e.jpy_equivalent||0);
const costLines = Object.entries(costByCat).map(([k,v]) => `${k}: ${yen(v)}`);
const status = read('status/CURRENT_STATUS.json', {});
const humanMin = status.human_labor_minutes_total ?? n.human_minutes_total ?? 0;
const target = (ledger.totals && ledger.totals.official_kpi_target_jpy_equivalent) || 50000;
const pct = Math.round((official/target)*100);

const html = `<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Revenue Experiment — Final Report (Sep 2026)</title>
<style>
body{margin:0;background:linear-gradient(180deg,#0b1020,#0f172a);color:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7}
main{max-width:900px;margin:0 auto;padding:44px 20px 80px}.eyebrow{color:#7dd3fc;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.82rem}
h1{font-size:clamp(2rem,5vw,3.6rem);margin:.3em 0}h2{font-size:1.25rem;margin:0 0 10px}.muted{color:#a9b3c9}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-top:20px}
.card{background:rgba(19,26,43,.9);border:1px solid #26314b;border-radius:16px;padding:20px}
.label{font-size:.74rem;color:#a9b3c9;text-transform:uppercase;letter-spacing:.08em}.value{font-size:1.5rem;font-weight:800;margin-top:4px}.value.kpi{color:#86efac}
section{margin-top:28px}a{color:#7dd3fc}ul{padding-left:1.2rem}li{margin:.25em 0}.bar{height:12px;background:#1b2740;border-radius:999px;overflow:hidden;margin-top:10px}.bar>i{display:block;height:100%;background:linear-gradient(90deg,#3ea6a0,#5b8def);width:${Math.min(100,pct)}%}
</style></head><body><main>
<a href="./">← All reports</a>
<div class="eyebrow">AI Revenue Experiment · Final Report</div>
<h1>30日間の結果 / Final Report</h1>
<p class="muted">正式検証期間 2026-09-01 〜 2026-09-30（Asia/Tokyo）。AI自身が戦略・実行・改善を行った30日間の記録。</p>
<div class="grid">
  <div class="card"><div class="label">Official revenue (30d)</div><div class="value kpi">${yen(official)}</div><div class="bar"><i></i></div><div class="muted" style="font-size:.85rem;margin-top:6px">${pct}% of ${yen(target)} target</div></div>
  <div class="card"><div class="label">Verified sales</div><div class="value">${sales}</div></div>
  <div class="card"><div class="label">Preparation revenue (separate)</div><div class="value">${yen(prep)}</div></div>
  <div class="card"><div class="label">Human labor</div><div class="value">${humanMin} min</div></div>
</div>
<section><h2>効いた戦略 / What worked</h2><div class="card">${list(n.worked)}</div></section>
<section><h2>効かなかった戦略 / What failed</h2><div class="card">${list(n.failed)}</div></section>
<section><h2>収益レーン別の結果 / Results by lane</h2><div class="card">${list(n.lanes)}</div></section>
<section><h2>Agent / Skill / Capability の変遷</h2><div class="card">${list(n.capabilities)}</div></section>
<section><h2>能力追加（API / Connector / OAuth）</h2><div class="card">${list(n.grants)}</div></section>
<section><h2>収支 / Net Profit</h2><div class="card">
  <div>Gross official revenue: <b>${yen(official)}</b></div>
  <div class="muted">− Experiment cost (official): ${yen(officialCost)}${costLines.length ? ' ('+costLines.join(', ')+')' : ''}</div>
  <div style="margin-top:8px;font-size:1.3rem;font-weight:800;color:${netOfficial>=0?'#86efac':'#fca5a5'}">= Net: ${yen(netOfficial)}</div>
  <div class="muted" style="margin-top:8px">Preparation-period cost (excluded from official Net): ${yen(prepCost)}. ${n.net ? esc(n.net) : ''}</div>
</div></section>
<section><h2>30日間で得た学習 / Learnings</h2><div class="card">${list(n.learnings)}</div></section>
<section><h2>結論 / Verdict</h2><div class="card">${n.verdict ? esc(n.verdict) : '<span class="muted">—</span>'}</div></section>
<p style="margin-top:30px"><a href="../">Experiment status</a> · <a href="../store/">Store</a> · <a href="./">Daily reports</a></p>
</main></body></html>`;

writeFileSync('reports/FINAL.html', html);
console.log('wrote reports/FINAL.html  official=' + official + ' prep=' + prep + ' sales=' + sales);
