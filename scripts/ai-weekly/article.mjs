// Isolated offline article adapter. No CLI, workflow, secret loading, or automatic fetch.
import { createHash, createHmac } from 'node:crypto';
import { readFileSync, openSync, closeSync, writeFileSync, fsyncSync, renameSync, unlinkSync } from 'node:fs';
import { dirname } from 'node:path';
import { execFileSync } from 'node:child_process';

export const LIVE_ENABLED = false;
export const sha256 = value => createHash('sha256').update(value).digest('hex');
const check = (ok, message) => { if (!ok) throw new Error(message); };
const clone = value => JSON.parse(JSON.stringify(value));
const digest = value => sha256(JSON.stringify(value));
const idOK = value => typeof value === 'string' && /^[0-9]+$/.test(value);
const hashOK = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

// Input uses explicit blocks; no lossy Markdown inference or Unicode normalization.
// Offsets are JS UTF-16 units, as in DraftJS. source_links appear literally in text.
export function compile(input) {
  check(/^AI-WEEKLY-\d{4}-\d{2}-\d{2}$/.test(input.week_id), 'week_id required');
  check(typeof input.title === 'string' && input.title.trim(), 'title required');
  check(Array.isArray(input.blocks) && input.blocks.length > 0, 'blocks required');
  check(Array.isArray(input.source_links) && input.source_links.length === 5 && new Set(input.source_links).size === 5, 'exactly five unique source links required');
  const supplemental=input.supplemental_source_links ?? [];
  check(Array.isArray(supplemental), 'supplemental links must be an array');
  const allLinks=[...input.source_links,...supplemental];
  check(new Set(allLinks).size===allLinks.length,'duplicate source links');
  for (const url of allLinks) {
    const parsed = new URL(url);
    check(parsed.protocol === 'https:' && !parsed.username && !parsed.password && !/\s/.test(url), 'HTTPS source URL required');
  }
  const entities = [];
  const blocks = input.blocks.map((block, index) => {
    check(['paragraph','heading1','heading2','heading3'].includes(block.kind), 'unsupported block kind');
    check(typeof block.text === 'string' && !block.text.includes('\r'), 'text must preserve LF line endings');
    const ranges = [];
    for (const url of allLinks) {
      let offset = block.text.indexOf(url);
      while (offset !== -1) {
        const key = entities.length;
        entities.push({key: String(key), value: {type:'link', mutability:'mutable', data:{url}}});
        ranges.push({key, offset, length:url.length});
        offset = block.text.indexOf(url, offset + url.length);
      }
    }
    ranges.sort((a,b)=>a.offset-b.offset);
    for (let i=1;i<ranges.length;i++) check(ranges[i-1].offset+ranges[i-1].length <= ranges[i].offset,'overlapping source URLs');
    return {key:`b${index}`, type: {paragraph:'unstyled', heading1:'header-one', heading2:'header-two', heading3:'header-three'}[block.kind], text:block.text, entity_ranges:ranges, inline_style_ranges:[]};
  });
  const text = blocks.map(b=>b.text).join('\n\n');
  check(input.body_text === text, 'body_text must exactly match block text joined by two LF');
  for (const url of allLinks) check(entities.some(e=>e.value.data.url===url), 'source link missing from body');
  const payload = {title:input.title,content_state:{blocks,entities}};
  // Require verified local image bytes; never claim an image hash from an unchecked string.
  check(hashOK(input.image_sha256), 'image_sha256 required');
  const body_sha256 = sha256(text);
  if (input.body_sha256 !== undefined) check(input.body_sha256===body_sha256,'body hash mismatch');
  if (input.cover_media) {
    check(idOK(input.cover_media.media_id) && input.cover_media.media_category==='tweet_image','invalid cover_media');
    payload.cover_media={media_category:'tweet_image',media_id:input.cover_media.media_id};
  }
  if (input.cover_media) {
    check(input.media_receipt?.media_id===input.cover_media.media_id && input.media_receipt?.image_sha256===input.image_sha256, 'media receipt must bind ID to image hash');
    check(typeof input.media_receipt.evidence==='string' && input.media_receipt.evidence.trim() && Number.isFinite(Date.parse(input.media_receipt.expires_at)), 'media evidence and expiry required');
  }
  return {week_id:input.week_id,body_sha256,image_sha256:input.image_sha256,payload_sha256:digest(payload),payload,media_receipt:input.media_receipt ? clone(input.media_receipt) : null};
}

