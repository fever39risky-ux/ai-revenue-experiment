import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {LIVE_READY,validateClaim,execute,sign} from './c3-bridge.mjs';
import {readSnapshot,readMaterial} from './c3-git.mjs';
try{
  if(!LIVE_READY)throw Error('LIVE_HOLD_UPLOAD_PRICE'); // Before any file/env Secret/network.
  const command=process.argv[2];if(!['gate','execute'].includes(command))throw Error('command');
  const ctx={stage:process.env.C3_STAGE,ref:process.env.GITHUB_REF,run_id:process.env.GITHUB_RUN_ID,run_attempt:process.env.GITHUB_RUN_ATTEMPT,code_sha:process.env.GITHUB_SHA};
  if(ctx.ref!=='refs/heads/main'||ctx.run_attempt!=='1'||!['upload','post','verify'].includes(ctx.stage))throw Error('context');
  const {queue,image}=readMaterial(process.cwd(),ctx.code_sha);
  const dir=join(process.env.RUNNER_TEMP,'c3-receipts');mkdirSync(dir,{recursive:true,mode:0o700});const snapshot=join(dir,'claim-snapshot.json');
  const fresh=()=>readSnapshot(process.cwd());
  if(command==='gate'){
    console.log(JSON.stringify({event:'waiting_for_durable_C3_claim',...ctx}));let approved;
    for(let i=0;i<60;i++){
      const p=fresh();if(p.state.attempts.some(a=>a.stage===ctx.stage)){validateClaim(p.state,p.history,queue,image,ctx);approved=p;break;}
      await new Promise(resolve=>setTimeout(resolve,5000));
    }
    if(!approved)throw Error('claim timeout');writeFileSync(snapshot,JSON.stringify(approved),{flag:'wx',mode:0o600});
  }else{
    const saved=JSON.parse(readFileSync(snapshot));
    const receipt=await execute({state:saved.state,history:saved.history,queue,image,ctx,receiptDir:dir,remoteProof:fresh,transport:async request=>{
      const response=await fetch(request.url,{method:request.method,headers:sign(request,process.env),...(request.body?{body:JSON.stringify(request.body)}:{}),redirect:'error',signal:AbortSignal.timeout(30000)});
      return {status:response.status,body:await response.json()};
    }});
    console.log('C3_RECEIPT='+JSON.stringify(receipt));if(receipt.outcome!=='confirmed')process.exitCode=1;
  }
}catch{console.error(LIVE_READY?'C3_STOPPED_NO_RETRY':'LIVE_HOLD_UPLOAD_PRICE: zero X requests');process.exitCode=1;}
