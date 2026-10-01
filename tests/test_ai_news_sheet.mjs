import test from 'node:test';
import assert from 'node:assert/strict';
import { SHEET, sha, initialState, run, resolvePrePostAbort } from '../scripts/ai-news/core.mjs';
import { TABS, preparePackage, acceptPrepared, receiptPlan, applyPlanToSnapshot } from '../scripts/ai-news/sheet-bridge.mjs';
const text='あ'.repeat(560)+'\nhttps://example.com/source', at='2026-10-02T08:00:00+09:00';
const fields={
 post:{ContentID:'C-TEST','投稿媒体':'X','投稿ステータス':'draft','投稿URL':'',XPostID:'',PlatformPostID:'',PublishedAt:'','投稿文_最終版':text,BodyHash:sha(text),'予約日時':at,'元NewsID':'N-TEST',AnalyticsState:'','備考':'人のメモ',BrowserEvidence:'native-evidence'},
 queue:{QueueID:'Q-TEST',ContentID:'C-TEST',Platform:'X',Status:'planned',PostURL:'',PostText:text,BodyHash:sha(text),ScheduledAt:at,NewsID:'N-TEST',MediaType:'Image',LastError:'',UpdatedAt:'',BrowserEvidence:'preserve',ReservationConfirmedAt:'preserve'},
 media:{ImageID:'IMG-TEST','紐づくContentID':'C-TEST',RenderStatus:'success',QAStatus:'pass',MediaHash:sha('image'),AttachState:'prepared_not_attached','使用状況':'未使用','備考':'画像メモ'},
 news:{NewsID:'N-TEST','一次情報URL':'https://example.com/source',URL:'https://example.com/source','重複キー':'test-news'},
 kpi:{KPIEventID:'',NewsID:'',RunID:'',ObservedAt:'',ContentID:'',PostURL:'',PublishedAt:'',Source:'',EvidenceID:'',Impressions:'',Likes:'',Replies:'',Reposts:'',Bookmarks:'',ObservationWindow:'',Platform:'',PrimaryMetricName:'',PrimaryMetricValue:'',Engagements:'',ProfileViews:'',Follows:'',LinkClicks:''},
 learning:{LearningID:'',EvidenceWindow:'',ObservedChange:'',ApplyStatus:'',LearningType:'',Segment:'',SampleSize:'',Metric:'',Hypothesis:'',Confidence:'',RecommendedChange:''}
};
function fixture(){return {sheet_id:SHEET,captured_at:'2026-10-01T00:00:00Z',tables:Object.fromEntries(Object.entries(fields).map(([k,v])=>[TABS[k],{headers:Object.keys(v),rows:['kpi','learning'].includes(k)?[]:[{row_number:10,values:Object.values(v)}]}]))};}
function set(s,k,col,val){const t=s.tables[TABS[k]];t.rows[0].values[t.headers.indexOf(col)]=val;}
function get(s,k,col){const t=s.tables[TABS[k]];return t.rows[0].values[t.headers.indexOf(col)];}
const manifest=()=>({content_id:'C-TEST',image:{path:'media/test.png',sha256:sha('image'),mime:'image/png'},text_fallback:{allowed:true},handoff:{confirmed:true,evidence:'parent browser writer handoff'}});
function receipt(s){const prep=preparePackage(s,manifest());const p=acceptPrepared(prep,{by:'mock-parent',at:s.captured_at,sha256:prep.required_approval_sha256});const state=initialState();state.posts[p.id]={...p,status:'verified',tweet_id:'1234567890123456789',published_at:at,received_at:at,media_id:'55',media_key:'3_55',delay_seconds:0};state.observations=[{post_id:p.id,tweet_id:state.posts[p.id].tweet_id,hours:0,published_at:at,observed_at:at,scheduled_observation_at:at,public_metrics:{impression_count:10,like_count:0}}];return state;}
test('canonical join preserves full copy; preparation never manufactures approval',()=>{const s=fixture(),p=preparePackage(s,manifest());assert.equal(p.package.text,text);assert.equal(p.package.approval,undefined);assert.throws(()=>acceptPrepared(p,{}),/approval/);assert.equal(acceptPrepared(p,{by:'parent',at:s.captured_at,sha256:p.required_approval_sha256}).id,'c-test');});
test('reject stale body, schedule, source, image, handoff and published rows',()=>{for(const [k,col,value] of [['post','BodyHash','bad'],['queue','PostText','changed'],['queue','ScheduledAt','2026-10-02T12:00:00+09:00'],['post','XPostID','123'],['queue','Status','scheduled'],['media','QAStatus','failed'],['media','MediaHash','bad'],['news','一次情報URL','https://different.example']]){const s=fixture();set(s,k,col,value);assert.throws(()=>preparePackage(s,manifest()));}const m=manifest();m.handoff.confirmed=false;assert.throws(()=>preparePackage(fixture(),m),/handoff/);});
test('ambiguous/duplicate joins fail; fallback requires evidence',()=>{const s=fixture();s.tables[TABS.queue].rows.push(structuredClone(s.tables[TABS.queue].rows[0]));assert.throws(()=>preparePackage(s,manifest()),/duplicate/);s.tables[TABS.queue].rows[1].values[0]='Q-SECOND';assert.throws(()=>preparePackage(s,manifest()),/ambiguous/);const m=manifest();m.image=null;assert.throws(()=>preparePackage(fixture(),m),/fallback/);m.text_fallback={allowed:true,reason:'technical',evidence:'missing approved image file'};assert.equal(preparePackage(fixture(),m).package.image,null);});
test('receipt projection roundtrip is idempotent, preserves unrelated/native fields, uses actual enums and blank unknown metrics',()=>{const s=fixture(),state=receipt(s),plan=receiptPlan(s,state,{run_id:'run1'});assert.equal(plan.changes.length,5);const after=applyPlanToSnapshot(s,plan);assert.equal(get(after,'post','投稿ステータス'),'posted');assert.equal(get(after,'queue','Status'),'posted');assert.equal(get(after,'post','BrowserEvidence'),'native-evidence');assert.equal(get(after,'queue','ReservationConfirmedAt'),'preserve');assert.match(get(after,'post','備考'),/^人のメモ\n/);assert.equal(get(after,'media','AttachState'),'attached');assert.equal(get(after,'kpi','Likes'),0);assert.equal(get(after,'kpi','Replies'),'');assert.equal(get(after,'kpi','Engagements'),'');assert.equal(get(after,'learning','ApplyStatus'),'proposed');assert.equal(get(after,'learning','Hypothesis'),'');assert.equal(get(after,'learning','Confidence'),'');assert.deepEqual(after.tables[TABS.news],s.tables[TABS.news]);assert.equal(receiptPlan(after,state,{run_id:'run2'}).changes.length,0);set(after,'learning','ApplyStatus','applied');set(after,'learning','Hypothesis','human analysis');assert.equal(receiptPlan(after,state,{run_id:'run3'}).changes.length,0);});
test('projection rejects edited cells/schema/IDs and handles moved rows by stable key',()=>{const s=fixture(),state=receipt(s),plan=receiptPlan(s,state,{run_id:'run1'});const edited=structuredClone(s);set(edited,'post','備考','changed');assert.throws(()=>applyPlanToSnapshot(edited,plan),/cell_changed/);const schema=structuredClone(s);schema.tables[TABS.post].headers.reverse();assert.throws(()=>applyPlanToSnapshot(schema,plan));const moved=structuredClone(s);moved.tables[TABS.post].rows[0].row_number=99;assert.equal(get(applyPlanToSnapshot(moved,plan),'post','投稿ステータス'),'posted');set(s,'post','XPostID','999');assert.throws(()=>receiptPlan(s,state,{run_id:'run1'}),/conflict/);});
test('POST receipt with failed GET retains ID and marks blocked; cannot reimport',()=>{const s=fixture(),state=receipt(s),p=state.posts['c-test'];p.status='posted_unverified';delete p.published_at;state.observations=[];state.halt={reason:'full_text_mismatch',at};const out=applyPlanToSnapshot(s,receiptPlan(s,state,{run_id:'run1'}));assert.equal(get(out,'queue','Status'),'blocked');assert.equal(get(out,'post','XPostID'),p.tweet_id);assert.throws(()=>preparePackage(out,manifest()));});
test('observation windows get stable unique event IDs; duplicate evidence fails closed',()=>{const s=fixture(),state=receipt(s);for(const hours of [24,72,168])state.observations.push({...state.observations[0],hours});const out=applyPlanToSnapshot(s,receiptPlan(s,state,{run_id:'run1'}));assert.equal(out.tables[TABS.kpi].rows.length,4);assert.equal(out.tables[TABS.learning].rows.length,4);state.observations.push(state.observations[0]);assert.throws(()=>receiptPlan(s,state,{run_id:'run1'}),/duplicate_projection/);});

