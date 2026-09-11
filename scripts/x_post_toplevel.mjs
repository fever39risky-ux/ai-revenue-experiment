#!/usr/bin/env node
/**
 * Mechanical drain-and-post step for AI Revenue Experiment TOP-LEVEL
 * (standalone) X posts -- the reach-capable acquisition mechanism authorized
 * by the owner's 2026-09-11 account-usage grant (see ops/LOOP_PROTOCOL.md §9
 * "Top-level acquisition posts"). Kept deliberately separate from the
 * reply-thread commentary poster (scripts/x_post_experiment_commentary.mjs)
 * so that pipeline is never touched.
 *
 * Judgment (is today worth a top-level post? what does it say?) belongs to the
 * daily session, which -- only when it judges there is genuine acquisition
 * value -- writes social/x_experiment_next_toplevel.json grounded in
 * marketing/X_VOICE_GUIDE.md (Register C), with a completed 14-item voice
 * self-check. This script only does ONE thing: if that queue entry exists and
 * today (Asia/Tokyo) has not already posted a top-level post, create a
 * STANDALONE tweet (no in_reply_to) with its text, verify via a real 2nd GET
 * that the tweet exists and is genuinely standalone (no replied_to reference),
 * capture a baseline public_metrics snapshot, record to
 * social/x_experiment_history.json, and remove the queue file. It never posts
 * more than once per Asia/Tokyo day, never replies to anyone, never DMs.
 *
 * Prints a single machine-readable `TOPLEVEL_RESULT=<json>` line on success so
 * a caller can record the result even when this runs on a non-committing CI
 * runner. No-ops cleanly (exit 0) when nothing is queued or already posted;
 * exits 1 only on a genuine failure (missing required field, over-length, or a
 * failed/uncertain post) so the caller can see something went wrong.
 *
 * Needs OAuth 1.0a user-context secrets: X_API_KEY, X_API_KEY_SECRET,
 * X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET. No X_ROOT_POST_ID (top-level posts
 * are not replies). No-ops cleanly if credentials are missing.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { createHmac, randomBytes } from 'crypto';

const { X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET } = process.env;
if (!X_API_KEY || !X_API_KEY_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
  console.log('x_post_toplevel: X credentials not set -- skipping (no-op).');
  process.exit(0);
}

const QUEUE = 'social/x_experiment_next_toplevel.json';
const HISTORY = 'social/x_experiment_history.json';

if (!existsSync(QUEUE)) {
  console.log('x_post_toplevel: nothing queued -- no top-level post judged worthwhile today. Expected and fine. No-op.');
  process.exit(0);
}

const history = JSON.parse(readFileSync(HISTORY, 'utf8'));
function todayJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
const today = todayJST();

// 1/day cap is enforced PER POST TYPE (canon): only top-level posts block a
// top-level post. Reply-thread commentary entries do not.
if (history.posts.some(p => p.date === today && p.post_type === 'top_level')) {
  console.log(`x_post_toplevel: already posted a top-level post today (${today}) -- same-day idempotency guard. No-op, queue left untouched.`);
  process.exit(0);
}

const queued = JSON.parse(readFileSync(QUEUE, 'utf8'));
if (queued.date && queued.date !== today) {
  console.log(`x_post_toplevel: queued entry is dated ${queued.date}, not today (${today}) -- stale, not posting. Review and update/remove it.`);
  process.exit(0);
}
for (const field of ['text', 'register_targeted', 'topic_chosen', 'referenced_corpus_examples', 'voice_fingerprint_self_check']) {
  if (!queued[field]) {
    console.error(`x_post_toplevel: queued entry missing required field "${field}" -- refusing to post an ungrounded/unchecked draft.`);
    process.exit(1);
  }
}

function weightedLength(s) {
  let w = 0;
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    w += (cp > 0x10FF && !(cp >= 0x2000 && cp <= 0x206F)) ? 2 : 1;
  }
  return w;
}
const wlen = weightedLength(queued.text);
if (wlen > 270) {
  console.error(`x_post_toplevel: queued text too long (approx weighted length ${wlen}, budget 270 for margin under X's 280) -- refusing to post/truncate. Shorten and re-queue.`);
  process.exit(1);
}

const enc = s => encodeURIComponent(s).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function authHeader(method, url, params = {}) {
  const oauth = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  const allParams = { ...oauth, ...params };
  const base = [method.toUpperCase(), enc(url),
    enc(Object.keys(allParams).sort().map(k => `${enc(k)}=${enc(allParams[k])}`).join('&'))].join('&');
  const key = `${enc(X_API_KEY_SECRET)}&${enc(X_ACCESS_TOKEN_SECRET)}`;
  oauth.oauth_signature = createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

console.log(`x_post_toplevel: posting today's (${today}) STANDALONE top-level tweet. Topic: ${queued.topic_chosen}`);
console.log('--------------------------------------------------');
console.log(queued.text);
console.log('--------------------------------------------------');

const postUrl = 'https://api.twitter.com/2/tweets';
const postRes = await fetch(postUrl, {
  method: 'POST',
  headers: { Authorization: authHeader('POST', postUrl), 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: queued.text }), // NO reply field -- standalone top-level tweet.
});
const postBody = await postRes.json().catch(() => ({}));
console.log(`POST /2/tweets -> ${postRes.status}`);
console.log(JSON.stringify(postBody, null, 2));
if (!postRes.ok || !postBody.data?.id) {
  console.error('x_post_toplevel: post failed -- see the real response above. Queue left in place; not recording.');
  process.exit(1);
}
const tweetId = postBody.data.id;

// Independent verification: confirm the tweet exists AND is genuinely
// standalone (no replied_to reference), plus grab a baseline metrics snapshot.
const getPath = `/2/tweets/${tweetId}`;
const getParams = { 'tweet.fields': 'referenced_tweets,created_at,public_metrics,author_id,conversation_id' };
const getUrl = `https://api.twitter.com${getPath}`;
const qs = new URLSearchParams(getParams).toString();
const vRes = await fetch(`${getUrl}?${qs}`, { headers: { Authorization: authHeader('GET', getUrl, getParams) } });
const vBody = await vRes.json().catch(() => ({}));
console.log(`GET ${getPath} -> ${vRes.status}`);
console.log(JSON.stringify(vBody, null, 2));
if (vRes.status !== 200 || vBody.data?.id !== tweetId) {
  console.error(`x_post_toplevel: PARTIAL FAILURE -- tweet ${tweetId} created but could not be verified via GET. Needs human/agent review before recording.`);
  process.exit(1);
}
const repliedTo = (vBody.data.referenced_tweets || []).find(r => r.type === 'replied_to');
if (repliedTo) {
  console.error(`x_post_toplevel: PARTIAL FAILURE -- tweet ${tweetId} unexpectedly has a replied_to reference (${repliedTo.id}); it is NOT standalone. Needs review.`);
  process.exit(1);
}
console.log(`x_post_toplevel: CONFIRMED standalone (no replied_to reference).`);

const tweetUrl = `https://x.com/KinoshitaTsks/status/${tweetId}`;
const baseline = vBody.data.public_metrics || {};
const entry = {
  date: today,
  post_type: 'top_level',
  tweet_id: tweetId,
  tweet_url: tweetUrl,
  in_reply_to_tweet_id: null,
  text: queued.text,
  topic: queued.topic_chosen,
  register: queued.register_targeted,
  posted_at: new Date().toISOString(),
  posted_via: 'scripts/x_post_toplevel.mjs',
  baseline_public_metrics: baseline,
};
history.posts.push(entry);
writeFileSync(HISTORY, JSON.stringify(history, null, 2) + '\n');
unlinkSync(QUEUE);
console.log(`x_post_toplevel: posted and recorded -- ${tweetUrl}`);
console.log('TOPLEVEL_RESULT=' + JSON.stringify({ tweet_id: tweetId, tweet_url: tweetUrl, created_at: vBody.data.created_at, baseline_public_metrics: baseline, posted_at: entry.posted_at }));
