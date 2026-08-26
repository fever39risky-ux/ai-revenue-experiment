#!/usr/bin/env node
/**
 * Bilingual daily report generator for the AI Revenue Experiment.
 * Revenue + cost + net profit + adaptive AI cadence are rendered from public ledgers.
 */
import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OFFICIAL_START = '2026-09-01';
const OFFICIAL_END = '2026-09-30';

function tokyoToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo'}).format(new Date());}
function readJSON(p,fallback){try{return JSON.parse(readFileSync(p,'utf8'));}catch{return fallback;}}
function dayNumber(date){const d=new Date(date+'T00:00:00+09:00'),s=new Date(OFFICIAL_START+'T00:00:00+09:00');return Math.floor((d-s)/86400000)+1;}
function isOfficial(date){return date>=OFFICIAL_START&&date<=OFFICIAL_END;}
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function yen(n){const v=Number(n||0);return (v<0?'-¥':'¥')+Math.abs(v).toLocaleString('en-US');}
function pick(data,key,lang){return data[`${key}_${lang}`] ?? data[key];}
function field(v,emptyText='—'){
  if(v==null||(Array.isArray(v)&&v.length===0)||v==='')return `<span class="meta">${emptyText}</span>`;
  if(Array.isArray(v))return '<ul>'+v.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>';
  return esc(v).replace(/\n/g,'<br>');
}
function lanes(v,lang){
  v=v||{};const started=v[`started_${lang}`]??v.started??[],stopped=v[`stopped_${lang}`]??v.stopped??[];
  const sl=lang==='ja'?'開始':'Started',tl=lang==='ja'?'停止':'Stopped';
  const a=started.length?`<b>${sl}:</b><ul>`+started.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':'';
  const b=stopped.length?`<b>${tl}:</b><ul>`+stopped.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':'';
  return(a+b)||`<span class="meta">${lang==='ja'?'変更なし':'No lane changes'}</span>`;
}
function winsFails(data,lang){
  const direct=pick(data,'wins_failures',lang);if(direct)return field(direct);
  const wins=pick(data,'wins',lang)||[],failures=pick(data,'failures',lang)||[],surprises=pick(data,'surprises',lang)||[];
  return field([...wins.map(x=>'✓ '+x),...failures.map(x=>'✗ '+x),...surprises.map(x=>'? '+x)]);
}
function computeRevenue(ledger,date){
  const off=ledger.official_entries||[],prep=ledger.preparation_entries||[];
  const officialCumulative=off.filter(e=>e.date<=date).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  const daily=(isOfficial(date)?off:prep).filter(e=>e.date===date).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  const prepTotal=prep.reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  return{officialCumulative,daily,prepTotal};
}
function computeCost(ledger,date){
  const off=ledger.official_entries||[],prep=ledger.preparation_entries||[];
  const officialCumulative=off.filter(e=>e.date<=date).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  const daily=(isOfficial(date)?off:prep).filter(e=>e.date===date).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  const prepTotal=prep.reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  return{officialCumulative,daily,prepTotal};
}

