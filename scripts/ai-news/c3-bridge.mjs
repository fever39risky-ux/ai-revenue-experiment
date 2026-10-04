import {createHash,createHmac,randomBytes} from 'node:crypto';
import {openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
import {join} from 'node:path';
import {C3,verifyMaterials} from '../ai_news_c3_catchup.mjs';
import {topLevelGuard} from '../ai_news_slot_guard.mjs';
import {validateMediaEvidence,newsPostPayload,verifyNewsAttachment} from '../ai_news_media.mjs';
export const LIVE_READY=false; // Normal publishing remains price-held.
export const UPLOAD_PROBE_ENABLED=true; // One exact C3 upload; scoped owner grant below.
export const STAGES=['upload','post','verify'];
export const OWNER='1982353950843256832';
export const digest=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const ok=(v,m)=>{if(!v)throw Error(m);};
const copy=v=>JSON.parse(JSON.stringify(v));
const id=v=>typeof v==='string'&&/^\d+$/.test(v);
const hex40=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const attempt=(s,stage)=>s.attempts.find(a=>a.stage===stage);
export function checkMaterial(q,image){
  verifyMaterials(q,image);
  let weight=0;for(const ch of q.text.replace(/https?:\/\/\S+/g,'x'.repeat(23))){const cp=ch.codePointAt(0);weight+=(cp>0x10ff&&!(cp>=0x2000&&cp<=0x206f))?2:1;}
  ok(weight<=270,'weighted limit');
  for(const k of ['register_targeted','topic_chosen','referenced_corpus_examples','voice_fingerprint_self_check'])ok(q[k]?.length,'editorial metadata');
  ok(image.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),'PNG required');
  return weight;
}
function checkWindow(stage,now){
  if(stage==='verify')return; // Readback can cross midnight, creation cannot.
  const jst=new Date(now.getTime()+9*3600000).toISOString();
  ok(jst.slice(0,10)==='2026-10-04'&&jst.slice(11,13)>='21','single catch-up window expired');
}
function checkState(s,q,image){
  checkMaterial(q,image);
  ok(s.version===1&&s.content_id===C3.content_id&&s.material_sha256===digest(q)&&s.body_sha256===C3.body_sha256&&s.image_sha256===C3.image_sha256&&Array.isArray(s.attempts),'state/material binding');
  ok(new Set(s.attempts.map(a=>a.stage)).size===s.attempts.length&&s.attempts.every(a=>STAGES.includes(a.stage)),'ambiguous attempts');
}
export function checkCost(c,now){
  ok(c?.all_in_known===true&&c.mock!==true&&c.upload_price_confirmed===true&&c.tax_fx_shared_allocation_confirmed===true&&c.overshoot_bound_confirmed===true&&c.shared_app_reservation_confirmed===true&&typeof c.evidence==='string'&&c.evidence.trim(),'unresolved real all-in costs');
  const age=now.getTime()-Date.parse(c.checked_at);
  ok(Number.isFinite(age)&&age>=0&&age<=15*60000,'cost evidence stale');
  ok(Number.isSafeInteger(c.max_jpy)&&c.max_jpy>0&&Number.isSafeInteger(c.month_remaining_jpy)&&c.month_remaining_jpy<=3000&&c.month_remaining_jpy>=c.max_jpy,'monthly budget');
  ok(Number.isFinite(c.max_usd)&&c.max_usd>0&&Number.isFinite(c.credit_remaining_usd)&&c.credit_remaining_usd>=c.max_usd&&Number.isFinite(c.cycle_remaining_usd)&&c.cycle_remaining_usd>=c.max_usd,'credit/cycle budget');
  ok(c.budget_month===new Date(now.getTime()+9*3600000).toISOString().slice(0,7),'cost month');
}
export const UPLOAD_PROBE_AUTHORIZATION=Object.freeze({channel:'C0C698PFHPG',thread:'1791083855.285109',message:'1791120054.652269',user:'U0C695NDZHC'});
export function isUploadProbe(stage,c){return stage==='upload'&&c?.kind==='user_authorized_single_upload_measurement';}
export function checkStageCost(stage,c,now){
  if(!isUploadProbe(stage,c))return checkCost(c,now);
  ok(UPLOAD_PROBE_ENABLED&&c.pricing_status==='unknown'&&c.all_in_known===false&&c.actual_usd===null&&c.actual_jpy===null,'probe must retain unknown price');
  ok(digest(c.authorization)===digest(UPLOAD_PROBE_AUTHORIZATION),'single-upload authorization mismatch');
  const p=c.before_snapshot,age=now.getTime()-Date.parse(p?.checked_at);
  ok(Number.isFinite(age)&&age>=0&&age<=5*60000&&typeof p.evidence==='string'&&p.evidence.trim(),'parent pre-cost snapshot required/fresh');
  ok(p.auto_charge===false&&p.cycle_cap_usd===5&&p.cycle_used_usd===1.41&&p.credit_balance_usd===3.59,'approved prepaid/cap baseline changed');
  ok(c.monthly_budget_jpy===3000&&Number.isSafeInteger(c.month_committed_jpy)&&c.month_committed_jpy>=0&&Number.isSafeInteger(c.reserved_remaining_budget_jpy)&&c.reserved_remaining_budget_jpy>0&&c.month_committed_jpy+c.reserved_remaining_budget_jpy===3000,'reserve remaining monthly budget during measurement');
  ok(c.max_usd===null&&c.max_jpy===null,'unknown unit price must not be represented as a numeric quote');
}
const reservedJpy=c=>isUploadProbe('upload',c)?c.reserved_remaining_budget_jpy:c.max_jpy;
function ready(s,stage){
  const index=STAGES.indexOf(stage);ok(index>=0,'stage');
  if(index>0)ok(attempt(s,STAGES[index-1])?.result?.outcome==='confirmed','previous result unknown/unpersisted');
}
function duplicates(q,h){ok(topLevelGuard(q,h,new Date('2026-10-04T20:00:00+09:00')).allowed,'duplicate/ambiguous history');}
export function claimStage(state,history,q,image,claim,now=new Date()){
  checkState(state,q,image);const {stage,run_id,code_sha,expires_at,cost}=claim;checkWindow(stage,now);ready(state,stage);checkStageCost(stage,cost,now);
  ok(!attempt(state,stage)&&!state.attempts.some(a=>a.run_id===run_id),'stage/run already consumed; no reissue');
  ok(id(run_id)&&hex40(code_sha),'run/code identity');
  ok(Date.parse(expires_at)>now.getTime()&&Date.parse(expires_at)<=now.getTime()+15*60000,'claim expiry');
  if(stage!=='verify')duplicates(q,history);
  if(stage==='post')mediaEvidence(state,q,image,cost,now);
  const next=copy(state);
  // Cumulative reservations never disappear on errors, timeout, or unknown result.
  const spent=next.attempts.reduce((sum,a)=>sum+reservedJpy(a.cost),0);
  ok(spent+reservedJpy(cost)<=3000,'cumulative C3 budget');
  next.attempts.push({stage,run_id,run_attempt:'1',code_sha,created_at:now.toISOString(),expires_at,cost:copy(cost),history_sha256:digest(history),status:'intent',request_limit:1,result:null});
  return next;
}
function mediaEvidence(s,q,image,cost,now){
  const u=attempt(s,'upload'),r=u?.result;
  ok(r?.outcome==='confirmed','upload not durable');
  const receipt={version:1,outcome:'uploaded_confirmed',http_status:r.http_status,image_sha256:C3.image_sha256,media_id:r.media_id,media_key:r.media_key,bytes:image.length,media_category:'tweet_image',owner_id:OWNER,workflow_run_id:r.run_id,uploaded_at:r.started_at,expires_at:r.expires_at,expires_after_secs:r.expires_after_secs,cost:u.cost,qa:s.image_qa};
  const imageEnvelope={sha256:C3.image_sha256,receipt_sha256:digest(receipt),media_id:r.media_id,post_cost:cost};
  return validateMediaEvidence(imageEnvelope,receipt,image,now);
}
export function validateClaim(s,h,q,image,ctx,now=new Date()){
  checkState(s,q,image);checkWindow(ctx.stage,now);ready(s,ctx.stage);
  ok(ctx.ref==='refs/heads/main'&&ctx.run_attempt==='1'&&id(ctx.run_id)&&hex40(ctx.code_sha),'main/first run only');
  const a=attempt(s,ctx.stage);
  ok(a?.run_id===ctx.run_id&&a.code_sha===ctx.code_sha&&a.run_attempt==='1'&&a.status==='intent'&&!a.result&&a.request_limit===1,'claim owner/replay');
  ok(Date.parse(a.created_at)<=now.getTime()&&Date.parse(a.expires_at)>now.getTime()&&Date.parse(a.expires_at)-Date.parse(a.created_at)<=15*60000,'claim expired');
  checkStageCost(ctx.stage,a.cost,now);ok(a.history_sha256===digest(h),'history changed after claim');
  if(ctx.stage!=='verify')duplicates(q,h);
  if(ctx.stage==='upload')return {method:'POST',url:'https://api.x.com/2/media/upload',body:{media:image.toString('base64'),media_category:'tweet_image'}};
  if(ctx.stage==='post')return {method:'POST',url:'https://api.x.com/2/tweets',body:newsPostPayload(q,mediaEvidence(s,q,image,a.cost,now))};
  const post=attempt(s,'post').result;ok(id(post.post_id),'durable post ID missing');
  return {method:'GET',url:`https://api.x.com/2/tweets/${post.post_id}?`+new URLSearchParams({'tweet.fields':'attachments,author_id,created_at,entities,public_metrics,referenced_tweets'})};
}
export function sign(request,env,nonce=randomBytes(16).toString('hex'),timestamp=Math.floor(Date.now()/1000)){
  const u=new URL(request.url);ok(u.origin==='https://api.x.com'&&!u.username&&!u.password&&!u.hash,'endpoint origin');
  ok(request.method==='POST'?(!u.search&&['/2/media/upload','/2/tweets'].includes(u.pathname)):(request.method==='GET'&&/^\/2\/tweets\/\d+$/.test(u.pathname)&&u.searchParams.get('tweet.fields')==='attachments,author_id,created_at,entities,public_metrics,referenced_tweets'&&[...u.searchParams].length===1),'endpoint forbidden');
  for(const k of ['X_API_KEY','X_API_KEY_SECRET','X_ACCESS_TOKEN','X_ACCESS_TOKEN_SECRET'])ok(typeof env[k]==='string'&&env[k],'credentials missing');
  const enc=s=>encodeURIComponent(s).replace(/[!*'()]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
  const oauth={oauth_consumer_key:env.X_API_KEY,oauth_token:env.X_ACCESS_TOKEN,oauth_signature_method:'HMAC-SHA1',oauth_timestamp:String(timestamp),oauth_nonce:nonce,oauth_version:'1.0'};
  const pairs=[...Object.entries(oauth),...u.searchParams].map(([k,v])=>[enc(k),enc(v)]).sort(([a,b],[c,d])=>a<c?-1:a>c?1:b<d?-1:b>d?1:0);
  const base=[request.method,enc(u.origin+u.pathname),enc(pairs.map(([k,v])=>k+'='+v).join('&'))].join('&');
  oauth.oauth_signature=createHmac('sha1',enc(env.X_API_KEY_SECRET)+'&'+enc(env.X_ACCESS_TOKEN_SECRET)).update(base).digest('base64');
  return {Authorization:'OAuth '+Object.entries(oauth).map(([k,v])=>enc(k)+'="'+enc(v)+'"').join(', '),'Content-Type':'application/json'};
}
function exclusive(path,value){const fd=openSync(path,'wx',0o600);try{writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}}
function originalText(d,q,mediaKey){
  if(typeof d?.text!=='string')return false;
  // X rewrites URLs to t.co. Accept only the exact approved destination and
  // reconstruct only URLs with matching API entity evidence; never trim text.
  let text=d.text;
  for(const e of d.entities?.urls||[]){
    if(typeof e.url!=='string'||!/^https:\/\/t\.co\/[A-Za-z0-9]+$/.test(e.url))continue;
    if(e.expanded_url===q.source_url)text=text.split(e.url).join(e.expanded_url);
    if(e.media_key===mediaKey&&text.endsWith(' '+e.url))text=text.slice(0,-e.url.length-1);
  }
  return text===q.text;
}
export async function execute({state,history,queue,image,ctx,receiptDir,remoteProof,transport,mode='live',now=()=>new Date()}){
  ok(mode==='mock'||LIVE_READY||(UPLOAD_PROBE_ENABLED&&isUploadProbe(ctx?.stage,attempt(state||{attempts:[]},'upload')?.cost)),'LIVE_HOLD_UPLOAD_PRICE');ok(typeof transport==='function','transport');
  const request=validateClaim(state,history,queue,image,ctx,now());
  const proof=await remoteProof();ok(hex40(proof.commit)&&proof.state_sha256===digest(state)&&proof.history_sha256===digest(history),'fresh remote proof mismatch');
  validateClaim(state,history,queue,image,ctx,now());
  const r={version:1,...C3,stage:ctx.stage,run_id:ctx.run_id,run_attempt:'1',code_sha:ctx.code_sha,intent_commit:proof.commit,intent_sha256:digest(state),history_sha256:digest(history),request_sha256:digest(request),request_count:1,pricing_status:isUploadProbe(ctx.stage,attempt(state,ctx.stage).cost)?'unknown_user_authorized_measurement':'known_maximum_reservation',actual_cost_usd:null,actual_cost_jpy:null,started_at:now().toISOString(),outcome:'unknown',http_status:null};
  exclusive(join(receiptDir,`${ctx.stage}-${ctx.run_id}.intent.json`),r);
  try{
    const response=await transport(request),d=response?.body?.data;r.http_status=Number.isInteger(response?.status)?response.status:null;
    const errors=response?.body?.errors;const noErrors=errors===undefined||(Array.isArray(errors)&&errors.length===0);
    if(ctx.stage==='upload'){
      r.response_summary={http_status:r.http_status,data:{},error_count:Array.isArray(response?.body?.errors)?response.body.errors.length:null};
      for(const key of ['id','media_key'])if(typeof d?.[key]==='string'&&/^[0-9_]+$/.test(d[key]))r.response_summary.data[key]=d[key];
      for(const key of ['expires_after_secs','size'])if(Number.isFinite(d?.[key])&&d[key]>=0)r.response_summary.data[key]=d[key];
      if(d?.image)r.response_summary.data.image=Object.fromEntries(['h','w'].filter(k=>Number.isSafeInteger(d.image[k])&&d.image[k]>0).map(k=>[k,d.image[k]]));
      if(['pending','in_progress','succeeded','failed'].includes(d?.processing_info?.state))r.response_summary.data.processing_state=d.processing_info.state;
      if(id(d?.id))r.media_id=d.id;
      if(typeof d?.media_key==='string'&&d.media_key===`3_${d.id}`)r.media_key=d.media_key;
      if(Number.isFinite(d?.expires_after_secs)&&d.expires_after_secs>0){r.expires_after_secs=d.expires_after_secs;r.expires_at=new Date(Date.parse(r.started_at)+d.expires_after_secs*1000).toISOString();}
      if(response.status===200&&noErrors&&r.media_id&&r.media_key&&r.expires_at&&(!d.processing_info||d.processing_info.state==='succeeded'))r.outcome='confirmed';
    }else if(ctx.stage==='post'){
      if(id(d?.id))r.post_id=d.id;
      if(response.status===201&&noErrors&&r.post_id)r.outcome='confirmed';
    }else{
      const post=attempt(state,'post').result,upload=attempt(state,'upload').result;
      if(id(d?.id))r.post_id=d.id;
      const created=Date.parse(d?.created_at);
      if(Number.isFinite(created))r.created_at=d.created_at;
      const inWindow=created>=Date.parse(post.started_at)-5000&&created<=Date.parse(post.finished_at)+5000;
      const standalone=Array.isArray(d?.referenced_tweets)?d.referenced_tweets.length===0:!d?.referenced_tweets;
      r.body_verified=originalText(d,queue,upload.media_key);r.attachment_verified=verifyNewsAttachment(response?.body,{media_key:upload.media_key});
      if(response.status===200&&noErrors&&d?.id===post.post_id&&d.author_id===OWNER&&inWindow&&standalone&&r.body_verified&&r.attachment_verified){
        r.outcome='confirmed';r.author_id=OWNER;r.public_metrics={};
        for(const [k,v] of Object.entries(d.public_metrics||{}))if(/^(impression|like|reply|retweet|quote|bookmark)_count$/.test(k)&&Number.isSafeInteger(v)&&v>=0)r.public_metrics[k]=v;
        r.measurement_due_at=Object.fromEntries([24,72,168].map(h=>[h===168?'7d':h+'h',new Date(created+h*3600000).toISOString()]));
      }
    }
  }catch{ /* Keep unknown; never retry or store raw exceptions/responses. */ }
  r.finished_at=now().toISOString();exclusive(join(receiptDir,`${ctx.stage}-${ctx.run_id}.result.json`),r);return r;
}
export function applyReceipt(state,history,queue,receipt){
  const s=copy(state),h=copy(history),a=attempt(s,receipt.stage);
  ok(a&&a.run_id===receipt.run_id&&a.code_sha===receipt.code_sha&&receipt.run_attempt==='1'&&a.status==='intent'&&!a.result,'receipt owner/replay');
  ok(receipt.intent_sha256===digest(state)&&receipt.history_sha256===a.history_sha256&&hex40(receipt.intent_commit)&&receipt.request_count===1,'receipt snapshot');
  ok(Number.isFinite(Date.parse(receipt.started_at))&&Date.parse(receipt.started_at)>=Date.parse(a.created_at)&&Date.parse(receipt.started_at)<Date.parse(a.expires_at),'receipt time');
  for(const [key,value]of Object.entries(C3))ok(receipt[key]===value,'receipt material');
  ok(['unknown','confirmed'].includes(receipt.outcome),'receipt outcome');
  if(receipt.outcome==='confirmed'){
    if(receipt.stage==='upload')ok(receipt.http_status===200&&id(receipt.media_id)&&receipt.media_key===`3_${receipt.media_id}`&&Number.isFinite(Date.parse(receipt.expires_at)),'upload receipt');
    if(receipt.stage==='post')ok(receipt.http_status===201&&id(receipt.post_id),'post receipt');
    if(receipt.stage==='verify')ok(receipt.http_status===200&&receipt.post_id===attempt(state,'post').result.post_id&&receipt.author_id===OWNER&&receipt.body_verified===true&&receipt.attachment_verified===true&&Number.isFinite(Date.parse(receipt.created_at)),'verify receipt');
  }
  a.status=receipt.outcome;a.result=copy(receipt);
  if(receipt.stage==='post'){
    duplicates(queue,h);
    h.posts.push({publication_lane:'ai_news',news_slot:'20',content_id:C3.content_id,body_sha256:C3.body_sha256,image_sha256:C3.image_sha256,date:'2026-10-04',scheduled_at:queue.scheduled_at,delayed:true,post_type:'top_level',status:receipt.outcome==='confirmed'?'posted_unverified':'unknown',text:queue.text,tweet_id:receipt.post_id||null,catch_up_run_id:receipt.run_id,created_at:null});
  }
  if(receipt.stage==='verify'&&receipt.outcome==='confirmed'){
    const rows=h.posts.filter(p=>p.content_id===C3.content_id);ok(rows.length===1&&rows[0].tweet_id===receipt.post_id,'history receipt mismatch');
    Object.assign(rows[0],{status:'published_verified',created_at:receipt.created_at,posted_at:receipt.created_at,verified_at:receipt.finished_at,tweet_url:`https://x.com/KinoshitaTsks/status/${receipt.post_id}`,body_verified:true,attachment_verified:true,media_ids:[attempt(s,'upload').result.media_id],media_key:attempt(s,'upload').result.media_key,baseline_public_metrics:receipt.public_metrics,measurement_due_at:Object.fromEntries([24,72,168].map(hours=>[hours===168?'7d':hours+'h',new Date(Date.parse(receipt.created_at)+hours*3600000).toISOString()])),posted_via:'scripts/ai-news/c3-run.mjs'});
  }
  return {state:s,history:h};
}
