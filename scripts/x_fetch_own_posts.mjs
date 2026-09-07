#!/usr/bin/env node
/**
 * One-off fetch (not a scheduled job): pulls @KinoshitaTsks's own real past
 * posts from the official X API v2, as the primary source for building a
 * real-voice corpus (marketing/X_VOICE_CORPUS.md / X_VOICE_GUIDE.md /
 * x_voice_examples.json). Writes the raw, unmodified API response fields to
 * status/x_own_posts_raw.json so a later step can classify/analyze from the
 * real text -- this script does NOT rewrite, summarize, or guess at any
 * post content.
 *
 * Auth: same OAuth 1.0a user-context secrets as scripts/post_x.mjs
 * (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET). No-ops
 * cleanly if any are missing.
 *
 * Retweets are excluded via the API's own exclude=retweets param (not a
 * heuristic). Replies are kept (with in_reply_to_user_id / referenced_tweets
 * so reply-to-self-thread vs reply-to-others can be told apart mechanically,
 * from real API fields, not guessed).
 *
 * Every HTTP status, error body, and rate-limit header actually returned is
 * logged verbatim so cost/limits can be recorded honestly in cost_ledger.json
 * -- nothing about pricing or quota is assumed ahead of the real response.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { createHmac, randomBytes } from 'crypto';

const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
  console.log('x_fetch_own_posts: X credentials not set -- skipping (no-op).');
  process.exit(0);
}

const USERNAME = process.env.X_VOICE_USERNAME || 'KinoshitaTsks';
const TARGET_COUNT = Number(process.env.X_VOICE_TARGET_COUNT || '150');
const MAX_PAGES = Number(process.env.X_VOICE_MAX_PAGES || '3');
const OUT = 'status/x_own_posts_raw.json';

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
  const key = `${enc(X_API_SECRET)}&${enc(X_ACCESS_SECRET)}`;
  oauth.oauth_signature = createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

function rateLimitInfo(res) {
  const g = h => res.headers.get(h);
  return {
    limit: g('x-rate-limit-limit'),
    remaining: g('x-rate-limit-remaining'),
    reset: g('x-rate-limit-reset'),
  };
}

async function apiGet(path, params) {
  const url = `https://api.twitter.com${path}`;
  const qs = new URLSearchParams(params).toString();
  const fullUrl = qs ? `${url}?${qs}` : url;
  const res = await fetch(fullUrl, { headers: { Authorization: authHeader('GET', url, params) } });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, body, rateLimit: rateLimitInfo(res) };
}

console.log(`x_fetch_own_posts: looking up user @${USERNAME} via GET /2/users/by/username/${USERNAME}`);
const userRes = await apiGet(`/2/users/by/username/${USERNAME}`, { 'user.fields': 'created_at,public_metrics' });
console.log(`GET /2/users/by/username/${USERNAME} -> ${userRes.status}`);
console.log(JSON.stringify(userRes.body, null, 2));
console.log(`rate limit: ${JSON.stringify(userRes.rateLimit)}`);
if (!userRes.ok || !userRes.body?.data?.id) {
  console.error('x_fetch_own_posts: could not resolve user id -- stopping. See the real response above for the reason (auth, access tier, username, etc).');
  process.exit(1);
}
const user = userRes.body.data;
console.log(`x_fetch_own_posts: resolved user id=${user.id} name="${user.name}"`);

const posts = [];
let paginationToken;
let page = 0;
let lastRateLimit = null;
while (page < MAX_PAGES && posts.length < TARGET_COUNT) {
  page++;
  const params = {
    max_results: '100',
    exclude: 'retweets',
    'tweet.fields': 'created_at,public_metrics,referenced_tweets,in_reply_to_user_id,conversation_id,note_tweet,entities,lang',
  };
  if (paginationToken) params.pagination_token = paginationToken;
  const res = await apiGet(`/2/users/${user.id}/tweets`, params);
  lastRateLimit = res.rateLimit;
  console.log(`\n=== page ${page}: GET /2/users/${user.id}/tweets -> ${res.status} (rate limit: ${JSON.stringify(res.rateLimit)}) ===`);
  if (!res.ok) {
    console.error(`x_fetch_own_posts: page ${page} failed -- real error body:`);
    console.error(JSON.stringify(res.body, null, 2));
    break;
  }
  const pageData = res.body.data || [];
  console.log(`page ${page}: ${pageData.length} posts returned (meta: ${JSON.stringify(res.body.meta || {})})`);
  posts.push(...pageData);
  paginationToken = res.body.meta?.next_token;
  if (!paginationToken) { console.log('x_fetch_own_posts: no further pages available.'); break; }
}

console.log(`\nx_fetch_own_posts: fetched ${posts.length} non-retweet posts across ${page} page(s).`);

mkdirSync('status', { recursive: true });
writeFileSync(OUT, JSON.stringify({
  fetched_at: new Date().toISOString(),
  username: USERNAME,
  user_id: user.id,
  user_name: user.name,
  requested_target_count: TARGET_COUNT,
  pages_fetched: page,
  last_rate_limit: lastRateLimit,
  post_count: posts.length,
  posts,
}, null, 2) + '\n');
console.log(`x_fetch_own_posts: wrote ${OUT} (${posts.length} real posts, unmodified API fields).`);
