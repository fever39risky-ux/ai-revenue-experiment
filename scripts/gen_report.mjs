#!/usr/bin/env node
/**
 * Bilingual daily report generator for the AI Revenue Experiment.
 * Pure Node (no deps), suitable for local runs and GitHub Actions.
 *
 * reports/data/<date>.json may provide either legacy fields (actions, decisions...)
 * or bilingual fields (actions_ja/actions_en, focus_ja/focus_en, etc.).
 * Missing language fields gracefully fall back to the legacy field.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
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
function yen(n){return '¥'+Number(n||0).toLocaleString('en-US');}
function pick(data,key,lang){return data[`${key}_${lang}`] ?? data[key];}
function field(v,emptyText='—'){
  if(v==null||(Array.isArray(v)&&v.length===0)||v==='')return `<span class="meta">${emptyText}</span>`;
  if(Array.isArray(v))return '<ul>'+v.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>';
  return esc(v).replace(/\n/g,'<br>');
}
function lanes(v,lang){
  v=v||{};
  const started=v[`started_${lang}`]??v.started??[];
  const stopped=v[`stopped_${lang}`]??v.stopped??[];
  const sl=lang==='ja'?'開始':'Started', tl=lang==='ja'?'停止':'Stopped';
  const a=started.length?`<b>${sl}:</b><ul>`+started.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':'';
  const b=stopped.length?`<b>${tl}:</b><ul>`+stopped.map(x=>`<li>${esc(x)}</li>`).join('')+'</ul>':'';
  return (a+b)||`<span class="meta">${lang==='ja'?'変更なし':'No lane changes'}</span>`;
}
function winsFails(data,lang){
  const direct=pick(data,'wins_failures',lang); if(direct)return field(direct);
  const wins=pick(data,'wins',lang)||[], failures=pick(data,'failures',lang)||[], surprises=pick(data,'surprises',lang)||[];
  return field([...wins.map(x=>'✓ '+x),...failures.map(x=>'✗ '+x),...surprises.map(x=>'? '+x)]);
}
function computeRevenue(ledger,date){
  const off=ledger.official_entries||[],prep=ledger.preparation_entries||[];
  const officialCumulative=off.filter(e=>e.date<=date).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  const dayEntries=(isOfficial(date)?off:prep).filter(e=>e.date===date);
  const daily=dayEntries.reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  const prepTotal=prep.reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);
  return {officialCumulative,daily,prepTotal};
}

function main(){
  const date=process.argv[2]||tokyoToday(),official=isOfficial(date);
  const data=readJSON(join(ROOT,'reports/data',date+'.json'),{});
  const status=readJSON(join(ROOT,'status/CURRENT_STATUS.json'),{});
  const ledger=readJSON(join(ROOT,'status/revenue_ledger.json'),{official_entries:[],preparation_entries:[]});
  const rev=computeRevenue(ledger,date),day=official?dayNumber(date):null;
  const headline=official?`Day ${day}`:'Preparation / 準備期間';
  const outName=official?`${date}.html`:`prep-${date}.html`,periodClass=official?'official':'prep';
  const prepRange=data.prep_range||'2026-08-26〜2026-08-31';
  const periodBannerJa=official?`正式検証期間 Day ${day}/30 — この期間の第三者収益のみが公式KPIに計上されます。`:`準備期間（${prepRange}）— ここでの収益は準備期間収益として記録し、9/1開始の公式30日間とは分離します。`;
  const periodBannerEn=official?`Official experiment Day ${day}/30 — only third-party revenue earned in this period counts toward the official KPI.`:`Preparation period (${prepRange}) — revenue here is logged separately and does not count toward the official 30-day experiment starting Sep 1.`;
  const revenueNoteJa=official?`公式累計 = 9/1以降の第三者収益のみ。準備期間収益（${yen(rev.prepTotal)}）は含みません。`:`準備期間収益（分離計上）: ${yen(rev.prepTotal)}。公式KPIは9/1に¥0から開始します。`;
  const revenueNoteEn=official?`Official cumulative revenue includes only third-party revenue earned from Sep 1 onward. Preparation revenue (${yen(rev.prepTotal)}) is excluded.`:`Preparation revenue (separate): ${yen(rev.prepTotal)}. The official KPI resets to ¥0 on Sep 1.`;
  const focusJa=pick(data,'focus','ja')||status.current_focus||'—', focusEn=pick(data,'focus','en')||status.current_focus||'—';

  const tpl=readFileSync(join(ROOT,'reports/TEMPLATE.html'),'utf8');
  const html=tpl
    .replaceAll('{{TITLE}}',official?`Day ${day} (${date})`:`Preparation ${date}`)
    .replaceAll('{{META_DESC}}',`AI Revenue Experiment ${official?'Day '+day:'preparation'} report for ${date}.`)
    .replaceAll('{{PERIOD_CLASS}}',periodClass).replaceAll('{{PERIOD_BANNER_JA}}',periodBannerJa).replaceAll('{{PERIOD_BANNER_EN}}',periodBannerEn)
    .replaceAll('{{HEADLINE}}',headline).replaceAll('{{DATE}}',date)
    .replaceAll('{{OFFICIAL_CUMULATIVE}}',yen(rev.officialCumulative)).replaceAll('{{DAILY_REVENUE}}',yen(rev.daily)).replaceAll('{{HUMAN_MINUTES}}',String(data.human_minutes_today??0))
    .replaceAll('{{FOCUS_JA}}',esc(focusJa)).replaceAll('{{FOCUS_EN}}',esc(focusEn))
    .replaceAll('{{REVENUE_NOTE_JA}}',revenueNoteJa).replaceAll('{{REVENUE_NOTE_EN}}',revenueNoteEn)
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
  updateManifest(ROOT,ledger);regenIndex(ROOT);
}

function updateManifest(ROOT,ledger){
  const p=join(ROOT,'reports/manifest.json');const m=readJSON(p,{official_start:OFFICIAL_START,official_end:OFFICIAL_END,latest_report:null,reports:[]});
  const dir=join(ROOT,'reports'),files=readdirSync(dir).filter(f=>/^2026-09-\d{2}\.html$/.test(f)).sort(),off=ledger.official_entries||[];let cumulative=0;
  const reports=files.map(f=>{const date=f.replace('.html',''),day=dayNumber(date),daily=off.filter(e=>e.date===date).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);cumulative+=daily;const data=readJSON(join(ROOT,'reports/data',date+'.json'),{});return{day,date,path:'reports/'+f,summary:data.summary||data.summary_en||data.focus||'',summary_ja:data.summary_ja||data.summary||data.focus_ja||data.focus||'',summary_en:data.summary_en||data.summary||data.focus_en||data.focus||'',daily_revenue_jpy_equivalent:daily,cumulative_revenue_jpy_equivalent:cumulative};});
  m.official_start=OFFICIAL_START;m.official_end=OFFICIAL_END;m.reports=reports;m.latest_report=reports.length?reports.at(-1).path:null;m.preparation_revenue_jpy_equivalent=(ledger.preparation_entries||[]).reduce((s,e)=>s+Number(e.jpy_equivalent||0),0);m.official_revenue_jpy_equivalent=cumulative;writeFileSync(p,JSON.stringify(m,null,2)+'\n');
}

function regenIndex(ROOT){
  const dir=join(ROOT,'reports'),official=readdirSync(dir).filter(f=>/^2026-09-\d{2}\.html$/.test(f)).sort(),prep=readdirSync(dir).filter(f=>/^prep-\d{4}-\d{2}-\d{2}\.html$/.test(f)).sort(),m=readJSON(join(dir,'manifest.json'),{reports:[]});
  const row=f=>{const date=f.replace(/^prep-/,'').replace('.html',''),rec=(m.reports||[]).find(r=>r.path==='reports/'+f),label=f.startsWith('prep-')?`Prep ${date}`:`Day ${rec?rec.day:'?'} — ${date}`,rev=rec?` · ${yen(rec.daily_revenue_jpy_equivalent)}`:'';return `<li><a href="./${f}">${label}</a>${rev}</li>`;};
  const html=`<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Revenue Experiment — Daily Reports / 日報</title><style>body{margin:0;background:linear-gradient(180deg,#0b1020,#0f172a);color:#eef2ff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.7}main{max-width:820px;margin:0 auto;padding:28px 20px 72px}.top{display:flex;justify-content:space-between;align-items:center;gap:12px}.langs{display:flex;gap:7px}.langbtn{border:1px solid #26314b;background:#131a2b;color:#a9b3c9;border-radius:999px;padding:6px 10px;cursor:pointer}.langbtn.active{background:#7dd3fc;color:#08111f}.eyebrow{color:#7dd3fc;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:.82rem}h1{font-size:clamp(1.8rem,5vw,3rem);margin:.3em 0}h2{margin-top:28px}a{color:#7dd3fc}ul{padding-left:1.2rem}li{margin:.3em 0}.kpi{color:#86efac;font-weight:800}.nav{display:flex;gap:16px;margin-top:6px;flex-wrap:wrap}.meta{color:#a9b3c9}</style><script src="../assets/i18n.js" defer></script></head><body><main><div class="top"><div class="eyebrow">AI Revenue Experiment</div><div class="langs"><button class="langbtn" data-lang-btn="ja">日本語</button><button class="langbtn" data-lang-btn="en">English</button></div></div><h1 data-ja="日報一覧" data-en="Daily Reports">日報一覧</h1><p class="meta"><span data-ja="公式検証期間: 2026-09-01〜2026-09-30（Asia/Tokyo）／公式累計収益: " data-en="Official experiment: Sep 1–30, 2026 (Asia/Tokyo) / Official cumulative revenue: ">公式検証期間: 2026-09-01〜2026-09-30（Asia/Tokyo）／公式累計収益: </span><span class="kpi">${yen(m.official_revenue_jpy_equivalent||0)}</span> · <span data-ja="準備期間収益: ${yen(m.preparation_revenue_jpy_equivalent||0)}" data-en="Preparation revenue: ${yen(m.preparation_revenue_jpy_equivalent||0)}">準備期間収益: ${yen(m.preparation_revenue_jpy_equivalent||0)}</span></p><div class="nav"><a href="../" data-ja="← 実験トップ" data-en="← Experiment status">← 実験トップ</a><a href="../store/">Store</a></div><h2 data-ja="公式日報（9月）" data-en="Official reports (September)">公式日報（9月）</h2><ul>${official.length?official.map(row).join(''):'<li class="meta"><span data-ja="9月1日に開始します。" data-en="Starts September 1.">9月1日に開始します。</span></li>'}</ul><h2 data-ja="準備期間ログ" data-en="Preparation logs">準備期間ログ</h2><ul>${prep.length?prep.map(row).join(''):'<li class="meta">—</li>'}</ul></main></body></html>`;
  writeFileSync(join(dir,'index.html'),html);
}
main();
