import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SHEET, sha, approvalHash, validatePackage, initialState, run, verify, report } from '../scripts/ai-news/core.mjs';
import { xApi } from '../scripts/ai-news/x-api.mjs';
import { gitStore, safeFile, inventory } from '../scripts/ai-news/storage.mjs';
const clone = x => structuredClone(x);
const start = Date.parse('2026-10-02T08:00:00+09:00');
const picture = Buffer.from('fixture image bytes');
function config() { return { enabled: true, account: 'KinoshitaTsks', reviewed_at: '2026-10-01T00:00:00Z', valid_until: '2026-12-01T00:00:00Z', capabilities: { longform: true, oauth1_write: true, account_id: '42', media_upload: true, evidence: 'MOCK ONLY' }, jpy_per_usd_ceiling: 150, tax_rate: 0.1, margin_rate: 0.1, prices: { create_usd: 0.2, read_usd: 0.005, upload_usd: 0.01 }, pricing_evidence: 'MOCK ONLY', billing: { news_only: true, evidence: 'MOCK ONLY', valid_until: '2026-12-01T00:00:00Z', months: { '2026-10': { actual_minor_jpy: 0, non_api_reserve_minor_jpy: 0, reconciled_operation_ids: [] }, '2026-11': { actual_minor_jpy: 0, non_api_reserve_minor_jpy: 0, reconciled_operation_ids: [] } } }, account_inventory: { complete: true, uncoordinated_writers: false, evidence: 'MOCK ONLY', valid_until: '2026-12-01T00:00:00Z' } }; }
function pkg(overrides = {}) {
  const p = { schema: 1, id: 'news-test-1', account: 'KinoshitaTsks', sheet_id: SHEET, topic_key: 'test-new-topic', text: 'あ'.repeat(580) + '\nhttps://example.com/source', source_urls: ['https://example.com/source'], source_refs: { post: '投稿DB:id', queue: '予約投稿キュー:id', media: 'メディアDB:id', kpi: 'KPI:id', learning: '学習DB:id' }, scheduled_at: '2026-10-02T08:00:00+09:00', image: { path: 'media/test.png', sha256: sha(picture), mime: 'image/png' }, text_fallback: { allowed: true, reason: null }, ...overrides };
  p.approval = { by: 'test-parent', at: '2026-10-01T00:00:00Z', sha256: approvalHash(p) }; return p;
}
function harness(p = pkg()) {
  const h = { state: initialState(), config: config(), queue: [p], clock: start, calls: [], checkpoints: [], inventory: [] };
  h.api = { upload: async () => { h.calls.push('upload'); return { id: '55', media_key: '3_55' }; }, create: async body => { h.calls.push('create'); h.body = body; return '12345'; }, get: async id => { h.calls.push('get'); const post = Object.values(h.state.posts).find(p => p.tweet_id === id); return { data: { id, author_id: '42', created_at: new Date(h.createdAt ?? start).toISOString(), text: 'truncated', note_tweet: { text: post.text }, attachments: { media_keys: post.media_key ? [post.media_key] : [] }, public_metrics: { impression_count: 12 } }, includes: { media: post.media_key ? [{ media_key: post.media_key, type: 'photo' }] : [] } }; } };
  h.persist = async s => { h.checkpoints.push(clone(s)); };
  h.run = () => run({ ...h, now: () => h.clock, loadImage: h.loadImage || (async () => picture) }); return h;
}

