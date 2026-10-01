import { createHmac, randomBytes } from 'node:crypto';
const enc = s => encodeURIComponent(s).replace(/[!*'()]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
export function xApi(env = process.env, transport = fetch) {
  const names = ['X_API_KEY', 'X_API_KEY_SECRET', 'X_ACCESS_TOKEN', 'X_ACCESS_TOKEN_SECRET'];
  if (names.some(n => !env[n])) throw new Error('existing_oauth1_credentials_missing');
  async function request(method, path, body, params = {}) {
    const url = `https://api.x.com${path}`;
    const oauth = { oauth_consumer_key: env.X_API_KEY, oauth_token: env.X_ACCESS_TOKEN, oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_nonce: randomBytes(16).toString('hex'), oauth_version: '1.0' };
    const pairs = Object.entries({ ...oauth, ...params }).map(([k, v]) => [enc(k), enc(v)]).sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0));
    const base = [method, enc(url), enc(pairs.map(([k, v]) => `${k}=${v}`).join('&'))].join('&');
    oauth.oauth_signature = createHmac('sha1', `${enc(env.X_API_KEY_SECRET)}&${enc(env.X_ACCESS_TOKEN_SECRET)}`).update(base).digest('base64');
    const auth = 'OAuth ' + Object.entries(oauth).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(', ');
    const qs = new URLSearchParams(params).toString();
    let r;
    try { r = await transport(url + (qs ? `?${qs}` : ''), { method, headers: { Authorization: auth, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000), redirect: 'error' }); }
    catch { throw new Error('x_transport_unknown'); }
    if (!r.ok) { const e = new Error(`x_http_${r.status}`); e.definitive = [400, 401, 403, 404, 413, 415, 422, 429].includes(r.status); throw e; }
    let j; try { j = await r.json(); } catch { throw new Error('x_invalid_response'); }
    if (j.errors?.length && !(method === 'POST' && path === '/2/tweets' && j.data?.id)) throw new Error('x_partial_error');
    return j;
  }
  return {
    create: async body => (await request('POST', '/2/tweets', body)).data?.id,
    upload: async bytes => (await request('POST', '/2/media/upload', { media: bytes.toString('base64'), media_category: 'tweet_image' })).data,
    get: id => request('GET', `/2/tweets/${id}`, null, { 'tweet.fields': 'note_tweet,entities,attachments,author_id,created_at,public_metrics,referenced_tweets', expansions: 'attachments.media_keys', 'media.fields': 'media_key,type,url' })
  };
}
