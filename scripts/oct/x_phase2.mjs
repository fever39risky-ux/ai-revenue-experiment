#!/usr/bin/env node
/**
 * Phase 2 X pipeline (ops/2026-10/X_PHASE2.md). Runs in GitHub Actions.
 *
 *   node scripts/oct/x_phase2.mjs validate   # check queue items (no network, no creds) — used by tests/CI
 *   node scripts/oct/x_phase2.mjs post       # post the earliest due queue item (cap MAX_PER_DAY per JST day)
 *   node scripts/oct/x_phase2.mjs metrics    # refresh metrics for posts < 7 days old
 *
 * Queue: social/2026-10/queue/*.json  { not_before, text, reply_text?, series, hypothesis,
 *        register_targeted, voice_self_check[], facts_source }
 * Log:   social/2026-10/posted.jsonl (append), social/2026-10/metrics.json
 * Never replies to others, never DMs. No-ops cleanly without credentials.
 */
import { readFileSync, writeFileSync, appendFileSync, readdirSync, existsSync, unlinkSync, mkdirSync } from 'fs';
import { createHmac, randomBytes } from 'crypto';

const DIR = 'social/2026-10', QUEUE = `${DIR}/queue`, POSTED = `${DIR}/posted.jsonl`, METRICS = `${DIR}/metrics.json`;
const MAX_PER_DAY = 2;
const REQUIRED = ['not_before', 'text', 'series', 'hypothesis', 'register_targeted', 'voice_self_check', 'facts_source'];
const nowMs = () => process.env.X_NOW ? Date.parse(process.env.X_NOW) : Date.now();
const jstDate = ms => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