function mockConfig(s){return {enabled:true,account:'KinoshitaTsks',reviewed_at:s.captured_at,valid_until:'2026-12-01T00:00:00Z',capabilities:{longform:true,oauth1_write:true,account_id:'42',media_upload:true,evidence:'MOCK'},jpy_per_usd_ceiling:150,tax_rate:0.1,margin_rate:0.1,prices:{create_usd:0.2,read_usd:0.005,upload_usd:0.01},pricing_evidence:'MOCK',billing:{news_only:true,valid_until:'2026-12-01T00:00:00Z',evidence:'MOCK',months:{'2026-10':{actual_minor_jpy:0,non_api_reserve_minor_jpy:0,reconciled_operation_ids:[]}}},account_inventory:{complete:true,uncoordinated_writers:false,valid_until:'2026-12-01T00:00:00Z',evidence:'MOCK'}};}
test('sheet -> approved package -> mock upload/create/read -> sheet receipts end to end',async()=>{
 const s=fixture(), prepared=preparePackage(s,manifest()), p=acceptPrepared(prepared,{by:'mock-parent',at:s.captured_at,sha256:prepared.required_approval_sha256});
 const state=initialState(), calls=[], checkpoints=[];
 const config=mockConfig(s);
 const api={upload:async()=>{calls.push('upload');return{id:'55',media_key:'3_55'};},create:async body=>{calls.push('create');assert.equal(body.text,text);return '1234567890123456789';},get:async id=>{calls.push('get');assert(checkpoints.some(x=>x.posts[p.id]?.tweet_id===id));return{data:{id,author_id:'42',created_at:at,note_tweet:{text},attachments:{media_keys:['3_55']},public_metrics:{impression_count:7}},includes:{media:[{media_key:'3_55',type:'photo'}]}};}};
 const result=await run({state,config,queue:[p],api,persist:async x=>checkpoints.push(structuredClone(x)),loadImage:async()=>Buffer.from('image'),now:()=>Date.parse(at)});
 assert.equal(result.halt,null); assert.deepEqual(calls,['upload','create','get']);
 const after=applyPlanToSnapshot(s,receiptPlan(s,state,{run_id:'mock-end-to-end'}));assert.equal(get(after,'post','投稿文_最終版'),text);assert.equal(get(after,'kpi','Impressions'),7);assert.equal(get(after,'post','PublishedAt'),at);assert.equal(get(after,'queue','ScheduledAt'),at);
});

