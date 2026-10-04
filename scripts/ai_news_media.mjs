// Consumes a previously uploaded image only. No upload, retry, edit or fallback.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const requireValue=(value,message)=>{if(!value)throw Error(message);};
const sha=b=>createHash('sha256').update(b).digest('hex');
export function validateMediaEvidence(image,receipt,bytes,now=new Date()) {
  requireValue(image&&/^[a-f0-9]{64}$/.test(image.sha256)&&/^[a-f0-9]{64}$/.test(image.receipt_sha256),'image identity/receipt hash missing');
  requireValue(typeof image.media_id==='string'&&/^\d+$/.test(image.media_id),'invalid media ID');
  requireValue(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=5*1024*1024&&sha(bytes)===image.sha256,'image bytes/hash mismatch');
  requireValue(sha(JSON.stringify(receipt))===image.receipt_sha256,'receipt digest mismatch');
  requireValue(image.post_cost?.all_in_known===true&&Number.isFinite(image.post_cost.max_usd)&&image.post_cost.max_usd>0&&typeof image.post_cost.evidence==='string'&&image.post_cost.evidence.trim(),'image post/verify cost unresolved');
  requireValue(receipt.cost?.all_in_known===true&&typeof receipt.cost.evidence==='string'&&receipt.cost.evidence.trim(),'upload cost evidence missing');
  requireValue(receipt.version===1&&receipt.outcome==='uploaded_confirmed'&&receipt.http_status===200,'upload not confirmed');
  requireValue(receipt.image_sha256===image.sha256&&receipt.media_id===image.media_id&&receipt.bytes===bytes.length,'upload binding mismatch');
  requireValue(receipt.media_category==='tweet_image'&&receipt.media_key===`3_${image.media_id}`&&receipt.owner_id==='1982353950843256832','media kind/key/owner mismatch');
  requireValue(typeof receipt.workflow_run_id==='string'&&/^\d+$/.test(receipt.workflow_run_id),'upload run evidence missing');
  const uploaded=Date.parse(receipt.uploaded_at),expires=Date.parse(receipt.expires_at),qa=receipt.qa;
  requireValue(Number.isFinite(uploaded)&&uploaded<=now.getTime()&&Number.isFinite(expires)&&expires>now.getTime()+120000,'image expired/near expiry or future upload');
  requireValue(Number.isFinite(receipt.expires_after_secs)&&receipt.expires_after_secs>0&&expires<=uploaded+receipt.expires_after_secs*1000,'invalid upload expiry evidence');
  requireValue(qa?.status==='pass'&&qa.image_sha256===image.sha256&&typeof qa.evidence==='string'&&qa.evidence.trim()&&Number.isFinite(Date.parse(qa.checked_at))&&Date.parse(qa.checked_at)<=now.getTime(),'image QA missing/mismatched');
  return {media_ids:[image.media_id],media_key:receipt.media_key,image_sha256:image.sha256,receipt_sha256:image.receipt_sha256,expires_at:receipt.expires_at};
}
export function loadNewsMedia(queue,now=new Date()) {
  if(queue.publication_lane!=='ai_news')return null; // Existing business payload unchanged.
  if(!queue.image) {requireValue(queue.image_required!==true,'required image absent; no text fallback');return null;}
  const image=queue.image;
  requireValue(/^[a-f0-9]{64}$/.test(image.sha256)&&/^[a-f0-9]{64}$/.test(image.receipt_sha256),'invalid media proof path');
  const path=`social/ai-news/media/${image.sha256}`;
  const git=args=>execFileSync('git',args,{stdio:['ignore','pipe','pipe']});
  // The existing workflow uses a shallow checkout. Read only committed HEAD
  // blobs, bound to the queue by canonical receipt hash; no earlier object/fetch.
  const receiptBytes=git(['show',`HEAD:${path}.json`]);
  const bytes=git(['show',`HEAD:${path}.bin`]);
  const result=validateMediaEvidence(image,JSON.parse(receiptBytes),bytes,now);
  return {...result,receipt_commit:git(['rev-parse','HEAD']).toString().trim()};
}
export function newsPostPayload(queue,media) {
  if(queue.publication_lane!=='ai_news')return {text:queue.text};
  requireValue(!queue.image||media,'image requested but unverified; no text fallback');
  requireValue(queue.image_required!==true||media,'required image unverified');
  return {text:queue.text,...(media?{media:{media_ids:media.media_ids}}:{})};
}
export function verifyNewsAttachment(body,media) {
  if(!media)return true;
  const keys=body?.data?.attachments?.media_keys;
  return Array.isArray(keys)&&keys.length===1&&keys[0]===media.media_key&&body.data.author_id==='1982353950843256832';
}