function main(){
  const date=process.argv[2]||tokyoToday(),official=isOfficial(date);
  const data=readJSON(join(ROOT,'reports/data',date+'.json'),{});
  const status=readJSON(join(ROOT,'status/CURRENT_STATUS.json'),{});
  const revenueLedger=readJSON(join(ROOT,'status/revenue_ledger.json'),{official_entries:[],preparation_entries:[]});
  const costLedger=readJSON(join(ROOT,'status/cost_ledger.json'),{official_entries:[],preparation_entries:[],totals:{}});
  const cadence=readJSON(join(ROOT,'status/cadence.json'),{});
  const rev=computeRevenue(revenueLedger,date),cost=computeCost(costLedger,date),day=official?dayNumber(date):null;
  const net=rev.officialCumulative-cost.officialCumulative;
  const headline=official?`Day ${day}`:'Preparation';
  const outName=official?`${date}.html`:`prep-${date}.html`,periodClass=official?'official':'prep';
  const prepRange=data.prep_range||'2026-08-26〜2026-08-31';
  const periodBannerJa=official?`正式検証 Day ${day}/30 — 9/1以降の第三者収益・コストだけを公式KPIとして評価。`:`準備期間 ${prepRange} — この期間の収益・コストは公式30日間とは分離して記録。`;
  const periodBannerEn=official?`Official Day ${day}/30 — only third-party revenue and experiment costs from Sep 1 onward count toward the official result.`:`Preparation ${prepRange} — revenue and costs in this period remain separate from the official 30-day result.`;
  const focusJa=pick(data,'focus','ja')||status.current_focus_ja||status.current_focus||'—';
  const focusEn=pick(data,'focus','en')||status.current_focus_en||status.current_focus||'—';
  const cadenceLabel=cadence.current_cadence||'—';
  const econNoteJa=official
    ? `当日収益 ${yen(rev.daily)} / 当日コスト ${yen(cost.daily)}。Net Profit = Gross Revenue − AI・API・販売手数料等。起動頻度は固定せず、費用対効果からAI自身が再評価します。`
    : `準備期間累計: 収益 ${yen(rev.prepTotal)} / コスト ${yen(cost.prepTotal)}。準備期間は公式Net Profitに含めません。起動頻度は現在 ${cadenceLabel}。`;
  const econNoteEn=official
    ? `Today: revenue ${yen(rev.daily)} / cost ${yen(cost.daily)}. Net Profit = Gross Revenue − AI, API, platform and other experiment costs. Cadence remains adaptive and is re-evaluated by the AI.`
    : `Preparation cumulative: revenue ${yen(rev.prepTotal)} / cost ${yen(cost.prepTotal)}. Preparation is excluded from official Net Profit. Current cadence: ${cadenceLabel}.`;

  const tpl=readFileSync(join(ROOT,'reports/TEMPLATE.html'),'utf8');
  const html=tpl
    .replaceAll('{{TITLE}}',official?`Day ${day} (${date})`:`Preparation ${date}`)
    .replaceAll('{{META_DESC}}',`AI Revenue Experiment ${official?'Day '+day:'preparation'} research log for ${date}.`)
    .replaceAll('{{PERIOD_CLASS}}',periodClass).replaceAll('{{PERIOD_BANNER_JA}}',periodBannerJa).replaceAll('{{PERIOD_BANNER_EN}}',periodBannerEn)
    .replaceAll('{{HEADLINE}}',headline).replaceAll('{{DATE}}',date)
    .replaceAll('{{OFFICIAL_CUMULATIVE}}',yen(rev.officialCumulative))
    .replaceAll('{{OFFICIAL_COST}}',yen(cost.officialCumulative))
    .replaceAll('{{OFFICIAL_NET}}',yen(net))
    .replaceAll('{{NET_CLASS}}',net>=0?'good':'warn')
    .replaceAll('{{CADENCE}}',esc(cadenceLabel))
    .replaceAll('{{ECON_NOTE_JA}}',esc(econNoteJa)).replaceAll('{{ECON_NOTE_EN}}',esc(econNoteEn))
    .replaceAll('{{FOCUS_JA}}',field(focusJa)).replaceAll('{{FOCUS_EN}}',field(focusEn))
    .replaceAll('{{ACTIONS_JA}}',field(pick(data,'actions','ja'))).replaceAll('{{ACTIONS_EN}}',field(pick(data,'actions','en')))
    .replaceAll('{{DECISIONS_JA}}',field(pick(data,'decisions','ja'))).replaceAll('{{DECISIONS_EN}}',field(pick(data,'decisions','en')))
    .replaceAll('{{STRATEGY_JA}}',field(pick(data,'strategy','ja'))).replaceAll('{{STRATEGY_EN}}',field(pick(data,'strategy','en')))
    .replaceAll('{{LANES_JA}}',lanes(data.lanes,'ja')).replaceAll('{{LANES_EN}}',lanes(data.lanes,'en'))
    .replaceAll('{{OBSERVED_JA}}',field(pick(data,'observed','ja'),'本日の外部実データなし')).replaceAll('{{OBSERVED_EN}}',field(pick(data,'observed','en'),'No external data yet'))
    .replaceAll('{{WINS_FAILS_JA}}',winsFails(data,'ja')).replaceAll('{{WINS_FAILS_EN}}',winsFails(data,'en'))
    .replaceAll('{{LEARNINGS_JA}}',field(pick(data,'learnings','ja'))).replaceAll('{{LEARNINGS_EN}}',field(pick(data,'learnings','en')))
    .replaceAll('{{CAPABILITIES_JA}}',field(pick(data,'capabilities','ja'))).replaceAll('{{CAPABILITIES_EN}}',field(pick(data,'capabilities','en')))
    .replaceAll('{{SOCIAL_JA}}',field(pick(data,'social','ja'))).replaceAll('{{SOCIAL_EN}}',field(pick(data,'social','en')))
    .replaceAll('{{NEXT_JA}}',field(pick(data,'next','ja'))).replaceAll('{{NEXT_EN}}',field(pick(data,'next','en')));

  writeFileSync(join(ROOT,'reports',outName),html);console.log('wrote reports/'+outName);
  updateManifest(ROOT,revenueLedger,costLedger);regenIndex(ROOT);
}

