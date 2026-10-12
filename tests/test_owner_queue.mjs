// node tests/test_owner_queue.mjs — deadline-based owner queue priority (owner request 2026-10-12)
import assert from 'assert';
import { ownerQueue, renderBlock, applyBlock, priorityFor, BEGIN, END } from '../scripts/lib/owner_queue.mjs';

const now = Date.parse('2026-10-12T00:00:00Z');
const h = n => new Date(now + n * 3600e3).toISOString();
assert.equal(priorityFor(null), 'NORMAL'); assert.equal(priorityFor(24), 'URGENT'); assert.equal(priorityFor(30), 'HIGH'); assert.equal(priorityFor(49), 'NORMAL');

const tasks = [
  { id: 'owner-cw-relogin', status: 'open', requires: ['human'], title: 'CrowdWorks re-login', site: 'crowdworks.jp' },
  { id: 'cw-send', status: 'open', requires: ['local_browser'], blocked_by: ['owner-cw-relogin'],
    opportunities: [{ url: 'https://crowdworks.jp/public/jobs/1', title: 'PDF→Word', budget_jpy: 8000, apply_by: h(10), lost_if_missed: '¥8,000' },
                    { url: 'https://crowdworks.jp/public/jobs/2', apply_by: h(-1) }] },
  { id: 'owner-note-relogin', status: 'open', requires: ['human'], title: 'note re-login' },
  { id: 'owner-coconala-x', status: 'open', requires: ['human'], title: 'coconala', opportunities: [{ url: 'u3', apply_by: h(40) }] },
  { id: 'owner-done', status: 'done', requires: ['human'], title: 'x', opportunities: [{ url: 'u4', apply_by: h(1) }] },
];
const q = ownerQueue(tasks, now);
assert.deepEqual(q.map(x => [x.id, x.priority]), [['owner-cw-relogin', 'URGENT'], ['owner-coconala-x', 'HIGH'], ['owner-note-relogin', 'NORMAL']]);
assert.deepEqual(q[0].blocks, ['cw-send']);
assert.equal(q[0].opportunities.length, 1); assert.equal(q[0].lapsed.length, 1);
const block = renderBlock(q, now);
assert.ok(block.indexOf('URGENT') < block.indexOf('HIGH') && block.indexOf('HIGH') < block.indexOf('NORMAL'));
assert.ok(block.includes('https://crowdworks.jp/public/jobs/1') && block.includes('10/12 19:00 JST') && block.includes('¥8,000'));
const md = '# t\n\n## 現在の依頼（10月）\n\nold\n';
const once = applyBlock(md, block), twice = applyBlock(once, renderBlock([], now));
assert.ok(once.indexOf(BEGIN) < once.indexOf('old'));
assert.equal(twice.split(END).length, 2); assert.ok(twice.includes('オーナーが行うべき操作はありません') && !twice.includes('URGENT（'));
console.log('test_owner_queue: all checks passed');