export function verifyImage(prepared, bytes) {
  check(Buffer.isBuffer(bytes) && bytes.length>0 && sha256(bytes)===prepared.image_sha256,'image bytes/hash mismatch');
}

// Reuse only the four existing OAuth1 env names; caller supplies env explicitly.
// Never loads process.env, logs headers, or adds authentication scopes.
export function oauth1Headers(url, env, {nonce,timestamp}) {
  check(/^https:\/\/api\.x\.com\/2\/articles\/(draft|[0-9]+\/publish)$/.test(url),'endpoint not allowed');
  const names=['X_API_KEY','X_API_KEY_SECRET','X_ACCESS_TOKEN','X_ACCESS_TOKEN_SECRET'];
  check(names.every(k=>typeof env[k]==='string' && env[k]),'existing OAuth1 credentials missing');
  check(typeof nonce==='string' && nonce && /^\d+$/.test(String(timestamp)),'nonce/timestamp required');
  const enc = s => encodeURIComponent(s).replace(/[!*'()]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
  const p={oauth_consumer_key:env.X_API_KEY,oauth_nonce:nonce,oauth_signature_method:'HMAC-SHA1',oauth_timestamp:String(timestamp),oauth_token:env.X_ACCESS_TOKEN,oauth_version:'1.0'};
  const normalized=Object.keys(p).sort().map(k=>`${enc(k)}=${enc(p[k])}`).join('&');
  p.oauth_signature=createHmac('sha1',`${enc(env.X_API_KEY_SECRET)}&${enc(env.X_ACCESS_TOKEN_SECRET)}`).update(['POST',enc(url),enc(normalized)].join('&')).digest('base64');
  return {'Content-Type':'application/json',Authorization:'OAuth '+Object.keys(p).sort().map(k=>`${enc(k)}="${enc(p[k])}"`).join(', ')};
}

// File state is never silently initialized. Parent supplies a reviewed empty ledger.
// Lock covers the full operation including durable acknowledgements and HTTP.
// A crash leaves the lock AND intent in place; automatic lock removal is forbidden.
export class FileLedger {
  constructor(path) {this.path=path;}
  async transaction(fn) {
    const lock=openSync(this.path+'.lock','wx',0o600);
    try {
      const state=JSON.parse(readFileSync(this.path,'utf8'));
      check(state.version===1 && Array.isArray(state.articles),'invalid ledger');
      const save = next => {
        const tmp=this.path+'.tmp'; const fd=openSync(tmp,'w',0o600);
        try {writeFileSync(fd,JSON.stringify(next,null,2)+'\n');fsyncSync(fd);} finally {closeSync(fd);}
        renameSync(tmp,this.path);
        const dir=openSync(dirname(this.path),'r');try{fsyncSync(dir);}finally{closeSync(dir);}
      };
      return await fn(state,save);
    } finally {closeSync(lock);unlinkSync(this.path+'.lock');}
  }
}

export async function reserve(ledger, input, imageBytes) {
  const p=compile(input);verifyImage(p,imageBytes);
  return ledger.transaction(async(s,save)=>{
    check(!s.articles.some(a=>a.week_id===p.week_id || a.body_sha256===p.body_sha256 || a.image_sha256===p.image_sha256),'duplicate week, body or image; inspect existing record');
    const record={...p,status:'prepared',article_id:null,post_id:null,attempts:[]};
    s.articles.push(record);save(s);return clone(record);
  });
}

// Offline-only adapter. post is an injected mock returning {status, body}.
// Real transport intentionally cannot be enabled through an argument/env flag.
export async function stage({ledger,week_id,action,post,durable,mode='offline',cost,now=()=>new Date().toISOString()}) {
  check(mode==='offline' && !LIVE_ENABLED,'live article execution is disabled');
  check(['draft','publish'].includes(action),'invalid stage');
  check(typeof post==='function' && typeof durable==='function','explicit mock transport and durable acknowledgement required');
  check(cost?.all_in_known===true && Number.isFinite(cost.max_usd) && cost.max_usd>=0.01 && typeof cost.evidence==='string' && cost.evidence.trim(),'all-in cost unresolved');
  return ledger.transaction(async(s,save)=>{
    const a=s.articles.find(r=>r.week_id===week_id);check(a,'article not reserved');
    check(digest(a.payload)===a.payload_sha256,'payload changed');
    check(a.status===(action==='draft'?'prepared':'draft_created'),'stage already attempted, unknown, or not ready; no retry');
    if(action==='draft') {
      check(a.payload.cover_media,'cover media not uploaded/verified; do not create incomplete draft');
      check(a.media_receipt?.media_id===a.payload.cover_media.media_id && a.media_receipt?.image_sha256===a.image_sha256 && Date.parse(a.media_receipt.expires_at)>Date.parse(now()),'media receipt missing, mismatched, or expired');
    }
    if(action==='publish') check(idOK(a.article_id),'durable draft ID missing');
    const acknowledge=async()=>{
      const hash=digest(s);const ack=await durable(clone(s),hash);
      check(ack?.state_sha256===hash && /^[a-f0-9]{40}$/.test(ack.commit||'') && ack.remote_verified===true,'remote durable acknowledgement missing');
    };
    await acknowledge(); // Refuse publish until draft ID/result is durable.
    const attempt={action,started_at:now(),status:'unknown',http_status:null,cost_max_usd:cost.max_usd,cost_evidence:cost.evidence};
    a.attempts.push(attempt);a.status=action+'_unknown';save(s);
    await acknowledge(); // Persist intent remotely BEFORE any POST. Failure burns attempt.
    const url=action==='draft'?'https://api.x.com/2/articles/draft':`https://api.x.com/2/articles/${a.article_id}/publish`;
    let response;
    try {response=await post({method:'POST',url,...(action==='draft'?{body:clone(a.payload)}:{})});}
    catch {return clone(a);} // Do not persist transport errors, which may contain secrets.
    attempt.http_status=Number.isInteger(response?.status)?response.status:null;
    const value=response?.body?.data?.[action==='draft'?'id':'post_id'];
    // Preserve any returned identifier even in an ambiguous/error response.
    if(idOK(value)) a[action==='draft'?'article_id':'post_id']=value;
    if(response?.status===(action==='draft'?201:200) && idOK(value) && !(response.body.errors?.length)) {
      a.status=action==='draft'?'draft_created':'published';attempt.status='confirmed';
    }
    attempt.finished_at=now();save(s);
    await acknowledge(); // Failure here never permits creation/publish retry.
    return clone(a);
  });
}

// Read-only proof against a freshly fetched remote tracking ref. No push/fetch here.
// Caller must serialize remote CAS commits; this does not itself provide a lease.
export function gitAcknowledgement(repo, statePath, expectedHash) {
  check(/^social\/ai-weekly\/[a-zA-Z0-9_/-]+\.json$/.test(statePath) && !statePath.includes('..'), 'invalid state path');
  const git = args => execFileSync('git',args,{cwd:repo,encoding:'utf8',stdio:['ignore','pipe','pipe']});
  const commit=git(['rev-parse','refs/remotes/origin/main']).trim();
  const state=JSON.parse(git(['show',`${commit}:${statePath}`]));
  check(digest(state)===expectedHash,'remote state differs');
  return {state_sha256:expectedHash,commit,remote_verified:true};
}