test('approved long text + source URL unchanged; receipt persisted before GET; media verification', async () => {
  const h = harness(); const get = h.api.get; h.api.get = async id => { assert.equal(h.checkpoints.at(-2).posts['news-test-1'].tweet_id, id); return get(id); };
  const r = await h.run(); assert.equal(r.halt, null); assert.deepEqual(h.calls, ['upload', 'create', 'get']);
  assert.deepEqual(h.body, { text: h.queue[0].text, media: { media_ids: ['55'] } });
  assert.equal(h.state.posts['news-test-1'].status, 'verified'); assert.equal(h.state.observations.length, 1);
  await h.run(); assert.equal(h.calls.filter(x => x === 'create').length, 1);
});
test('575-600 body validation and immutable approval include URL, time and media', () => {
  for (const length of [575, 600]) validatePackage(pkg({ text: '文'.repeat(length) + '\nhttps://example.com/source' }));
  for (const length of [574, 601]) assert.throws(() => validatePackage(pkg({ text: '文'.repeat(length) + '\nhttps://example.com/source' })));
  const p = pkg(); p.text += '改変'; assert.throws(() => validatePackage(p), /approval/);
  assert.throws(() => validatePackage(pkg({ source_urls: ['https://example.com/missing'] })), /source/);
  assert.throws(() => validatePackage(pkg({ scheduled_at: '2026-10-02T09:00:00+09:00' })), /slot/);
});
test('POST timeout or malformed success stops and NEVER retries across restart', async () => {
  for (const result of ['throw', undefined]) {
    const h = harness(); h.api.create = async () => { h.calls.push('create'); if (result === 'throw') throw Error('timeout'); return result; };
    const r = await h.run(); assert.match(r.halt.reason, /post_result_unknown/);
    h.state = clone(h.checkpoints.at(-1)); await h.run(); assert.equal(h.calls.filter(x => x === 'create').length, 1);
  }
});
test('durable intent before POST; failure saving receipt prevents GET and remote restart cannot repost', async () => {
  const h = harness(); let remote;
  h.persist = async s => { if (s.posts['news-test-1']?.tweet_id) throw Error('storage outage'); remote = clone(s); };
  await assert.rejects(h.run(), /storage/); assert.deepEqual(h.calls, ['upload', 'create']);
  h.state = remote; h.persist = async s => { remote = clone(s); };
  assert.equal((await h.run()).halt.reason, 'unresolved_write_intent'); assert.equal(h.calls.filter(x => x === 'create').length, 1);
});
test('checkpoint failure before paid write makes zero API calls', async () => {
  const h = harness(); h.persist = async () => { throw Error('push rejected'); }; await assert.rejects(h.run()); assert.equal(h.calls.length, 0);
});
test('POST succeeds GET fails: keeps ID, retries GET only after one hour, bills retry reservation', async () => {
  const h = harness(); const get = h.api.get; h.api.get = async () => { h.calls.push('get-fail'); throw Error('read unavailable'); };
  await h.run(); assert.equal(h.state.posts['news-test-1'].tweet_id, '12345');
  await h.run(); assert.equal(h.calls.filter(x => x === 'get-fail').length, 1);
  h.clock += 3600000; h.api.get = get; await h.run(); assert.equal(h.state.posts['news-test-1'].status, 'verified'); assert.equal(h.calls.filter(x => x === 'create').length, 1);
  assert(h.state.operations.some(x => x.id.includes('read:0:2:')));
});
test('GET retries max three then halts; mismatching full text halts', async () => {
  const h = harness(); h.api.get = async () => { throw Error('no'); };
  await h.run(); h.clock += 3600000; await h.run(); h.clock += 3600000; assert.equal((await h.run()).halt.reason, 'read_retry_limit');
  const k = harness(); const get = k.api.get; k.api.get = async id => { const r = await get(id); r.data.note_tweet.text = 'shortened'; return r; };
  assert.equal((await k.run()).halt.reason, 'full_text_mismatch');
});
test('image missing/hash failure/rejected request uses explicitly allowed identical text fallback', async () => {
  for (const mode of ['missing', 'hash', 'rejected']) {
    const h = harness(); if (mode === 'missing') h.loadImage = async () => { throw Error('missing'); };
    if (mode === 'hash') h.loadImage = async () => Buffer.from('wrong');
    if (mode === 'rejected') h.api.upload = async () => { const e = Error('rejected'); e.definitive = true; throw e; };
    assert.equal((await h.run()).halt, null); assert.deepEqual(h.body, { text: h.queue[0].text }); assert.equal(h.state.posts['news-test-1'].fallback_reason, 'technical');
  }
});
test('unapproved image can use allowed approval fallback; unknown upload fee cannot use budget fallback', async () => {
  const h = harness(); h.config.capabilities.media_upload = false; await h.run(); assert.equal(h.calls.includes('upload'), false); assert.equal(h.state.posts['news-test-1'].fallback_reason, 'approval');
  const k = harness(); k.config.prices.upload_usd = null; assert.equal((await k.run()).halt.reason, 'unknown_upload_price'); assert.equal(k.calls.length, 0);
});
test('image timeout and disallowed fallback halt; no create', async () => {
  const h = harness(); h.api.upload = async () => { throw Error('timeout'); }; assert.match((await h.run()).halt.reason, /upload_result_unknown/); assert(!h.calls.includes('create'));
  const k = harness(pkg({ text_fallback: { allowed: false } })); k.loadImage = async () => { throw Error('missing'); }; assert.equal((await k.run()).halt.reason, 'image_unavailable');
});
test('exact JPY3000 boundary includes tax, FX and margin; one minor-unit over refuses entire package', async () => {
  const probe = harness(); await probe.run(); const cost = probe.state.operations.reduce((n, o) => n + o.minor_jpy, 0);
  for (const delta of [0, 1]) { const h = harness(); h.config.billing.months['2026-10'].actual_minor_jpy = 300000 - cost + delta;
    const r = await h.run(); assert.equal(Boolean(r.halt), delta === 1); if (delta) { assert.equal(h.calls.length, 0); assert.equal(r.pending.length, 1); } }
});
test('unknown billing/FX or account eligibility stops without requests', async () => {
  for (const mutate of [c => c.billing.months = {}, c => c.jpy_per_usd_ceiling = null, c => c.capabilities.longform = false, c => c.account_inventory.uncoordinated_writers = true, c => c.enabled = false]) { const h = harness(); mutate(h.config); assert((await h.run()).halt); assert.equal(h.calls.length, 0); }
});
test('future month observations reserved before publishing; missing next-month billing blocks', async () => {
  const p = pkg({ scheduled_at: '2026-10-31T20:00:00+09:00' });
  const h = harness(p); h.clock = Date.parse(p.scheduled_at); h.createdAt = h.clock; await h.run();
  assert.equal(h.state.operations.filter(o => o.month === '2026-11').length, 3);
  h.clock += 24 * 3600000; await h.run(); assert.equal(h.state.observations.length, 2);
  const k = harness(p); k.clock = Date.parse(p.scheduled_at); delete k.config.billing.months['2026-11']; assert.match((await k.run()).halt.reason, /billing_month/); assert.equal(k.calls.length, 0);
});
test('late observation crossing month reserves new month, retains old conservative hold', async () => {
  const h = harness(); await h.run(); h.clock = Date.parse('2026-11-01T00:00:00+09:00'); await h.run();
  assert.equal(h.state.operations.filter(o => o.month === '2026-11').length, 3); assert.equal(h.state.observations.length, 4);
  const r = report(h.state, h.config, h.queue, h.clock); assert(r.budgets.find(b => b.month === '2026-10').reserved_minor_jpy > 0);
});
test('actual publication time/delay retained; observations due from actual publication', async () => {
  const h = harness(); h.clock += 5 * 60000; h.createdAt = h.clock; await h.run();
  const p = h.state.posts['news-test-1']; assert.equal(p.delay_seconds, 300); assert.equal(Date.parse(p.observation_jobs[1].due_at), h.createdAt + 86400000);
});
test('too-late, future and duplicate slot; no burst catchup', async () => {
  const h = harness(); h.clock += 16 * 60000; assert.match((await h.run()).halt.reason, /missed_slot/); assert.equal(h.calls.length, 0);
  const f = harness(); f.clock -= 1; await f.run(); assert.equal(f.calls.length, 0);
  const d = harness(); d.queue.push(pkg({ id: 'news-test-2', topic_key: 'different-topic', text: 'い'.repeat(580) + '\nhttps://example.com/source' })); await d.run(); await d.run(); assert.equal(d.calls.filter(x => x === 'create').length, 1); assert(d.state.halt);
});
test('existing account duplicate/20:37 conflict and known published stories blocked', async () => {
  for (const topic of ['gpt6.1', 'GEMINI4']) { const h = harness(pkg({ topic_key: topic })); assert.equal((await h.run()).halt.reason, 'already_published_topic'); }
  const d = harness(); d.inventory = [{ text: d.queue[0].text }]; assert.equal((await d.run()).halt.reason, 'duplicate_account_content');
  const h = harness(pkg({ scheduled_at: '2026-10-01T20:00:00+09:00' })); h.clock = Date.parse(h.queue[0].scheduled_at) + 10 * 60000;
  h.inventory = [{ not_before: '2026-10-01T20:37:00+09:00', text: 'existing business' }]; assert.equal((await h.run()).halt.reason, 'account_schedule_conflict'); assert.equal(h.calls.length, 0);
  const k = harness(pkg({ scheduled_at: '2026-10-01T20:00:00+09:00' })); k.clock = Date.parse(k.queue[0].scheduled_at); k.createdAt = k.clock; k.inventory = h.inventory; assert.equal((await k.run()).halt, null);
});
test('three/day news cap counts the two manually published news posts, excludes business count', async () => {
  const h = harness(); h.state.external_posts.push(...[1, 2, 3].map(i => ({ lane: 'news', published_at: '2026-10-02T01:00:00+09:00', tweet_id: String(i) })));
  assert.equal((await h.run()).halt.reason, 'news_daily_cap');
});
test('t.co expansion validates full text and attachment mismatch fails', async () => {
  const h = harness(); await h.run(); const p = h.state.posts['news-test-1']; const r = await h.api.get(p.tweet_id);
  r.data.note_tweet.text = p.text.replace('https://example.com/source', 'https://t.co/abc'); r.data.note_tweet.entities = { urls: [{ url: 'https://t.co/abc', expanded_url: 'https://example.com/source' }] };
  verify(r, p, h.config); r.includes.media = []; assert.throws(() => verify(r, p, h.config), /media/);
});
test('X adapter uses longform+media body, note_tweet/media expansions; redacts errors', async () => {
  const calls = []; const api = xApi({ X_API_KEY: 'mock', X_API_KEY_SECRET: 'mock', X_ACCESS_TOKEN: 'mock', X_ACCESS_TOKEN_SECRET: 'mock' }, async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ data: { id: '123' } }) }; });
  const body = { text: pkg().text, media: { media_ids: ['55'] } }; await api.create(body); await api.get('123'); await api.upload(picture);
  assert.deepEqual(JSON.parse(calls[0].options.body), body); assert.match(calls[1].url, /note_tweet/); assert.match(calls[1].url, /attachments.media_keys/); assert.equal(JSON.parse(calls[2].options.body).media_category, 'tweet_image');
  const bad = xApi({ X_API_KEY: 'mock', X_API_KEY_SECRET: 'mock', X_ACCESS_TOKEN: 'mock', X_ACCESS_TOKEN_SECRET: 'mock' }, async () => ({ ok: false, status: 403, json: async () => ({ secret: 'DO NOT LOG' }) })); await assert.rejects(bad.create(body), /^Error: x_http_403$/);
});
test('remote git checkpoints survive fresh checkout, stale writer rejected', async () => {
  const root = mkdtempSync(join(tmpdir(), 'news-git-')); const remote = join(root, 'remote.git'), a = join(root, 'a'), b = join(root, 'b');
  const git = (args, cwd) => execFileSync('git', args, { cwd, stdio: 'pipe' }).toString();
  try { git(['init', '--bare', remote]); git(['clone', remote, a]); git(['switch', '-c', 'ai-news-state'], a); writeFileSync(join(a, 'state.json'), JSON.stringify(initialState())); git(['add', '.'], a); git(['-c', 'user.name=test', '-c', 'user.email=test@example.com', 'commit', '-m', 'bootstrap'], a); git(['push', '-u', 'origin', 'ai-news-state'], a); git(['clone', '--branch', 'ai-news-state', remote, b]);
    const saveA = gitStore(a), saveB = gitStore(b), s = initialState(); s.halt = { reason: 'test-intent' }; await saveA(s);
    const stale = initialState(); stale.halt = { reason: 'stale' }; await assert.rejects(saveB(stale), /durable_git_failure/);
    assert.equal(JSON.parse(git(['show', 'ai-news-state:state.json'], remote)).halt.reason, 'test-intent');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('image traversal/symlink rejected; inventory reads existing business without changing files', () => {
  const root = mkdtempSync(join(tmpdir(), 'news-path-')); try { mkdirSync(join(root, 'media')); symlinkSync('/etc/hosts', join(root, 'media/test.png')); assert.throws(() => safeFile(root, 'media/test.png')); } finally { rmSync(root, { recursive: true, force: true }); }
  const path = 'social/2026-10/queue/2026-10-01-pm.json', before = readFileSync(path); const rows = inventory(process.cwd()); assert(rows.some(r => r.not_before === '2026-10-01T20:37:00+09:00')); assert.deepEqual(readFileSync(path), before);
});

test('FX/price increase refreshes future read reservation and stops at ceiling', async () => {
  const h = harness(); await h.run(); const held = h.state.operations.reduce((n, o) => n + o.minor_jpy, 0);
  h.config.billing.months['2026-10'].actual_minor_jpy = 300000 - held;
  h.config.jpy_per_usd_ceiling = 200; h.clock += 86400000;
  assert.match((await h.run()).halt.reason, /budget_limit/); assert.equal(h.calls.filter(x => x === 'get').length, 1);
});
test('actual reconciliation replaces only attempted operation reservations, never unperformed work', async () => {
  const h = harness(); await h.run(); const op = h.state.operations.find(o => o.kind === 'create');
  h.config.billing.months['2026-10'] = { actual_minor_jpy: 3600, non_api_reserve_minor_jpy: 0, reconciled_operation_ids: [op.id] };
  const r = report(h.state, h.config, h.queue, h.clock); assert.equal(r.budgets[0].actual_minor_jpy, 3600);
  assert.equal(r.budgets[0].reserved_minor_jpy, h.state.operations.filter(o => o.id !== op.id).reduce((n, o) => n + o.minor_jpy, 0));
  h.config.billing.months['2026-10'].reconciled_operation_ids.push('news-test-1:read:24:1:2026-10');
  h.clock += 86400000; assert.equal((await h.run()).halt.reason, 'invalid_billing_reconciliation');
});
test('date rollover during upload stops before POST', async () => {
  const h = harness(); h.api.upload = async () => { h.clock = Date.parse('2026-11-01T00:00:00+09:00'); return { id: '55', media_key: '3_55' }; };
  assert.equal((await h.run()).halt.reason, 'missed_slot_after_upload'); assert(!h.calls.includes('create'));
});
test('parent export is deterministic and makes no assumed sheet schema changes', async () => {
  const { exportRecords } = await import('../scripts/ai-news/export.mjs'); const h = harness(); await h.run();
  const a = exportRecords(h.state); assert.deepEqual(a, exportRecords(clone(h.state))); assert.equal(a.sheet_id, SHEET);
  assert.deepEqual(a.records.map(x => x.kind), ['post', 'queue', 'media', 'kpi', 'learning']); assert.equal(a.records.at(-1).fields.interpretation, null);
});
test('inactive news template and existing business cap/schedule remain separate', () => {
  const wf = readFileSync('ops/ai-news/cloud.yml.template', 'utf8'); assert.match(wf, /0 23,3,11/); assert.match(wf, /publish-main/);
  assert.match(readFileSync('.github/workflows/x-phase2.yml', 'utf8'), /37 11/);
  assert.match(readFileSync('scripts/oct/x_phase2.mjs', 'utf8'), /MAX_PER_DAY = 2/);
  assert.match(readFileSync('.github/workflows/x-post-toplevel.yml', 'utf8'), /group: publish-main/);
});
test('missing media result cannot silently publish text; other news costs reserve inside cap', async () => {
  const h = harness(); h.api.upload = async () => undefined; assert.equal((await h.run()).halt.reason, 'invalid_media_response'); assert(!h.calls.includes('create'));
  const k = harness(); k.config.billing.months['2026-10'].non_api_reserve_minor_jpy = 300000; assert.match((await k.run()).halt.reason, /budget_limit/); assert.equal(k.calls.length, 0);
});
test('slow intent checkpoint enters existing business protection window: no POST', async () => {
  const h = harness(pkg({ scheduled_at: '2026-10-01T20:00:00+09:00' }));
  h.clock = Date.parse('2026-10-01T20:06:59+09:00');
  h.inventory = [{ not_before: '2026-10-01T20:37:00+09:00', text: 'existing business' }];
  const save = h.persist;
  h.persist = async s => {
    await save(s);
    if (s.posts['news-test-1']?.status === 'post_intent' && !s.halt) h.clock += 2000;
  };
  const result = await h.run();
  assert.equal(result.halt.reason, 'account_schedule_conflict');
  assert.equal(h.state.posts['news-test-1'].status, 'post_intent');
  assert(!h.calls.includes('create')); assert(!h.calls.includes('get'));
  h.state = clone(h.checkpoints.at(-1)); await h.run();
  assert(!h.calls.includes('create'));
});
test('slow intent checkpoint exceeds 15 minute deadline: no POST', async () => {
  const h = harness(); h.clock = start + 15 * 60000 - 1000;
  const save = h.persist;
  h.persist = async s => {
    await save(s);
    if (s.posts['news-test-1']?.status === 'post_intent' && !s.halt) h.clock += 2000;
  };
  const result = await h.run();
  assert.equal(result.halt.reason, 'missed_slot_after_intent');
  assert(!h.calls.includes('create')); assert(!h.calls.includes('get'));
});
