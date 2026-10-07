#!/usr/bin/env node
/**
 * Goal back-calculation for the weekly review (ops/2026-10/REVIEW_SPEC.md).
 *   node scripts/oct/g2_pipeline.mjs [--now ISO] [--target 10000] [--deadline 2026-10-20]
 *        [--avg-order N] [--reply-rate 0.05] [--close-rate 0.3] [--fee 0.22] [--json]
 * Observed values come from the repo (events + ledgers). Anything not observed is printed
 * as ASSUMPTION with its source, so the review never presents a guess as data.
 * Also prints optimistic / base / pessimistic scenarios and a lever comparison
 * (volume / reply rate / close rate / price) scored by P(G2 met by the deadline), so the
 * review picks the highest-EV lever instead of defaulting to "send N proposals".
 */
import { readFileSync, readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { ROOT, tokyoDate } from '../lib/periods.mjs';
import { computeKpi } from '../lib/phase2.mjs';

const opt = {};
const a = process.argv.slice(2);
for (let i = 0; i < a.length; i++) if (a[i].startsWith('--')) opt[a[i].slice(2)] = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : 'true';
const now = opt.now ? new Date(opt.now) : new Date();
const target = Number(opt.target || 10000);
const deadline = opt.deadline || '2026-10-20';

// --- observed pipeline (all operators' events) ---
const evDir = join(ROOT, 'status/2026-10/events');
const ev = existsSync(evDir) ? readdirSync(evDir).filter(f => f.endsWith('.jsonl'))
  .flatMap(f => readFileSync(join(evDir, f), 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return {}; } })) : [];
const sig = m => ev.filter(e => e.type === 'signal' && e.metric === m).reduce((s, e) => s + Number(e.count || 1), 0);
const proposals = ev.filter(e => e.type === 'proposal_sent');
const prices = proposals.map(e => Number(e.price)).filter(n => n > 0).sort((x, y) => x - y);
const median = prices.length ? prices[Math.floor((prices.length - 1) / 2)] : null;
const firstTs = proposals.map(e => Date.parse(e.ts)).sort()[0];
const kpi = computeKpi(tokyoDate(now));
const observed = {
  proposals_sent: sig('proposal_sent'),
  replies: sig('sales_conversation'),
  quote_consultations: sig('inquiry'),
  orders: kpi.orders,
  gross_revenue_jpy: kpi.gross_revenue_jpy,
  known_cost_jpy: kpi.cost_known_jpy,
  proposal_prices_jpy: prices,
  proposals_per_day_observed: firstTs ? +(proposals.length / Math.max(1, (now - firstTs) / 86400e3)).toFixed(2) : 0,
};

// --- target ---
const daysLeft = Math.max(0, Math.ceil((Date.parse(deadline + 'T23:59:59+09:00') - now) / 86400e3));
const needGross = Math.max(0, target - observed.gross_revenue_jpy);

// --- assumptions (explicit) ---
const assumptions = {
  avg_order_jpy: opt['avg-order'] ? { value: Number(opt['avg-order']), source: 'ASSUMPTION (--avg-order)' }
    : { value: median || 8000, source: median ? `ASSUMPTION = median of our ${prices.length} proposal prices` : 'ASSUMPTION (no proposals yet)' },
  proposal_to_reply: { value: Number(opt['reply-rate'] || (observed.proposals_sent && observed.replies ? observed.replies / observed.proposals_sent : 0.05)),
    source: observed.replies ? `OBSERVED ${observed.replies}/${observed.proposals_sent}` : `ASSUMPTION ${opt['reply-rate'] || 0.05} (0/${observed.proposals_sent} observed — too few to estimate; new 0-review seller vs 60–118 applicants per request)` },
  reply_to_order: { value: Number(opt['close-rate'] || 0.3), source: `ASSUMPTION ${opt['close-rate'] || 0.3} (no replies observed yet)` },
  platform_fee: { value: Number(opt.fee || 0.22), source: 'Coconala seller fee (22%, booked at completion)' },
};

// --- required pipeline ---
const ordersNeeded = needGross > 0 ? Math.ceil(needGross / assumptions.avg_order_jpy.value) : 0;
const repliesNeeded = Math.ceil(ordersNeeded / assumptions.reply_to_order.value);
const proposalsNeeded = Math.ceil(repliesNeeded / assumptions.proposal_to_reply.value);
// delivery lag: an order must be won early enough to deliver and be paid before the deadline (3–5 day jobs)
const sellingDays = Math.max(0, daysLeft - 3);
const perDay = sellingDays ? +(proposalsNeeded / sellingDays).toFixed(1) : Infinity;
const netPerOrder = Math.round(assumptions.avg_order_jpy.value * (1 - assumptions.platform_fee.value));