export function weightedLength(s) {
  const forCount = s.replace(/https?:\/\/\S+/g, 'x'.repeat(23));
  let w = 0;
  for (const ch of forCount) { const cp = ch.codePointAt(0); w += (cp > 0x10FF && !(cp >= 0x2000 && cp <= 0x206F)) ? 2 : 1; }
  return w;
}
function queueItems() {
  if (!existsSync(QUEUE)) return [];
  return readdirSync(QUEUE).filter(f => f.endsWith('.json')).sort().map(f => ({ file: `${QUEUE}/${f}`, item: JSON.parse(readFileSync(`${QUEUE}/${f}`, 'utf8')) }));
}
function problems(item) {
  const p = [];
  for (const k of REQUIRED) if (item[k] == null || item[k] === '' || (Array.isArray(item[k]) && !item[k].length)) p.push(`missing ${k}`);
  if (item.text && weightedLength(item.text) > 270) p.push(`text too long (${weightedLength(item.text)} > 270 weighted)`);
  if (item.text && /https?:\/\//.test(item.text)) p.push('links belong in reply_text, not the main post');
  if (item.reply_text && weightedLength(item.reply_text) > 270) p.push('reply_text too long');
  if (item.not_before && isNaN(Date.parse(item.not_before))) p.push('not_before is not ISO');
  return p;
}
function posted() {
  if (!existsSync(POSTED)) return [];
  return readFileSync(POSTED, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

const cmd = process.argv[2] || 'validate';
if (cmd === 'validate') {
  let bad = 0;
  for (const { file, item } of queueItems()) {
    const p = problems(item);
    console.log(`${p.length ? 'FAIL' : 'ok  '} ${file} (${weightedLength(item.text || '')}w)${p.length ? ' — ' + p.join('; ') : ''}`);
    bad += p.length ? 1 : 0;
  }
  process.exit(bad ? 1 : 0);
}

const { X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
if (!X_API_KEY || !X_API_KEY_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) { console.log('x_phase2: X credentials not set — no-op.'); process.exit(0); }
const enc = s => encodeURIComponent(s).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function authHeader(method, url, params = {}) {
  const oauth = { oauth_consumer_key: X_API_KEY, oauth_nonce: randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(), oauth_token: X_ACCESS_TOKEN, oauth_version: '1.0' };
  const all = { ...oauth, ...params };
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(all).sort().map(k => `${enc(k)}=${enc(all[k])}`).join('&'))].join('&');
  oauth.oauth_signature = createHmac('sha1', `${enc(X_API_KEY_SECRET)}&${enc(X_ACCESS_TOKEN_SECRET)}`).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}
const TWEETS = 'https://api.twitter.com/2/tweets';
async function createTweet(text, replyTo) {
  const body = { text }; if (replyTo) body.reply = { in_reply_to_tweet_id: replyTo };
  const res = await fetch(TWEETS, { method: 'POST', headers: { Authorization: authHeader('POST', TWEETS), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.data?.id) throw new Error(`POST /2/tweets -> ${res.status} ${JSON.stringify(j)}`);
  return j.data.id;
}
async function getTweets(ids, fields) {
  const params = { ids: ids.join(','), 'tweet.fields': fields };
  const qs = Object.entries(params).map(([k, v]) => `${enc(k)}=${enc(v)}`).join('&');
  const res = await fetch(`${TWEETS}?${qs}`, { headers: { Authorization: authHeader('GET', TWEETS, params) } });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`GET /2/tweets -> ${res.status} ${JSON.stringify(j)}`);
  return j;
}

if (cmd === 'post') {
  const today = jstDate(nowMs());
  const doneToday = posted().filter(p => jstDate(Date.parse(p.posted_at)) === today).length;
  if (doneToday >= MAX_PER_DAY) { console.log(`x_phase2: ${doneToday} posts already today (${today}) — cap ${MAX_PER_DAY}.`); process.exit(0); }
  const due = queueItems().filter(({ item }) => Date.parse(item.not_before) <= nowMs());
  if (!due.length) { console.log('x_phase2: nothing due.'); process.exit(0); }
  const { file, item } = due[0];
  const p = problems(item);
  if (p.length) { console.error(`x_phase2: refusing ${file}: ${p.join('; ')}`); process.exit(1); }
  const id = await createTweet(item.text);
  const v = await getTweets([id], 'created_at,public_metrics,referenced_tweets');
  if (!v.data?.[0] || v.data[0].referenced_tweets) throw new Error(`tweet ${id} not verified as standalone`);
  let replyId = null, replyError = null;
  if (item.reply_text) { try { replyId = await createTweet(item.reply_text, id); } catch (e) { replyError = String(e.message).slice(0, 300); } }
  mkdirSync(DIR, { recursive: true });
  const rec = { posted_at: new Date(nowMs()).toISOString(), tweet_id: id, url: `https://x.com/KinoshitaTsks/status/${id}`, reply_id: replyId, reply_error: replyError,
    series: item.series, hypothesis: item.hypothesis, text: item.text, queue_file: file.split('/').pop() };
  appendFileSync(POSTED, JSON.stringify(rec) + '\n');
  unlinkSync(file);
  console.log('X_PHASE2_POSTED=' + JSON.stringify(rec));
  process.exit(0);
}

if (cmd === 'metrics') {
  const recent = posted().filter(p => nowMs() - Date.parse(p.posted_at) < 7 * 86400e3);
  const m = existsSync(METRICS) ? JSON.parse(readFileSync(METRICS, 'utf8')) : { _doc: 'Latest metrics per Phase-2 post (public + owner-only non_public). Refreshed by x-phase2.yml for posts < 7 days old.', posts: {} };
  if (!recent.length) { console.log('x_phase2: no recent posts.'); process.exit(0); }
  const j = await getTweets(recent.map(p => p.tweet_id), 'public_metrics,non_public_metrics,created_at');
  for (const t of j.data || []) {
    m.posts[t.id] = { ...(m.posts[t.id] || {}), created_at: t.created_at, fetched_at: new Date().toISOString(), public_metrics: t.public_metrics, non_public_metrics: t.non_public_metrics };
  }
  if (j.errors) m.last_errors = j.errors.slice(0, 5);
  const imps = Object.values(m.posts).map(p => p.public_metrics?.impression_count ?? p.non_public_metrics?.impression_count).filter(n => n != null).sort((a, b) => a - b);
  m.summary = { posts: imps.length, median_impressions: imps.length ? imps[Math.floor(imps.length / 2)] : null, updated_at: new Date().toISOString() };
  writeFileSync(METRICS, JSON.stringify(m, null, 2) + '\n');
  console.log('x_phase2 metrics: ' + JSON.stringify(m.summary));
}
