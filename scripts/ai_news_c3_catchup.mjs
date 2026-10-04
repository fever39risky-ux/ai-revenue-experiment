/** Offline C3 readiness checks. Not imported by any publisher/workflow. */
import {createHash} from 'node:crypto';
import {openSync,writeFileSync,fsyncSync,closeSync} from 'node:fs';
export const LIVE_READY=false;
export const C3=Object.freeze({content_id:'C-20261004-003',body_sha256:'26c5f32e27af3e78e6ccef7e5787975d87bc52125064100ed1ffd04663e0cacc',image_sha256:'725e6f43e8646d9cde1854ebb7f7fa56a019754065f1fbedf8b8c57406e2efcd'});
const sha=value=>createHash('sha256').update(value).digest('hex');
const need=(ok,reason)=>{if(!ok)throw new Error(reason);};
const finitePositive=n=>Number.isFinite(n)&&n>0;
// This validates an intent's metadata only, never authorizes a network request.
export function validateIntent(intent,context,history,now=new Date()) {
  const jst=new Date(now.getTime()+9*3600000).toISOString();
  need(jst.slice(0,10)==='2026-10-04'&&jst.slice(11,13)>='21','outside single C3 catch-up date/window');
  for(const [key,value] of Object.entries(C3))need(intent[key]===value,`C3 ${key} mismatch`);
  need(intent.status==='claimed'&&intent.run_id===context.run_id&&/^\d+$/.test(context.run_id)&&String(context.run_attempt)==='1','run claim mismatch');
  need(/^[a-f0-9]{40}$/.test(context.code_sha)&&intent.code_sha===context.code_sha,'code SHA mismatch');
  need(/^[a-f0-9]{40}$/.test(context.state_commit)&&intent.history_sha256===sha(JSON.stringify(history)),'fresh durable history proof required');
  const issued=Date.parse(intent.claimed_at),expiry=Date.parse(intent.expires_at),clock=now.getTime();
  need(Number.isFinite(issued)&&issued<=clock&&expiry>clock&&expiry-issued<=15*60000,'claim expired/invalid');
  need(Array.isArray(history.posts),'invalid history');
  need(!history.posts.some(p=>p.content_id===C3.content_id||p.body_sha256===C3.body_sha256||(typeof p.text==='string'&&sha(p.text)===C3.body_sha256)||(p.date==='2026-10-04'&&p.publication_lane==='ai_news'&&(!['08','12','20'].includes(p.news_slot)||p.news_slot==='20'))),'duplicate or ambiguous history');
  const c=intent.cost;
  need(c?.all_in_known===true&&c.mock!==true&&typeof c.evidence==='string'&&c.evidence.trim()&&c.upload_price_confirmed===true&&c.tax_fx_shared_allocation_confirmed===true&&c.overshoot_bound_confirmed===true,'all-in real cost evidence missing');
  need(finitePositive(c.max_jpy)&&Number.isInteger(c.max_jpy)&&Number.isFinite(c.month_remaining_jpy)&&c.month_remaining_jpy>=c.max_jpy&&c.month_remaining_jpy<=3000,'JPY budget insufficient');
  need(finitePositive(c.max_usd)&&Number.isFinite(c.credit_remaining_usd)&&c.credit_remaining_usd>=c.max_usd&&Number.isFinite(c.cycle_remaining_usd)&&c.cycle_remaining_usd>=c.max_usd,'credit/cycle headroom insufficient');
  return {content_id:C3.content_id,scheduled_at:'2026-10-04T20:00:00+09:00',delayed:true,catch_up_run_id:context.run_id};
}
export function verifyMaterials(queue,imageBytes) {
  need(queue.publication_lane==='ai_news'&&queue.news_slot==='20'&&queue.date==='2026-10-04'&&queue.content_id===C3.content_id&&queue.scheduled_at==='2026-10-04T20:00:00+09:00','C3 queue identity mismatch');
  need(typeof queue.text==='string'&&sha(queue.text)===C3.body_sha256&&queue.body_sha256===C3.body_sha256,'C3 actual body mismatch');
  need(Buffer.isBuffer(imageBytes)&&imageBytes.length>0&&imageBytes.length<=5*1024*1024&&sha(imageBytes)===C3.image_sha256&&queue.image?.sha256===C3.image_sha256,'C3 actual image mismatch');
  need(!queue.reply_text&&!queue.reply&&!queue.quote_tweet_id&&!queue.media&&!queue.media_ids,'standalone only');
  return true;
}
// Local mock crash barrier; this is NOT a cross-run durable Git claim.
// A failed/unknown POST must leave the marker present. No release/retry helper.
export function reserveMockAttempt(path,intent) {
  const fd=openSync(path,'wx',0o600);
  try {writeFileSync(fd,JSON.stringify({content_id:C3.content_id,run_id:intent.run_id,status:'attempt_reserved_outcome_unknown'})+'\n');fsyncSync(fd);} finally {closeSync(fd);}
}
export async function executeLive() {
  // No env/config override and no credential/network access, even with forged proof.
  throw new Error('C3 live catch-up disabled: price, durable run claim and material verification pending');
}
