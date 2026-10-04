import {createHmac,randomBytes} from 'node:crypto';
import {openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {compile,sha256,verifyImage} from './article.mjs';
export const LIVE_READY=false; // Price evidence unresolved: no CLI/env override.
export const STAGES=['upload','draft','publish','verify'];
const ok=(v,m)=>{if(!v)throw Error(m);};
const copy=v=>JSON.parse(JSON.stringify(v));
export const digest=v=>sha256(JSON.stringify(v));
const id=v=>typeof v==='string'&&/^\d+$/.test(v);
const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function reserveMaterial(state,material,image) {
  ok(state.version===2&&Array.isArray(state.articles),'ledger version');
  ok(!material.cover_media&&!material.media_receipt,'media comes only from upload receipt');
  const p=compile(material);verifyImage(p,image);
  ok(!state.articles.some(a=>a.week_id===p.week_id||a.body_sha256===p.body_sha256||a.image_sha256===p.image_sha256),'duplicate week/body/image');
  const next=copy(state);next.articles.push({week_id:p.week_id,body_sha256:p.body_sha256,image_sha256:p.image_sha256,material_sha256:digest(material),attempts:[]});return next;
}
function record(state,week){const matches=state.articles.filter(a=>a.week_id===week);ok(matches.length===1,'unique week required');return matches[0];}
function previous(a,stage){return a.attempts.find(x=>x.stage===stage);}
function ready(a,stage){const index=STAGES.indexOf(stage);ok(index>=0,'stage');if(index>0)ok(previous(a,STAGES[index-1])?.result?.outcome==='confirmed','previous result not durable/confirmed');}
export function claimStage(state,{week_id,stage,run_id,code_sha,expires_at,cost},now=new Date()) {
  const next=copy(state),a=record(next,week_id);ready(a,stage);
  ok(!previous(a,stage),'stage already consumed; no reissue');
  ok(id(run_id)&&/^[a-f0-9]{40}$/.test(code_sha),'run/code identity');
  ok(Date.parse(expires_at)>now.getTime()&&Date.parse(expires_at)<=now.getTime()+15*60000,'claim expiry must be within 15 minutes');
  ok(cost?.all_in_known===true&&Number.isFinite(cost.max_usd)&&cost.max_usd>0&&Number.isSafeInteger(cost.max_jpy)&&cost.max_jpy>0&&typeof cost.evidence==='string'&&cost.evidence.trim(),'all-in pricing missing');
  ok(Number.isSafeInteger(next.monthly_remaining_jpy)&&next.monthly_remaining_jpy>=cost.max_jpy&&next.monthly_remaining_jpy<=3000,'monthly budget');
  ok(!next.articles.some(r=>r.attempts.some(x=>x.run_id===run_id)),'run already used');
  ok(next.budget_month===new Date(now.getTime()+9*3600000).toISOString().slice(0,7),'budget month mismatch');
  next.monthly_remaining_jpy-=cost.max_jpy; // Reserve maximum even if response unknown.
  a.attempts.push({stage,run_id,run_attempt:'1',code_sha,expires_at,cost:copy(cost),request_limit:1,status:'intent',created_at:now.toISOString(),result:null});
  return next;
}
export function requestFor(state,material,image,stage,now=new Date()) {
  const a=record(state,material.week_id);const p=compile(material);verifyImage(p,image);
  ok(a.material_sha256===digest(material)&&a.body_sha256===p.body_sha256&&a.image_sha256===p.image_sha256,'material drift');ready(a,stage);
  if(stage==='upload') {
    ok(image.length<=5*1024*1024,'image size exceeds internal 5MiB limit');
    ok(image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || (image[0]===255&&image[1]===216&&image[2]===255),'PNG/JPEG signature required');
    return {method:'POST',url:'https://api.x.com/2/media/upload',body:{media:image.toString('base64'),media_category:'tweet_image'}};
  }
  const media=previous(a,'upload')?.result;
  if(stage==='draft') {
    ok(id(media.media_id)&&Date.parse(media.expires_at)>now.getTime(),'uploaded media expired/missing');
    return {method:'POST',url:'https://api.x.com/2/articles/draft',body:{...p.payload,cover_media:{media_category:'tweet_image',media_id:media.media_id}}};
  }
  const article=previous(a,'draft')?.result;ok(id(article.article_id),'draft id missing');
  if(stage==='publish')return {method:'POST',url:`https://api.x.com/2/articles/${article.article_id}/publish`};
  const post=previous(a,'publish')?.result;ok(id(post.post_id),'post id missing');
  const query=new URLSearchParams({'post.fields':'article,created_at,public_metrics',expansions:'article.cover_media,author_id','media.fields':'media_key,type,url'});
  return {method:'GET',url:`https://api.x.com/2/tweets/${post.post_id}?${query}`};
}
export function validateClaim(state,material,image,ctx,now=new Date()) {
  ok(ctx.ref==='refs/heads/main'&&ctx.run_attempt==='1','main and first attempt only');
  ok(state.budget_month===new Date(now.getTime()+9*3600000).toISOString().slice(0,7),'budget month mismatch');
  const a=record(state,material.week_id),c=previous(a,ctx.stage);
  ok(c&&c.run_id===ctx.run_id&&c.code_sha===ctx.code_sha&&c.run_attempt==='1','claim owner mismatch');
  ok(c.status==='intent'&&!c.result&&c.request_limit===1,'consumed result; no replay');
  ok(Date.parse(c.expires_at)>now.getTime(),'claim expired');
  ok(c.cost?.all_in_known===true&&c.cost.max_usd>0&&c.cost.max_jpy>0&&c.cost.evidence,'price evidence missing');
  ok(Number.isSafeInteger(state.monthly_remaining_jpy)&&state.monthly_remaining_jpy>=0&&state.monthly_remaining_jpy<=3000,'budget state');
  return requestFor(state,material,image,ctx.stage,now);
}
// Strict fixed endpoints. OAuth1 GET signs query parameters, unlike JSON POST.
export function sign(request,env,nonce=randomBytes(16).toString('hex'),timestamp=Math.floor(Date.now()/1000)) {
  const u=new URL(request.url),get=request.method==='GET';
  ok(u.origin==='https://api.x.com'&&!u.username&&!u.password&&!u.hash,'origin');
  ok(get?(/^\/2\/tweets\/\d+$/.test(u.pathname)&&u.searchParams.get('post.fields')==='article,created_at,public_metrics'&&u.searchParams.get('expansions')==='article.cover_media,author_id'&&u.searchParams.get('media.fields')==='media_key,type,url'&&[...u.searchParams].length===3):(request.method==='POST'&&!u.search&&/^\/2\/(media\/upload|articles\/draft|articles\/\d+\/publish)$/.test(u.pathname)),'endpoint');
  const names=['X_API_KEY','X_API_KEY_SECRET','X_ACCESS_TOKEN','X_ACCESS_TOKEN_SECRET'];ok(names.every(n=>typeof env[n]==='string'&&env[n]),'credentials missing');
  const enc=s=>encodeURIComponent(s).replace(/[!*'()]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
  const oauth={oauth_consumer_key:env.X_API_KEY,oauth_token:env.X_ACCESS_TOKEN,oauth_signature_method:'HMAC-SHA1',oauth_timestamp:String(timestamp),oauth_nonce:nonce,oauth_version:'1.0'};
  const pairs=[...Object.entries(oauth),...u.searchParams].map(([k,v])=>[enc(k),enc(v)]).sort((a,b)=>a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:a[1]>b[1]?1:0);
  const base=[request.method,enc(u.origin+u.pathname),enc(pairs.map(([k,v])=>k+'='+v).join('&'))].join('&');
  oauth.oauth_signature=createHmac('sha1',enc(env.X_API_KEY_SECRET)+'&'+enc(env.X_ACCESS_TOKEN_SECRET)).update(base).digest('base64');
  return {Authorization:'OAuth '+Object.entries(oauth).map(([k,v])=>enc(k)+'="'+enc(v)+'"').join(', '),'Content-Type':'application/json'};
}
function exclusive(path,value){const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
export async function execute({state,material,image,ctx,receiptDir,transport,remoteProof,mode='live',now=()=>new Date()}) {
  ok(mode==='mock'||LIVE_READY,'live disabled: unresolved upload/all-in prices');
  ok(mode!=='mock'||typeof transport==='function','mock transport required');
  const req=validateClaim(state,material,image,ctx,now());const stateHash=digest(state);
  const proof=await remoteProof();ok(proof.state_sha256===stateHash&&/^[a-f0-9]{40}$/.test(proof.commit),'fresh remote intent proof required');
  // Recheck expiry after remote I/O, before consumption/HTTP.
  validateClaim(state,material,image,ctx,now());
  const receipt={version:1,week_id:material.week_id,stage:ctx.stage,run_id:ctx.run_id,run_attempt:ctx.run_attempt,code_sha:ctx.code_sha,intent_commit:proof.commit,intent_sha256:stateHash,body_sha256:record(state,material.week_id).body_sha256,image_sha256:material.image_sha256,started_at:now().toISOString(),outcome:'unknown',http_status:null,request_count:1};
  exclusive(join(receiptDir,`${ctx.stage}-${ctx.run_id}.intent.json`),receipt); // Never remove this marker.
  try {
    const response=await transport(req);const d=response?.body?.data;
    receipt.http_status=Number.isInteger(response?.status)?response.status:null;
    const noErrors=!response?.body?.errors?.length;
    if(ctx.stage==='upload') {
      if(id(d?.id))receipt.media_id=d.id;
      if(typeof d?.media_key==='string'&&/^\d+_\d+$/.test(d.media_key))receipt.media_key=d.media_key;
      if(Number.isFinite(d?.expires_after_secs)&&d.expires_after_secs>0)receipt.expires_at=new Date(Date.parse(receipt.started_at)+d.expires_after_secs*1000).toISOString();
      if(response.status===200&&noErrors&&receipt.media_id&&receipt.expires_at&&(!d.processing_info||d.processing_info.state==='succeeded'))receipt.outcome='confirmed';
    } else if(ctx.stage==='draft') {
      if(id(d?.id))receipt.article_id=d.id;
      if(response.status===201&&noErrors&&receipt.article_id&&d.title===material.title)receipt.outcome='confirmed';
    } else if(ctx.stage==='publish') {
      if(id(d?.post_id))receipt.post_id=d.post_id;
      if(response.status===200&&noErrors&&receipt.post_id)receipt.outcome='confirmed';
    } else {
      const expected=previous(record(state,material.week_id),'publish').result.post_id;
      if(id(d?.id))receipt.post_id=d.id;
      if(id(d?.author_id))receipt.author_id=d.author_id;
      if(typeof d?.created_at==='string'&&Number.isFinite(Date.parse(d.created_at)))receipt.created_at=d.created_at;
      receipt.article_present=!!d?.article&&typeof d.article==='object'&&!Array.isArray(d.article)&&Object.keys(d.article).length>0;
      receipt.body_links_cover_verified=false; // Article read schema is opaque; never infer full match.
      if(response.status===200&&noErrors&&d?.id===expected&&d.author_id==='1982353950843256832'&&receipt.created_at&&receipt.article_present)receipt.outcome='verified_existence_only';
    }
  } catch { /* No retry; do not log error strings/headers/bodies containing credentials. */ }
  receipt.finished_at=now().toISOString();exclusive(join(receiptDir,`${ctx.stage}-${ctx.run_id}.result.json`),receipt);return receipt;
}
export function applyReceipt(state,receipt) {
  const next=copy(state),a=record(next,receipt.week_id),c=previous(a,receipt.stage);
  ok(c&&c.run_id===receipt.run_id&&c.code_sha===receipt.code_sha&&receipt.run_attempt==='1'&&!c.result,'receipt owner/replay');
  ok(receipt.intent_sha256===digest(state)&&hash(receipt.body_sha256)&&receipt.body_sha256===a.body_sha256&&receipt.image_sha256===a.image_sha256,'receipt snapshot mismatch');
  ok(['unknown','confirmed','verified_existence_only'].includes(receipt.outcome),'receipt outcome');
  c.status=receipt.outcome;c.result=copy(receipt);return next;
}
