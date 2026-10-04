import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {LIVE_READY,digest,validateClaim,execute,sign} from './bridge.mjs';
const command=process.argv[2];
try {
  // Before file/credential access or network, even if invoked outside workflow.
  if(!LIVE_READY)throw Error('LIVE_HOLD_UPLOAD_PRICE');
  const week=process.env.ARTICLE_WEEK,stage=process.env.ARTICLE_STAGE;
  if(!/^AI-WEEKLY-\d{4}-\d{2}-\d{2}$/.test(week)||!['upload','draft','publish','verify'].includes(stage))throw Error('INPUT_INVALID');
  if(!['gate','execute'].includes(command))throw Error('COMMAND_INVALID');
  const ctx={stage,run_id:process.env.GITHUB_RUN_ID,run_attempt:process.env.GITHUB_RUN_ATTEMPT,code_sha:process.env.GITHUB_SHA,ref:process.env.GITHUB_REF};
  if(ctx.ref!=='refs/heads/main'||ctx.run_attempt!=='1')throw Error('RUN_INVALID');
  const git=args=>execFileSync('git',args,{stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
  const material=JSON.parse(git(['show',`${ctx.code_sha}:social/ai-weekly/materials/${week}/material.json`]));
  const image=git(['show',`${ctx.code_sha}:social/ai-weekly/materials/${week}/cover.bin`]);
  if(material.week_id!==week)throw Error('WEEK_MISMATCH');
  const dir=join(process.env.RUNNER_TEMP,'ai-weekly-receipts');mkdirSync(dir,{recursive:true,mode:0o700});
  const snapshot=join(dir,'claim-snapshot.json');
  function fresh(){git(['fetch','origin','main']);const commit=git(['rev-parse','refs/remotes/origin/main']).toString().trim();const state=JSON.parse(git(['show',`${commit}:social/ai-weekly/state.json`]));return {state,commit,state_sha256:digest(state)};}
  if(command==='gate') {
    console.log(JSON.stringify({event:'waiting_for_parent_intent',week_id:week,stage,run_id:ctx.run_id,code_sha:ctx.code_sha}));
    let approved;
    for(let i=0;i<60;i++) {
      const current=fresh();
      const a=current.state.articles.find(x=>x.week_id===week)?.attempts.find(x=>x.stage===stage);
      if(a){validateClaim(current.state,material,image,ctx);approved=current;break;}
      await new Promise(resolve=>setTimeout(resolve,5000));
    }
    if(!approved)throw Error('INTENT_TIMEOUT');
    writeFileSync(snapshot,JSON.stringify(approved),{flag:'wx',mode:0o600});
  } else {
    const saved=JSON.parse(readFileSync(snapshot));
    const receipt=await execute({state:saved.state,material,image,ctx,receiptDir:dir,remoteProof:async()=>fresh(),transport:async request=>{
      const response=await fetch(request.url,{method:request.method,headers:sign(request,process.env),...(request.body?{body:JSON.stringify(request.body)}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});
      return {status:response.status,body:await response.json()};
    }});
    console.log('ARTICLE_RECEIPT='+JSON.stringify(receipt));
    if(!['confirmed','verified_existence_only'].includes(receipt.outcome))process.exitCode=1;
  }
} catch {
  // Do not surface subprocess output, OAuth headers, or remote error text.
  console.error(LIVE_READY?'ARTICLE_STAGE_STOPPED_NO_RETRY':'LIVE_HOLD_UPLOAD_PRICE: no X request attempted');process.exitCode=1;
}
