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
  if (obj.review) p.push(...checkReview(obj));
  return p;
}
// 10/18 falsification checkpoint (ops/2026-10/CHECKPOINT_1018.md)
export const CHECKPOINT_OPTIONS = ['buyer_segment', 'offer', 'price', 'job_selection', 'channel', 'other_sales_motion'];
// WHO / PAIN granularity (owner rule 2026-10-18): a customer you could find 10 of, and the pain as the work they do.
export const WHO_FIELDS = ['industry', 'role', 'company_size', 'task', 'frequency', 'current_method', 'pain_moment'];
const BROAD = /^(中小企業|中小事業者|小規模事業者|小規模企業|スモールビジネス|フリーランス|個人事業主|個人|企業|事業者|会社|ビジネスパーソン|経営者|sme|smb|small business(es)?|freelancers?|businesses)$/i;
const ABSTRACT_PAIN = /効率化したい|効率化|AIを使いたい|AI(を)?活用したい|DXしたい|DX化|業務改善したい|生産性(を)?上げたい|時間がない|手間がかかる|面倒/;
export function checkWhoPain(h, where) {
  const p = [], w = h?.who;
  if (!w || typeof w !== 'object' || Array.isArray(w)) return [`${where}.who must be an object with ${WHO_FIELDS.join(', ')} (a broad label like 「中小企業」「フリーランス」「個人事業主」 fails)`];
  for (const f of WHO_FIELDS) if (!String(w[f] ?? '').trim()) p.push(`${where}.who.${f} empty`);
  if (BROAD.test(String(w.industry ?? '').trim())) p.push(`${where}.who.industry "${w.industry}" is a broad attribute, not an industry`);
  if (w.company_size && !/\d/.test(String(w.company_size))) p.push(`${where}.who.company_size needs a number (e.g. 従業員1〜10名)`);
  if (w.frequency && !/\d|毎日|毎週|毎月|毎回|日次|週次|月次|隔週|発送日/.test(String(w.frequency))) p.push(`${where}.who.frequency must state how often (毎週/月次/1日N件 …)`);
  const pain = String(h?.pain ?? '');
  if (!/\d/.test(pain) || !/(分|時間|件|行|枚|本|回|個|ファイル|列|CSV|名|人|日|週|月)/.test(pain)) p.push(`${where}.pain must describe the actual work with numbers (e.g. 毎週2時間かけて3つのCSVを1つの表にまとめている)`);
  if (ABSTRACT_PAIN.test(pain) && !/\d/.test(pain)) p.push(`${where}.pain uses abstract wording (効率化/AIを使いたい …) — describe the task the customer actually does`);
  return p;
}
export const ACQ_FIELDS = ['id', 'who', 'pain', 'trigger', 'offer', 'why_now', 'trust', 'where', 'how_to_reach', 'first_conversion', 'repeatability', 'steps_to_first_close', 'first_market_test', 'signal_48h', 'channel'];
export function checkCheckpoint(c, taskExists = () => true) {
  const p = [];
  if (!c || typeof c !== 'object') return ['checkpoint_1018 block missing (ops/2026-10/CHECKPOINT_1018.md)'];
  if (typeof c.replies_observed !== 'number') p.push('checkpoint_1018.replies_observed must be a number');
  const o = c.options || {};
  for (const k of CHECKPOINT_OPTIONS) {
    if (!o[k]) { p.push(`checkpoint_1018.options.${k} missing`); continue; }
    for (const f of ['option', 'expected_effect', 'cost', 'evidence']) if (!String(o[k][f] ?? '').trim()) p.push(`checkpoint_1018.options.${k}.${f} empty`);
  }
  const chosen = [].concat(c.chosen || []);
  if (!chosen.length || !chosen.every(k => CHECKPOINT_OPTIONS.includes(k))) p.push('checkpoint_1018.chosen must list option keys');
  if (!String(c.why ?? '').trim()) p.push('checkpoint_1018.why empty');
  if (c.replies_observed === 0) {
    if (!['L4', 'L5'].includes(c.level)) p.push('replies 0 → checkpoint_1018.level must be L4 or L5');
    if (c.verdict !== 'redesign') p.push('replies 0 → checkpoint_1018.verdict must be "redesign"');
    if (/提案数が少な|件数が少な|母数が少な|under-?volume|low volume|too few proposals|not enough (data|volume)/i.test(JSON.stringify({ v: c.verdict, why: c.why })))
      p.push('replies 0 → "continue because proposals are few" is forbidden (CHECKPOINT_1018.md)');
  }
  // customer acquisition first (owner rule 2026-10-17): >=3 distinct hypotheses, WHO/PAIN/OFFER/TRUST/REACH before channel
  const H = [].concat(c.acquisition_hypotheses || []);
  if (H.length < 3) p.push('checkpoint_1018.acquisition_hypotheses needs >= 3 different customer-acquisition hypotheses');
  for (const [i, h] of H.entries()) {
    for (const f of ACQ_FIELDS) if (!String(h?.[f] ? JSON.stringify(h[f]) : '').trim()) p.push(`checkpoint_1018.acquisition_hypotheses[${i}].${f} empty`);
    if (/^\W*(coconala|crowdworks|lancers|x|twitter|ココナラ|クラウドワークス|ランサーズ)\b/i.test(typeof h?.who === 'object' ? String(h.who.industry ?? '') : String(h?.who ?? ''))) p.push(`checkpoint_1018.acquisition_hypotheses[${i}].who is a channel, not a customer — define the customer first`);
  }
  if (c.acquisition_spec_version >= 2) for (const [i, h] of H.entries()) p.push(...checkWhoPain(h, `checkpoint_1018.acquisition_hypotheses[${i}]`));
  if (new Set(H.map(h => JSON.stringify(h?.who ?? ''))).size < H.length) p.push('checkpoint_1018.acquisition_hypotheses: who must differ per hypothesis');
  if (!H.some(h => h?.id === c.chosen_hypothesis)) p.push('checkpoint_1018.chosen_hypothesis must be one of acquisition_hypotheses[].id');
  const ex = c.executed || {};
  const mt = ex.market_test || {};
  for (const f of ['hypothesis', 'action', 'evidence', 'at']) if (!String(mt[f] ?? '').trim()) p.push(`checkpoint_1018.executed.market_test.${f} empty (the chosen hypothesis must hit the market in this fire)`);
  if (c.replies_observed === 0 && ![].concat(ex.stopped_tasks || []).length) p.push('checkpoint_1018.executed.stopped_tasks empty');
  const nt = [].concat(ex.new_tasks || []);
  if (!nt.length) p.push('checkpoint_1018.executed.new_tasks empty');
  for (const t of nt) if (!taskExists(t)) p.push(`checkpoint_1018.executed.new_tasks: no task ${t}`);
  if (!String(ex.reallocation ?? '').trim()) p.push('checkpoint_1018.executed.reallocation empty');
  return p;
}
// Weekly review blocks (ops/2026-10/REVIEW_SPEC.md)
export function checkReview(o) {
  const p = [];
  const g = o.goal_pipeline || {};
  for (const k of ['target', 'required_pipeline', 'current_pipeline', 'gap', 'action']) if (!g[k]) p.push(`goal_pipeline.${k} missing`);
  for (const k of ['increase', 'shrink_stop', 'reallocate']) if (g.action && !String(g.action[k] ?? '').trim()) p.push(`goal_pipeline.action.${k} empty`);
  if (g.required_pipeline && !/ASSUMPTION/.test(JSON.stringify(g.required_pipeline))) p.push('goal_pipeline.required_pipeline must label assumptions (ASSUMPTION)');
  const sc = g.scenarios || {};
  for (const k of ['optimistic', 'base', 'pessimistic']) {
    if (!sc[k]) { p.push(`goal_pipeline.scenarios.${k} missing`); continue; }
    for (const f of ['avg_order_jpy', 'proposal_to_reply', 'reply_to_order', 'proposals_needed', 'proposals_per_day_needed']) if (sc[k][f] == null) p.push(`goal_pipeline.scenarios.${k}.${f} missing`);
  }
  const lc = g.lever_choice || {};
  if (!['volume', 'reply_rate', 'close_rate', 'price'].some(l => String(lc.chosen ?? '').includes(l))) p.push('goal_pipeline.lever_choice.chosen must name volume|reply_rate|close_rate|price');
  for (const k of ['why', 'not_chosen']) if (!String(lc[k] ? JSON.stringify(lc[k]) : '').trim()) p.push(`goal_pipeline.lever_choice.${k} missing`);
  const x = o.x_verdict || {};
  if (!['continue', 'improve', 'shrink', 'stop'].includes(x.sales_channel)) p.push('x_verdict.sales_channel must be continue|improve|shrink|stop');
  if (!String(x.evidence ?? '').trim()) p.push('x_verdict.evidence empty');
  if (!x.other_roles || typeof x.other_roles !== 'object' || !Object.keys(x.other_roles).length) p.push('x_verdict.other_roles missing (trust / experiment_log / ai_news decided separately)');
  if (!String(o.coconala_gap ?? '').trim()) p.push('coconala_gap empty');
  if (!Array.isArray(o.executed) || !o.executed.length) p.push('executed (tasks/stops/reassignments done in this fire) empty');
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
    // a 20:xx report on a weekly review date must be a review
    const m = f.match(/(\d{4}-\d{2}-\d{2})T(\d{2})\d{2}\.json$/);
    let reviews = [];
    try { reviews = JSON.parse(readFileSync('status/2026-10/STATE.json', 'utf8')).reviews || []; } catch {}
    if (m && reviews.includes(m[1]) && m[2] === '20' && m[1] >= '2026-10-08' && !obj.review) p.push('20:xx report on a weekly review date must set "review": true (ops/2026-10/REVIEW_SPEC.md)');
    // the earliest report dated 2026-10-18 must carry the falsification checkpoint
    if (m && m[1] === '2026-10-18') {
      const first = readdirSync(dir).filter(x => x.startsWith('2026-10-18T') && x.endsWith('.json')).sort()[0];
      if (f.endsWith(first) || obj.checkpoint_1018) p.push(...checkCheckpoint(obj.checkpoint_1018, id => existsSync(join('status/2026-10/tasks', `${id}.json`))));
    }
    // WHO/PAIN granularity applies to every acquisition-hypothesis set written from 2026-10-18 12:00 JST
    const stamp = (f.match(/(\d{4}-\d{2}-\d{2}T\d{4})\.json$/) || [])[1] || '';
    const acq = obj.checkpoint_1018_amendment || obj.acquisition || null;
    if (stamp >= '2026-10-18T1200' && (acq || obj.checkpoint_1018)) {
      const blk = acq || obj.checkpoint_1018;
      if (!(blk.acquisition_spec_version >= 2)) p.push('acquisition hypotheses written after 2026-10-18 12:00 must set acquisition_spec_version: 2 (WHO/PAIN granularity)');
      for (const [i, h] of [].concat(blk.acquisition_hypotheses || []).entries()) p.push(...checkWhoPain(h, `acquisition_hypotheses[${i}]`));
      if ([].concat(blk.acquisition_hypotheses || []).length < 3) p.push('acquisition_hypotheses needs >= 3');
      if (!String(blk.chosen_hypothesis ?? '').trim()) p.push('chosen_hypothesis empty');
    }
    console.log(p.length ? `FAIL ${f}: ${p.join('; ')}` : `ok   ${f}`);
    bad += p.length ? 1 : 0;
  }
  // the 10/18 checkpoint ran before the WHO/PAIN rule: a 10/18 report from 12:00 must re-state it at that granularity
  const d18 = existsSync(dir) ? readdirSync(dir).filter(x => /^2026-10-18T\d{4}\.json$/.test(x)) : [];
  if (!process.argv.slice(2).length && d18.length && !d18.some(x => { try { const o = JSON.parse(readFileSync(join(dir, x), 'utf8')); return (o.checkpoint_1018_amendment || o.checkpoint_1018 || {}).acquisition_spec_version >= 2; } catch { return false; } }))
    { console.log('FAIL 2026-10-18: no report re-states the checkpoint WHO/PAIN at acquisition_spec_version 2 (owner rule 2026-10-18)'); bad++; }
  process.exit(bad ? 1 : 0);
}
