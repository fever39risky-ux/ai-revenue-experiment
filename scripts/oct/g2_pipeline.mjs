#!/usr/bin/env node
/**
 * Goal back-calculation for the weekly review (ops/2026-10/REVIEW_SPEC.md).
 *   node scripts/oct/g2_pipeline.mjs [--now ISO] [--target 10000] [--deadline 2026-10-20]
 *        [--avg-order N] [--reply-rate 0.05] [--close-rate 0.3] [--fee 0.22] [--json]
 * Observed values come from the repo (events + ledgers). Anything not observed is printed
 * as ASSUMPTION with its source, so the review never presents a guess as data.
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
if (opt.json) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`G2 back-calculation @ ${out.as_of}`);
console.log(`TARGET   ¥${target} gross & net>0 by ${deadline}; ${daysLeft} days left; ¥${needGross} still needed`);
console.log(`REQUIRED avg order ¥${assumptions.avg_order_jpy.value} → ${ordersNeeded} orders → ${repliesNeeded} replies → ${proposalsNeeded} proposals → ${perDay}/day over ${sellingDays} selling days (net ¥${netPerOrder}/order after fee)`);
console.log(`CURRENT  proposals ${observed.proposals_sent}, replies ${observed.replies}, consultations ${observed.quote_consultations}, orders ${observed.orders}, revenue ¥${observed.gross_revenue_jpy} (${observed.proposals_per_day_observed}/day observed)`);
console.log(`GAP      ${out.gap.proposals_short} proposals short; ${out.gap.required_vs_observed_rate}; achievable at current rate: ${out.gap.achievable_at_current_rate}`);
for (const [k, v] of Object.entries(assumptions)) console.log(`  ${k}: ${v.value} — ${v.source}`);