test('reschedule keeps canonical IDs: abort -> pending revision -> mock publish -> one projection per row',async()=>{
 const s=fixture(), prepared=preparePackage(s,manifest());
 const approve=x=>acceptPrepared(x,{by:'mock-parent',at:s.captured_at,sha256:x.required_approval_sha256});
 let state=initialState(), clock=Date.parse(at), uploads=0, creates=0;
 const first=approve(prepared), config=mockConfig(s);
 const api={upload:async()=>({id:String(++uploads+54),media_key:`3_${uploads+54}`}),create:async()=>{creates++;return '1234567890123456789';},get:async id=>{
  const p=Object.values(state.posts).find(x=>x.tweet_id===id);return {data:{id,author_id:'42',created_at:p.scheduled_at,note_tweet:{text:p.text},attachments:{media_keys:[p.media_key]}},includes:{media:[{media_key:p.media_key,type:'photo'}]}};
 }};
 await run({state,config,queue:[first],api,loadImage:async()=>Buffer.from('image'),now:()=>clock,persist:async x=>{if(x.posts[first.id]?.status==='post_intent')clock+=16*60000;}});
 assert.equal(creates,0);assert.equal(state.posts[first.id].status,'aborted_before_post');
 const reserved=structuredClone(state.operations);
 const blocked=applyPlanToSnapshot(s,receiptPlan(s,state,{run_id:'abort'}));
 state=resolvePrePostAbort(state,first.id,{action:'rescheduled',replacement_id:'c-test-r2',evidence:'parent changes same article schedule',at:new Date(clock).toISOString()});
 const nextAt='2026-10-03T12:00:00+09:00';set(blocked,'post','予約日時',nextAt);set(blocked,'queue','ScheduledAt',nextAt);set(blocked,'post','投稿ステータス','ready');set(blocked,'queue','Status','ready');
 // Before replacement starts, old receipt only contributes history, never stale status/time.
 const pending=applyPlanToSnapshot(blocked,receiptPlan(blocked,state,{run_id:'pending'}));
 assert.equal(get(pending,'queue','Status'),'ready');assert.equal(get(pending,'queue','ScheduledAt'),nextAt);
 const nextManifest={...manifest(),attempt_revision:2,previous_attempt_id:first.id};
 const second=approve(preparePackage(pending,nextManifest));assert.equal(second.id,'c-test-r2');
 for(const k of ['post','queue','media','news'])assert.equal(second.source_refs[k],first.source_refs[k]);
 assert.deepEqual(state.operations,reserved);clock=Date.parse(nextAt);
 assert.equal((await run({state,config,queue:[first,second],api,loadImage:async()=>Buffer.from('image'),now:()=>clock,persist:async()=>{}})).halt,null);
 assert.equal(creates,1);assert.equal(uploads,2);assert.equal(state.posts[first.id].tweet_id,undefined);
 const plan=receiptPlan(pending,state,{run_id:'publish'});assert.equal(new Set(plan.changes.map(x=>x.sheet+':'+x.id)).size,plan.changes.length);
 const out=applyPlanToSnapshot(pending,plan);
 assert.equal(get(out,'post','ContentID'),'C-TEST');assert.equal(get(out,'media','ImageID'),'IMG-TEST');assert.equal(get(out,'queue','QueueID'),'Q-TEST');
 assert.equal(get(out,'queue','Status'),'posted');assert.equal(get(out,'post','PublishedAt'),nextAt);assert.equal(get(out,'post','予約日時'),nextAt);
 assert.match(get(out,'post','備考'),/\[ai-news:c-test\]/);assert.match(get(out,'post','備考'),/\[ai-news:c-test-r2\]/);
 assert.equal(receiptPlan(out,state,{run_id:'repeat'}).changes.length,0);
 const invalid=structuredClone(state);delete invalid.posts[second.id].source_refs.previous_attempt;assert.throws(()=>receiptPlan(out,invalid,{run_id:'bad'}),/attempt_source_mismatch/);
});
test('revision requires explicit predecessor and unlinked attempts never silently win by order',()=>{
 const s=fixture();assert.throws(()=>preparePackage(s,{...manifest(),attempt_revision:2}),/previous_attempt/);
 const state=receipt(s);state.posts.other={...structuredClone(state.posts['c-test']),id:'other'};
 assert.throws(()=>receiptPlan(s,state,{run_id:'bad'}),/ambiguous_attempt_history/);
});