function updateManifest(ROOT,revenueLedger,costLedger){
  const p=join(ROOT,'reports/manifest.json');const m=readJSON(p,{official_start:OFFICIAL_START,official_end:OFFICIAL_END,latest_report:null,reports:[]});
  const dir=join(ROOT,'reports'),files=readdirSync(dir).filter(f=>/^2026-09-\d{2}\.html$/.test(f)).sort(),offRev=revenueLedger.official_entries||[],offCost=costLedger.official_entries||[];let cumulativeRev=0,cumulativeCost=0;
  const reports=files.map(f=>{const date=f.replace('.html',''),day=dayNumber(date);const dailyRev=offRev.filter(e=>e.date===date).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);const dailyCost=offCost.filter(e=>e.date===date).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);cumulativeRev+=dailyRev;cumulativeCost+=dailyCost;const data=readJSON(join(ROOT,'reports/data',date+'.json'),{});return{day,date,path:'reports/'+f,summary:data.summary||data.summary_en||data.focus||'',summary_ja:data.summary_ja||data.summary||data.focus_ja||data.focus||'',summary_en:data.summary_en||data.summary||data.focus_en||data.focus||'',daily_revenue_jpy_equivalent:dailyRev,daily_cost_jpy_equivalent:dailyCost,cumulative_revenue_jpy_equivalent:cumulativeRev,cumulative_cost_jpy_equivalent:cumulativeCost,cumulative_net_profit_jpy_equivalent:cumulativeRev-cumulativeCost};});
  m.official_start=OFFICIAL_START;m.official_end=OFFICIAL_END;m.reports=reports;m.latest_report=reports.length?reports.at(-1).path:null;m.preparation_revenue_jpy_equivalent=(revenueLedger.preparation_entries||[]).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);m.preparation_cost_jpy_equivalent=(costLedger.preparation_entries||[]).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);m.official_revenue_jpy_equivalent=cumulativeRev;m.official_cost_jpy_equivalent=cumulativeCost;m.official_net_profit_jpy_equivalent=cumulativeRev-cumulativeCost;writeFileSync(p,JSON.stringify(m,null,2)+'\n');
}