const out = {
  as_of: now.toISOString(),
  target: { gross_jpy: target, net_profit: '> 0', deadline, days_left: daysLeft, gross_still_needed_jpy: needGross },
  required_pipeline: { avg_order_jpy: assumptions.avg_order_jpy.value, proposal_to_reply: assumptions.proposal_to_reply.value,
    reply_to_order: assumptions.reply_to_order.value, orders_needed: ordersNeeded, replies_needed: repliesNeeded,
    proposals_needed: proposalsNeeded, selling_days_after_delivery_lag: sellingDays, proposals_per_day_needed: perDay,
    net_per_order_jpy_after_fee: netPerOrder },
  current_pipeline: observed,
  gap: { proposals_short: Math.max(0, proposalsNeeded - observed.proposals_sent),
    required_vs_observed_rate: `${perDay}/day needed vs ${observed.proposals_per_day_observed}/day observed`,
    achievable_at_current_rate: observed.proposals_per_day_observed * sellingDays + observed.proposals_sent >= proposalsNeeded },
  assumptions,
};

// --- scenarios (all ASSUMPTION; base = the single-point calculation above) ---
const sent = observed.proposals_sent;
const need = (avg, r, c) => {
  const orders = needGross > 0 ? Math.ceil(needGross / avg) : 0, replies = Math.ceil(orders / c), proposals = Math.ceil(replies / r);
  return { avg_order_jpy: avg, proposal_to_reply: r, reply_to_order: c, orders_needed: orders, replies_needed: replies, proposals_needed: proposals,
    proposals_remaining: Math.max(0, proposals - sent), proposals_per_day_needed: sellingDays ? +(Math.max(0, proposals - sent) / sellingDays).toFixed(1) : Infinity };
};
const SCEN = {
  optimistic: { avg: 12000, r: 0.15, c: 0.5, basis: 'ASSUMPTION: ¥10k–15k project-format jobs (CrowdWorks; our ¥10,000/¥30,000 Coconala bids); low-competition requests answered early; risk-reversal close' },
  base: { avg: assumptions.avg_order_jpy.value, r: assumptions.proposal_to_reply.value, c: assumptions.reply_to_order.value, basis: 'ASSUMPTION: median of our bids; 5% reply for a 0-review seller; 30% close' },
  pessimistic: { avg: 5000, r: 0.02, c: 0.2, basis: 'ASSUMPTION: small first-win jobs (≤¥10k, our ¥3,000 bid); crowded requests (60–118 applicants) reply 2%; 20% close' },
};
const scenarios = Object.fromEntries(Object.entries(SCEN).map(([k, v]) => [k, { ...need(v.avg, v.r, v.c), basis: v.basis }]));

// --- levers, scored by P(G2) = P(orders >= ceil(need/avg)) with orders ~ Binomial(N, r*c) ---
const pAtLeast = (n, p, k) => { if (k <= 0) return 1; let q = 0, t = Math.pow(1 - p, n); for (let i = 0; i < k; i++) { q += t; t *= (n - i) / (i + 1) * p / (1 - p); } return Math.max(0, 1 - q); };
const capPerDay = Number(opt['cap-per-day'] || 5);  // PROPOSAL_KIT cap across Coconala+CrowdWorks
const LEVERS = {
  status_quo: { how: `keep ${observed.proposals_per_day_observed}/day, same targeting`, f: s => s },
  volume: { how: `raise to the ${capPerDay}/day cap (CrowdWorks live) — needs ≥${capPerDay} GO requests/day of supply (ASSUMPTION)`, f: s => ({ ...s, rate: capPerDay }) },
  volume_2x_cap: { how: `${capPerDay * 2}/day — breaks the quality cap; upper bound (same reply rate assumed, likely optimistic)`, f: s => ({ ...s, rate: capPerDay * 2 }) },
  reply_rate: { how: 'reply ×2 (ASSUMPTION): only requests where we are ≤3rd–5th applicant, objective done-condition, free dummy-data sample up front', f: s => ({ ...s, r: Math.min(0.9, s.r * 2) }) },
  close_rate: { how: 'close ×1.5 (ASSUMPTION): sample-before-start, pay-on-acceptance (escrow), ≤12h replies', f: s => ({ ...s, c: Math.min(0.9, s.c * 1.5) }) },
  price: { how: 'select/quote ¥10k–15k small-scope jobs so ONE order meets G2; reply ×0.8 elasticity (ASSUMPTION)', f: s => ({ ...s, avg: Math.max(s.avg, needGross || s.avg), r: s.r * 0.8 }) },
  price_steep: { how: 'sensitivity: same as price but reply ×0.5 (a buyer strongly prefers cheaper bids)', f: s => ({ ...s, avg: Math.max(s.avg, needGross || s.avg), r: s.r * 0.5 }) },
  price_plus_reply: { how: 'price AND reply levers together: ¥10k–15k small-scope requests where we are early (≤3rd–5th) + free sample — one selection rule', f: s => ({ ...s, avg: Math.max(s.avg, needGross || s.avg), r: Math.min(0.9, s.r * 2 * 0.8) }) },
};
const score = s => { const n = Math.round(sent + s.rate * sellingDays), p = s.r * s.c, k = needGross > 0 ? Math.ceil(needGross / s.avg) : 0;
  return { proposals_by_deadline: n, orders_needed: k, p_g2: +pAtLeast(n, p, k).toFixed(3), expected_gross_jpy: Math.round(n * p * s.avg) }; };
