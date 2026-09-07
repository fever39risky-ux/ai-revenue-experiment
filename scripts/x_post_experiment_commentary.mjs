#!/usr/bin/env node
/**
 * Mechanical drain-and-post step for the AI Revenue Experiment's X reply
 * thread. Deliberately dumb: it does NOT decide whether today is worth
 * posting, and it does NOT write post text. Judgment (is there a real new
 * fact/change/failure/decision/insight worth reporting? what should it
 * say?) belongs to the daily autonomous session, which -- only on a day it
 * judges worthwhile -- writes social/x_experiment_next_post.json (grounded
 * in marketing/X_VOICE_CORPUS.md / X_VOICE_GUIDE.md / x_voice_examples.json,
 * register C prioritized for experiment commentary, with a completed
 * Voice-fingerprint self-check). See ops/AGENT_LOOP.md's "X posting
 * policy" section for the full judgment criteria.
 *
 * This script only ever does ONE thing: if a same-day queue entry exists
 * and today hasn't already posted, reply to X_ROOT_POST_ID with its text,
 * verify the reply actually threaded (a real 2nd GET call, not assumed
 * from the POST's own success), and record the result. It never replies
 * to any other tweet, never DMs, never posts more than once per Asia/Tokyo
 * calendar day, and no-ops cleanly and silently when there is nothing
 * queued -- a quiet day is a valid, expected outcome, not an error.
 *
 * Needs OAuth 1.0a user-context secrets (X_API_KEY, X_API_KEY_SECRET,
 * X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET) and the GitHub Actions Variable
 * X_ROOT_POST_ID. No-ops cleanly if any are missing.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { createHmac, randomBytes } from 'crypto';

const { X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET, X_ROOT_POST_ID } = process.env;
if (!X_API_KEY || !X_API_KEY_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
  console.log('x_post_experiment_commentary: X credentials not set -- skipping (no-op).');
  process.exit(0);
}
if (!X_ROOT_POST_ID) {
  console.log('x_post_experiment_commentary: X_ROOT_POST_ID not set -- skipping (no-op).');
  process.exit(0);
}

const QUEUE = 'social/x_experiment_next_post.json';
const HISTORY = 'social/x_experiment_history.json';

if (!existsSync(QUEUE)) {
  console.log('x_post_experiment_commentary: nothing queued -- today was not judged post-worthy (or no judgment has run yet). This is expected and fine. No-op.');
  process.exit(0);
}

const history = JSON.parse(readFileSync(HISTORY, 'utf8'));

// Asia/Tokyo calendar date, matching the experiment's own day boundary convention.
function todayJST() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
const today = todayJST();

if (history.posts.some(p => p.date === today)) {
  console.log(`x_post_experiment_commentary: already posted today (${today}) -- same-day idempotency guard. No-op, queue file left untouched for inspection.`);
  process.exit(0);
}

const queued = JSON.parse(readFileSync(QUEUE, 'utf8'));

if (queued.date && queued.date !== today) {
  console.log(`x_post_experiment_commentary: queued entry is dated ${queued.date}, not today (${today}) -- stale, not posting. A human/agent should review and either update or remove it.`);
  process.exit(0);
}

for (const field of ['text', 'register_targeted', 'topic_chosen', 'referenced_corpus_examples', 'voice_fingerprint_self_check']) {
  if (!queued[field]) {
    console.error(`x_post_experiment_commentary: queued entry is missing required field "${field}" -- refusing to post an ungrounded/unchecked draft.`);
    process.exit(1);
  }
}

// Weighted-length guard: CJK/kana/hangul/fullwidth codepoints weigh 2
// towards X's 280 limit -- an approximation, kept conservative on purpose.
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
  console.error(`x_post_experiment_commentary: queued text is too long (approx weighted length ${wlen}, budget 270 for safety margin under X's 280 limit) -- refusing to post/truncate. Shorten and re-queue.`);
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

console.log(`x_post_experiment_commentary: posting today's (${today}) queued reply to root ${X_ROOT_POST_ID}. Topic: ${queued.topic_chosen}`);
console.log('--------------------------------------------------');
console.log(queued.text);
console.log('--------------------------------------------------');

const postUrl = 'https://api.twitter.com/2/tweets';
const postRes = await fetch(postUrl, {
  method: 'POST',
  headers: { Authorization: authHeader('POST', postUrl), 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: queued.text, reply: { in_reply_to_tweet_id: X_ROOT_POST_ID } }),
});
const postBody = await postRes.json().catch(() => ({}));
console.log(`POST /2/tweets -> ${postRes.status}`);
console.log(JSON.stringify(postBody, null, 2));

if (!postRes.ok || !postBody.data?.id) {
  console.error('x_post_experiment_commentary: post failed -- see the real response above. Queue entry left in place; not marking today as posted.');
  process.exit(1);
}
const tweetId = postBody.data.id;

// Independent verification -- a 201 only proves a tweet was created, not
// that the reply threaded correctly. Confirm via a real, separate GET.
const getPath = `/2/tweets/${tweetId}`;
const getParams = { 'tweet.fields': 'referenced_tweets' };
const getUrl = `https://api.twitter.com${getPath}`;
const qs = new URLSearchParams(getParams).toString();
const verifyRes = await fetch(`${getUrl}?${qs}`, { headers: { Authorization: authHeader('GET', getUrl, getParams) } });
const verifyBody = await verifyRes.json().catch(() => ({}));
console.log(`GET ${getPath} -> ${verifyRes.status}`);
console.log(JSON.stringify(verifyBody, null, 2));

const repliedTo = (verifyBody.data?.referenced_tweets || []).find(r => r.type === 'replied_to');
if (repliedTo?.id !== X_ROOT_POST_ID) {
  console.error(`x_post_experiment_commentary: PARTIAL FAILURE -- tweet ${tweetId} was created but verification did NOT confirm it is threaded under X_ROOT_POST_ID (found: ${repliedTo?.id || 'none'}). Not marking today as posted automatically -- needs human/agent review of tweet ${tweetId} before deciding how to record it.`);
  process.exit(1);
}
console.log(`x_post_experiment_commentary: CONFIRMED threaded correctly under X_ROOT_POST_ID.`);

const tweetUrl = `https://x.com/KinoshitaTsks/status/${tweetId}`;
history.posts.push({
  date: today,
  tweet_id: tweetId,
  tweet_url: tweetUrl,
  in_reply_to_tweet_id: X_ROOT_POST_ID,
  text: queued.text,
  topic: queued.topic_chosen,
  register: queued.register_targeted,
  posted_at: new Date().toISOString(),
  posted_via: 'scripts/x_post_experiment_commentary.mjs',
});
writeFileSync(HISTORY, JSON.stringify(history, null, 2) + '\n');
unlinkSync(QUEUE);
console.log(`x_post_experiment_commentary: posted and recorded -- ${tweetUrl}`);
