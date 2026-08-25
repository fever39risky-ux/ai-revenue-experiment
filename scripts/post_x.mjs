#!/usr/bin/env node
/**
 * X (Twitter) live-commentary poster — runs in GitHub Actions (open egress).
 * Queue-based: the AI writes pending posts as social/queue/*.json during its
 * sessions; this script posts any unposted ones and archives them. This
 * decouples authoring (AI) from the posting runtime (Actions) — the owner is
 * never a copy-paste operator (per the Social Live Protocol).
 *
 * Needs OAuth 1.0a user-context secrets (one-time grant, added as repo secrets):
 *   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET
 * If any are absent, it no-ops cleanly.
 *
 * Queue item schema (social/queue/<id>.json): { "text": "...", "ref": "optional" }
 * On success the item is moved to social/posted/<id>.json with the tweet id.
 */
import { readdirSync, readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync } from 'fs';
import { createHmac, randomBytes } from 'crypto';

const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
  console.log('post_x: X credentials not set — skipping (no-op).'); process.exit(0);
}

const QUEUE = 'social/queue', POSTED = 'social/posted';
mkdirSync(QUEUE, { recursive: true }); mkdirSync(POSTED, { recursive: true });

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
  const key = `${enc(X_API_SECRET)}&${enc(X_ACCESS_SECRET)}`;
  oauth.oauth_signature = createHmac('sha1', key).update(base).digest('base64');
  return 'OAuth ' + Object.keys(oauth).sort().map(k => `${enc(k)}="${enc(oauth[k])}"`).join(', ');
}

async function tweet(text) {
  const url = 'https://api.twitter.com/2/tweets';
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader('POST', url), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`X ${res.status} ${JSON.stringify(body)}`);
  return body.data?.id;
}

const items = readdirSync(QUEUE).filter(f => f.endsWith('.json')).sort();
if (!items.length) { console.log('post_x: queue empty.'); process.exit(0); }

let posted = 0;
for (const f of items) {
  const p = `${QUEUE}/${f}`;
  let item;
  try { item = JSON.parse(readFileSync(p, 'utf8')); } catch { console.log('skip bad', f); continue; }
  const text = (item.text || '').slice(0, 280);
  if (!text) { unlinkSync(p); continue; }
  try {
    const id = await tweet(text);
    writeFileSync(`${POSTED}/${f}`, JSON.stringify({ ...item, tweet_id: id, posted_at: new Date().toISOString() }, null, 2) + '\n');
    unlinkSync(p);
    posted++;
    console.log(`posted ${f} -> tweet ${id}`);
  } catch (e) {
    console.error(`failed ${f}: ${e.message}`);
  }
}
console.log(`post_x: ${posted}/${items.length} posted.`);