function regenIndex(ROOT){
  const dir=join(ROOT,'reports'),official=readdirSync(dir).filter(f=>/^2026-09-\d{2}\.html$/.test(f)).sort(),prep=readdirSync(dir).filter(f=>/^prep-\d{4}-\d{2}-\d{2}\.html$/.test(f)).sort(),m=readJSON(join(dir,'manifest.json'),{reports:[]});
  const row=f=>{const date=f.replace(/^prep-/,'').replace('.html',''),rec=(m.reports||[]).find(r=>r.path==='reports/'+f),label=f.startsWith('prep-')?`PREP / ${date}`:`DAY ${String(rec?rec.day:'?').padStart(2,'0')} / ${date}`,net=rec?`<span class="net">${yen(rec.cumulative_net_profit_jpy_equivalent)}</span>`:'';return `<li><a href="./${f}"><span>${label}</span>${net}</a></li>`;};
  const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Revenue Experiment — Research Log</title><style>:root{--bg:#070a0e;--ink:#f3f6f8;--muted:#8e9aa4;--line:#202a32;--cyan:#67e8f9;--mint:#77f2b4;--mono:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono",monospace;--sans:Inter,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#070a0e,#090d12);color:var(--ink);font-family:var(--sans);min-height:100vh}main{max-width:920px;margin:auto;padding:20px 24px 80px}.top{height:58px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--line)}.brand{font:700 12px var(--mono);letter-spacing:.11em;text-decoration:none}.langs{display:flex;gap:5px}.langbtn{border:1px solid var(--line);background:transparent;color:var(--muted);font:11px var(--mono);padding:5px 8px;cursor:pointer}.langbtn.active{color:var(--cyan);border-color:var(--cyan)}.head{padding:56px 0 40px;border-bottom:1px solid var(--line)}.lab{font:11px var(--mono);color:var(--cyan);letter-spacing:.13em}h1{font-size:clamp(44px,8vw,74px);letter-spacing:-.055em;margin:12px 0}.meta{color:var(--muted);max-width:720px}.stats{display:flex;gap:28px;flex-wrap:wrap;font:11px var(--mono);color:var(--muted);margin-top:24px}.stats b{color:var(--ink);font-weight:500}.group{padding:38px 0;border-bottom:1px solid var(--line)}h2{font:11px var(--mono);letter-spacing:.13em;color:var(--cyan);font-weight:500}ul{list-style:none;padding:0;margin:18px 0 0}li{border-top:1px solid var(--line)}li a{display:flex;justify-content:space-between;gap:18px;padding:17px 0;text-decoration:none;font:13px var(--mono)}li a:hover{color:var(--cyan)}.net{color:var(--mint)}.nav{display:flex;gap:18px;margin-top:26px;font:11px var(--mono);color:var(--muted)}.nav a:hover{color:var(--cyan)}</style><script src="../assets/i18n.js" defer></script></head><body><main><header class="top"><a class="brand" href="../">AI REVENUE EXPERIMENT</a><div class="langs"><button class="langbtn" data-lang-btn="ja">JA</button><button class="langbtn" data-lang-btn="en">EN</button></div></header><section class="head"><div class="lab">PUBLIC RESEARCH LOG / 2026</div><h1 data-ja="観測記録。" data-en="Observation log.">観測記録。</h1><p class="meta" data-ja="売上だけではなく、判断、失敗、撤退、AI自身の稼働コストまで、30日間の変化を時系列で残します。" data-en="A chronological record of revenue, decisions, failures, abandoned paths, and the AI's own operating cost across the 30-day experiment.">売上だけではなく、判断、失敗、撤退、AI自身の稼働コストまで記録します。</p><div class="stats"><span>GROSS <b>${yen(m.official_revenue_jpy_equivalent||0)}</b></span><span>COST <b>${yen(m.official_cost_jpy_equivalent||0)}</b></span><span>NET <b>${yen(m.official_net_profit_jpy_equivalent||0)}</b></span></div><nav class="nav"><a href="../">EXPERIMENT</a><a href="../experiment/protocol.html">PROTOCOL</a><a href="../store/">STORE</a></nav></section><section class="group"><h2>OFFICIAL / SEP 01—30</h2><ul>${official.length?official.map(row).join(''):'<li><span class="meta" data-ja="9月1日に開始します。" data-en="Begins September 1.">9月1日に開始します。</span></li>'}</ul></section><section class="group"><h2>PREPARATION / AUG 26—31</h2><ul>${prep.length?prep.map(row).join(''):'<li><span class="meta">—</span></li>'}</ul></section></main></body></html>`;
  writeFileSync(join(dir,'index.html'),html);
}
main();
