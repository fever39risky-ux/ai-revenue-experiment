#!/usr/bin/env node
/**
 * Escalate URGENT / HIGH owner-queue items as GitHub issues (the owner gets GitHub's notification),
 * close them when the item is resolved or no longer deadline-bound. Run by .github/workflows/owner-queue.yml.
 * Needs `gh` + GH_TOKEN; prints the plan and exits 0 without them (--dry-run is implied).
 */
import { execFileSync } from 'child_process';
import { readTasks } from '../lib/phase2.mjs';
import { ownerQueue, renderBlock } from '../lib/owner_queue.mjs';

const LABEL = 'owner-queue';
const dry = process.argv.includes('--dry-run') || !process.env.GH_TOKEN;
const gh = (...args) => execFileSync('gh', args, { encoding: 'utf8' });
const want = ownerQueue(readTasks()).filter(q => q.priority !== 'NORMAL');
const title = q => `[owner-queue] ${q.priority}: ${q.title} (${q.id})`;
const body = q => renderBlock([q]).split('\n').filter(l => !l.startsWith('<!--')).join('\n') +
  '\n\nOWNER_ACTION_REQUIRED.md の最上段にも表示しています。対応が終わると自動で閉じます。';

if (dry) { for (const q of want) console.log(`would open/update: ${title(q)}`); process.exit(0); }
try { gh('label', 'create', LABEL, '--color', 'B60205', '--description', 'Deadline-bound owner action (URGENT/HIGH)', '--force'); } catch {}
const open = JSON.parse(gh('issue', 'list', '--label', LABEL, '--state', 'open', '--json', 'number,title', '--limit', '100'));
const idOf = t => (t.match(/\(([a-z0-9-]+)\)$/) || [])[1];
for (const q of want) {
  const cur = open.find(i => idOf(i.title) === q.id);
  if (cur) { if (cur.title !== title(q)) gh('issue', 'edit', String(cur.number), '--title', title(q), '--body', body(q)); }
  else gh('issue', 'create', '--title', title(q), '--body', body(q), '--label', LABEL);
  console.log(`${cur ? 'kept' : 'opened'}: ${title(q)}`);
}
for (const i of open) if (!want.some(q => q.id === idOf(i.title))) {
  gh('issue', 'close', String(i.number), '--comment', 'Resolved or no longer deadline-bound (owner queue). Closed automatically.');
  console.log(`closed: #${i.number}`);
}
