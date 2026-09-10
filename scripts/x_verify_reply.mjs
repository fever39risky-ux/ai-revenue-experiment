#!/usr/bin/env node
/**
 * One-off verification (not a scheduled job): confirms, via a real GET
 * call, that a specific tweet is actually threaded as a reply under a
 * specific root post -- not assumed from the POST response alone (a 201
 * only confirms the tweet was created, not that in_reply_to was honored).
 *
 * Needs env X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN,
 * X_ACCESS_TOKEN_SECRET, X_TWEET_ID (the tweet to check), X_ROOT_POST_ID
 * (the expected parent). No-ops cleanly if any are missing.
 */
import { createHmac, randomBytes } from 'crypto';

const { X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET, X_TWEET_ID, X_ROOT_POST_ID } = process.env;
if (!X_API_KEY || !X_API_KEY_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
  console.log('x_verify_reply: X credentials not set -- skipping (no-op).');
  process.exit(0);
}
if (!X_TWEET_ID || !X_ROOT_POST_ID) {
  console.log('x_verify_reply: X_TWEET_ID or X_ROOT_POST_ID not set -- skipping (no-op).');
  process.exit(0);
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

const path = `/2/tweets/${X_TWEET_ID}`;
const params = { 'tweet.fields': 'in_reply_to_user_id,referenced_tweets,conversation_id,author_id' };
const url = `https://api.twitter.com${path}`;
const qs = new URLSearchParams(params).toString();
const res = await fetch(`${url}?${qs}`, { headers: { Authorization: authHeader('GET', url, params) } });
const body = await res.json().catch(() => ({}));
console.log(`GET ${path} -> ${res.status}`);
console.log(JSON.stringify(body, null, 2));

const refs = body.data?.referenced_tweets || [];
const repliedTo = refs.find(r => r.type === 'replied_to');
console.log(`\nExpected root post: ${X_ROOT_POST_ID}`);
console.log(`Actual replied_to (referenced_tweets, type=replied_to): ${repliedTo?.id || 'NONE FOUND'}`);
if (repliedTo?.id === X_ROOT_POST_ID) {
  console.log('x_verify_reply: CONFIRMED -- tweet is threaded directly under X_ROOT_POST_ID.');
} else {
  console.log('x_verify_reply: NOT CONFIRMED -- referenced_tweets does not show a replied_to match to X_ROOT_POST_ID. Do not assume success.');
}

// --- Engagement metrics read (added 2026-09-10) --------------------------
// Reads the tweet's engagement so a daily session can read the result of a
// distribution test. url_link_clicks + impression_count live in
// non_public/organic metrics (OAuth 1.0a user context, own tweet, <30 days).
// Falls back to public_metrics only if the fuller request is rejected.
// Prints aggregate numbers only -- no PII, no tweet text, no tokens.
async function readMetrics(fields) {
  const p = { 'tweet.fields': fields };
  const q = new URLSearchParams(p).toString();
  const r = await fetch(`${url}?${q}`, { headers: { Authorization: authHeader('GET', url, p) } });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
let m = await readMetrics('public_metrics,non_public_metrics,organic_metrics,created_at');
if (m.status !== 200) {
  console.log(`\nx_verify_reply metrics: full read -> ${m.status} (likely access tier/credits); falling back to public_metrics only.`);
  m = await readMetrics('public_metrics,created_at');
}
console.log(`\n--- engagement metrics: GET /2/tweets/${X_TWEET_ID} -> ${m.status} ---`);
if (m.status === 200) {
  const md = m.body.data || {};
  const pub = md.public_metrics || {}, nonpub = md.non_public_metrics || {}, org = md.organic_metrics || {};
  const impressions = pub.impression_count ?? nonpub.impression_count ?? org.impression_count ?? null;
  const linkClicks = org.url_link_clicks ?? nonpub.url_link_clicks ?? null;
  console.log('created_at         :', md.created_at || 'n/a');
  console.log('impressions        :', impressions ?? 'n/a');
  console.log('url_link_clicks    :', linkClicks ?? 'n/a (needs non_public/organic access)');
  console.log('user_profile_clicks:', org.user_profile_clicks ?? nonpub.user_profile_clicks ?? 'n/a');
  console.log('likes/replies/reposts/quotes/bookmarks:',
    `${pub.like_count ?? '?'}/${pub.reply_count ?? '?'}/${pub.retweet_count ?? '?'}/${pub.quote_count ?? '?'}/${pub.bookmark_count ?? '?'}`);
  console.log('public_metrics     :', JSON.stringify(pub));
  console.log('non_public_metrics :', JSON.stringify(nonpub));
  console.log('organic_metrics    :', JSON.stringify(org));
} else {
  console.log('metrics read failed; body:', JSON.stringify(m.body));
}