const levers = {};
for (const [name, L] of Object.entries(LEVERS)) {
  const per = {}, onVol = {};
  for (const [sk, v] of Object.entries(SCEN)) {
    const base = { avg: v.avg, r: v.r, c: v.c, rate: observed.proposals_per_day_observed };
    per[sk] = score(L.f(base));
    onVol[sk] = score(L.f({ ...base, rate: Math.max(base.rate, capPerDay) }));
  }
  const mean = o => +(Object.values(o).reduce((a, x) => a + x.p_g2, 0) / 3).toFixed(3);
  levers[name] = { how: L.how, alone: per, on_top_of_cap_volume: onVol, mean_p_g2_alone: mean(per), mean_p_g2_with_cap_volume: mean(onVol) };
}
// Rank on base, tie-break on pessimistic: the optimistic case saturates (any lever ≈ 1), so it carries no decision signal.
const ranked = Object.entries(levers).filter(([k]) => !['status_quo', 'volume_2x_cap', 'price_steep'].includes(k))
  .map(([k, v]) => ({ lever: k, base_p_g2: v.on_top_of_cap_volume.base.p_g2, pessimistic_p_g2: v.on_top_of_cap_volume.pessimistic.p_g2, optimistic_p_g2: v.on_top_of_cap_volume.optimistic.p_g2 }))
  .sort((a, b) => (b.base_p_g2 + b.pessimistic_p_g2) - (a.base_p_g2 + a.pessimistic_p_g2));
out.scenarios = scenarios;
out.levers = levers;
out.lever_ranking = ranked;
out.lever_note = 'P(G2)=P(orders ≥ ceil(¥still-needed/avg)) with orders~Binomial(proposals by deadline, reply×close). "volume" (to the cap) is compared alone; the other levers are scored both alone and on top of cap volume. Ranking uses base + pessimistic (optimistic saturates near 1 for every lever). All lever effect sizes are ASSUMPTIONS until replies are observed.';
if (opt.json) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`G2 back-calculation @ ${out.as_of}`);
console.log(`TARGET   ¥${target} gross & net>0 by ${deadline}; ${daysLeft} days left; ¥${needGross} still needed`);
console.log(`REQUIRED avg order ¥${assumptions.avg_order_jpy.value} → ${ordersNeeded} orders → ${repliesNeeded} replies → ${proposalsNeeded} proposals → ${perDay}/day over ${sellingDays} selling days (net ¥${netPerOrder}/order after fee)`);
console.log(`CURRENT  proposals ${observed.proposals_sent}, replies ${observed.replies}, consultations ${observed.quote_consultations}, orders ${observed.orders}, revenue ¥${observed.gross_revenue_jpy} (${observed.proposals_per_day_observed}/day observed)`);
console.log(`GAP      ${out.gap.proposals_short} proposals short; ${out.gap.required_vs_observed_rate}; achievable at current rate: ${out.gap.achievable_at_current_rate}`);
for (const [k, v] of Object.entries(assumptions)) console.log(`  ${k}: ${v.value} — ${v.source}`);
console.log('SCENARIOS (all ASSUMPTION)');
for (const [k, v] of Object.entries(scenarios)) console.log(`  ${k.padEnd(11)} avg ¥${v.avg_order_jpy}  reply ${v.proposal_to_reply}  close ${v.reply_to_order} → ${v.orders_needed} orders, ${v.proposals_needed} proposals (${v.proposals_remaining} more) = ${v.proposals_per_day_needed}/day`);
console.log('LEVERS  P(G2) opt/base/pess — alone | on top of cap volume');
for (const [k, v] of Object.entries(levers)) console.log(`  ${k.padEnd(14)} ${Object.values(v.alone).map(x => x.p_g2).join('/')} | ${Object.values(v.on_top_of_cap_volume).map(x => x.p_g2).join('/')}  mean ${v.mean_p_g2_alone} | ${v.mean_p_g2_with_cap_volume}`);
console.log('RANK (base+pessimistic, on cap volume)  ' + ranked.map(r => `${r.lever} ${r.base_p_g2}/${r.pessimistic_p_g2}`).join(' > '));
