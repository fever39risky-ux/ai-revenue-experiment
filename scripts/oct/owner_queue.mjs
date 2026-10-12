#!/usr/bin/env node
/**
 * Owner queue with deadline-based priority (scripts/lib/owner_queue.mjs).
 *   node scripts/oct/owner_queue.mjs              # print the queue
 *   node scripts/oct/owner_queue.mjs render       # rewrite the generated block at the top of OWNER_ACTION_REQUIRED.md
 *   node scripts/oct/owner_queue.mjs json         # machine-readable (used by .github/workflows/owner-queue.yml)
 *   [--now ISO]
 */
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { ROOT } from '../lib/periods.mjs';
import { readTasks } from '../lib/phase2.mjs';
import { ownerQueue, renderBlock, applyBlock } from '../lib/owner_queue.mjs';

const a = process.argv.slice(2);
const i = a.indexOf('--now');
const nowMs = i >= 0 ? Date.parse(a[i + 1]) : Date.now();
const cmd = a.find((x, j) => !x.startsWith('--') && !(i >= 0 && j === i + 1)) || 'show';
const q = ownerQueue(readTasks(), nowMs);

if (cmd === 'json') { console.log(JSON.stringify({ as_of: new Date(nowMs).toISOString(), queue: q }, null, 2)); process.exit(0); }
if (cmd === 'render') {
  const p = join(ROOT, 'OWNER_ACTION_REQUIRED.md');
  const before = readFileSync(p, 'utf8');
  // the timestamp line alone never forces a rewrite
  const strip = s => s.replace(/_自動生成: [^_]*_/, '');
  const after = applyBlock(before, renderBlock(q, nowMs));
  if (strip(after) !== strip(before)) { writeFileSync(p, after); console.log('OWNER_ACTION_REQUIRED.md updated'); } else console.log('no change');
  process.exit(0);
}
if (!q.length) console.log('owner queue: empty');
for (const x of q) console.log(`${x.priority.padEnd(6)} ${x.id}${x.hours_left != null ? ` (${x.hours_left}h)` : ''} blocks=${x.blocks.join(',') || '-'} opps=${x.opportunities.length}${x.lapsed.length ? ` LAPSED=${x.lapsed.length}` : ''}`);
