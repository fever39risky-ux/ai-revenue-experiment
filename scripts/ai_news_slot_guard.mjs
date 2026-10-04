import {createHash} from 'node:crypto';
const hash = text => createHash('sha256').update(text).digest('hex');
const slots={'08':'001','12':'002','20':'003'};
const morning={content_id:'C-20261004-001',tweet_id:'2106524258906337476',body_sha256:'7fdad565f3cb43fa8a72435d80081217d3f5e5d9adde0313bd5d9d052c50a9bd'};
export function topLevelGuard(queue, history, now = new Date()) {
  const jst=new Date(now.getTime()+9*3600000).toISOString();
  const date=jst.slice(0,10), hour=jst.slice(11,13);
  const deny=reason=>({allowed:false,reason});
  if(queue.publication_lane !== 'ai_news') {
    // Preserve legacy behavior, including its counting of all top-level receipts.
    if(history.posts.some(p=>p.date===date && p.post_type==='top_level')) return deny('legacy 1/day cap');
    return {allowed:true,metadata:{}};
  }
  const slot=queue.news_slot;
  if(!slots[slot] || queue.date!==date || slot!==hour) return deny('AI news outside designated JST hour');
  if(queue.content_id!==`C-${date.replaceAll('-','')}-${slots[slot]}` || queue.scheduled_at!==`${date}T${slot}:00:00+09:00`) return deny('AI news slot identity mismatch');
  if(typeof queue.text!=='string' || queue.body_sha256!==hash(queue.text)) return deny('AI news body hash mismatch');
  if(queue.reply_text || queue.reply || queue.quote_tweet_id || queue.media || queue.media_ids) return deny('AI news standalone queue required; raw media fields forbidden');
  for(const p of history.posts) {
    if(p.content_id===queue.content_id || p.body_sha256===queue.body_sha256 || (typeof p.text==='string' && hash(p.text)===queue.body_sha256)) return deny('AI news duplicate content/body');
    const oldMorning=p.content_id===morning.content_id && p.tweet_id===morning.tweet_id && p.body_sha256===morning.body_sha256;
    if(p.date!==date || p.post_type!=='top_level') continue;
    if(oldMorning && slot==='08') return deny('morning slot already consumed');
    if(p.publication_lane==='ai_news') {
      // Unknown/malformed same-day news receipts fail closed, never free a slot.
      if(!slots[p.news_slot]) return deny('ambiguous news history');
      if(p.news_slot===slot) return deny('AI news slot already consumed');
    }
  }
  return {allowed:true,metadata:{publication_lane:'ai_news',news_slot:slot,content_id:queue.content_id,body_sha256:queue.body_sha256,scheduled_at:queue.scheduled_at}};
}
