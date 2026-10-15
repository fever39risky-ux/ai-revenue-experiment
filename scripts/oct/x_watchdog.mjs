#!/usr/bin/env node
/**
 * X due-queue watchdog decision (no network, no credentials). Run every 10 min by .github/workflows/x-watchdog.yml.
 * Prints JSON {dispatch, reason, due:[files]}: dispatch=true when a queue item is due for > GRACE_MIN, is still unposted
 * (posted items are removed from the queue) and today's JST post count is below the cap. The workflow then dispatches
 * x-phase2.yml unless a run is already queued/running. Replaces the Founder's manual cron backstop (owner rule 2026-10-15).
 *   X_NOW=ISO to simulate.
 */
import { readFileSync, readdirSync, existsSync } from 'fs';

const QUEUE = 'social/2026-10/queue', POSTED = 'social/2026-10/posted.jsonl', CAP = 2;
const GRACE_MIN = Number(process.env.X_WATCHDOG_GRACE_MIN || 5);
const now = process.env.X_NOW ? Date.parse(process.env.X_NOW) : Date.now();
const jst = ms => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

export function decide(items, posted, nowMs) {
  const due = items.filter(i => Date.parse(i.not_before) <= nowMs - GRACE_MIN * 60e3).map(i => i.file);
  const today = posted.filter(p => jst(Date.parse(p.posted_at)) === jst(nowMs)).length;
  if (!due.length) return { dispatch: false, reason: 'nothing overdue', due, posted_today: today };
  if (today >= CAP) return { dispatch: false, reason: `cap ${CAP}/day reached (${today}); due item rolls to tomorrow — Founder must re-date its text`, due, posted_today: today };
  return { dispatch: true, reason: `${due.length} item(s) due > ${GRACE_MIN} min and unposted`, due, posted_today: today };
}

const items = existsSync(QUEUE) ? readdirSync(QUEUE).filter(f => f.endsWith('.json')).sort()
  .map(f => ({ file: f, ...JSON.parse(readFileSync(`${QUEUE}/${f}`, 'utf8')) })) : [];
const posted = existsSync(POSTED) ? readFileSync(POSTED, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
console.log(JSON.stringify(decide(items, posted, now)));
