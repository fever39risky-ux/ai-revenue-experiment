#!/usr/bin/env node
/**
 * One-off (not a scheduled job): posts exactly ONE real-voice test reply,
 * as a direct reply to the pinned post (GitHub Actions Variable
 * X_ROOT_POST_ID), before social-x.yml's cron is re-enabled. This is
 * deliberately separate from scripts/post_x.mjs / social/queue -- it does
 * not touch the queue, and social-x.yml's schedule/push triggers stay
 * paused regardless of this script's outcome.
 *
 * Reads the post text from status/x_voice_test_post_draft.json (written
 * ahead of time, grounded in marketing/X_VOICE_CORPUS.md and
 * X_VOICE_GUIDE.md -- this script does not generate or alter the text).
 * On success, records the real tweet id/url back into that same file so
 * the result is auditable, not just logged.
 *
 * Needs the same OAuth 1.0a user-context secrets as scripts/post_x.mjs
 * (X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET)
 * plus the GitHub Actions Variable X_ROOT_POST_ID (the pinned post's
 * tweet id to reply under). No-ops cleanly if any are missing.
 */
import { readFileSync, writeFileSync } from 'fs';
import { createHmac, randomBytes } from 'crypto';

const { X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET, X_ROOT_POST_ID } = process.env;
if (!X_API_KEY || !X_API_KEY_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_TOKEN_SECRET) {
  console.log('x_post_voice_test: X credentials not set -- skipping (no-op).');
  process.exit(0);
}
if (!X_ROOT_POST_ID) {
  console.log('x_post_voice_test: X_ROOT_POST_ID (GitHub Actions Variable) not set -- skipping (no-op). Cannot guess the pinned post id.');
  process.exit(0);
}

const DRAFT = 'status/x_voice_test_post_draft.json';
const draft = JSON.parse(readFileSync(DRAFT, 'utf8'));
if (!draft.text) {
  console.error('x_post_voice_test: draft has no text field -- stopping.');
  process.exit(1);
}
if (draft.posted_at) {
  console.log(`x_post_voice_test: draft already has posted_at=${draft.posted_at} (tweet ${draft.tweet_id}) -- skipping to avoid a duplicate post (idempotent no-op).`);
  process.exit(0);
}

const enc = s => encodeURIComponent(s).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

function authHeader(method, url) {
  const oauth = {
    oauth_consumer_key: X_API_KEY,
    oauth_nonce: randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: X_ACCESS_TOKEN,
    oauth_version: '1.0',
  };
  const base = [method.toUpperCase(), enc(url),
    enc(Object.keys(oauth).sort().map(k => `${enc(k)}=${enc(oauth[k])}`).join('&'))].join('&');
  const key = `${enc(X_API_KEY_SECRET)}&${enc(X_ACCESS_TOKEN_SECRET)}`;
  oauth.oauth_signature = createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

console.log(`x_post_voice_test: posting as a reply to root post ${X_ROOT_POST_ID}. Text (${[...draft.text].length} chars):`);
console.log('--------------------------------------------------');
console.log(draft.text);
console.log('--------------------------------------------------');

const url = 'https://api.twitter.com/2/tweets';
const res = await fetch(url, {
  method: 'POST',
  headers: { Authorization: authHeader('POST', url), 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: draft.text, reply: { in_reply_to_tweet_id: X_ROOT_POST_ID } }),
});
const body = await res.json().catch(() => ({}));
console.log(`POST /2/tweets -> ${res.status}`);
console.log(JSON.stringify(body, null, 2));

if (!res.ok || !body.data?.id) {
  console.error('x_post_voice_test: post failed -- see the real response above. Not retrying automatically.');
  process.exit(1);
}

const tweetId = body.data.id;
const tweetUrl = `https://x.com/KinoshitaTsks/status/${tweetId}`;
const updated = { ...draft, posted_at: new Date().toISOString(), tweet_id: tweetId, tweet_url: tweetUrl, in_reply_to_tweet_id: X_ROOT_POST_ID };
writeFileSync(DRAFT, JSON.stringify(updated, null, 2) + '\n');
console.log(`x_post_voice_test: posted successfully -- ${tweetUrl}`);
