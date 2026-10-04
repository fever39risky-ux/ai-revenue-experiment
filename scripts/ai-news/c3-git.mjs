import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {digest,claimStage,applyReceipt} from './c3-bridge.mjs';
export const PATHS={state:'social/ai-news/c3/state.json',material:'social/ai-news/c3/material.json',image:'social/ai-news/c3/image.bin',history:'social/x_experiment_history.json'};
const ok=(v,m)=>{if(!v)throw Error(m);};
export const git=(repo,args)=>execFileSync('git',args,{cwd:repo,stdio:['ignore','pipe','pipe'],maxBuffer:8*1024*1024});
export function readSnapshot(repo,{fetch=true,ref='refs/remotes/origin/main'}={}){
  ok(ref==='refs/remotes/origin/main'||/^[a-f0-9]{40}$/.test(ref),'snapshot ref');
  if(fetch)git(repo,['fetch','origin','main']);
  const commit=git(repo,['rev-parse',ref]).toString().trim();ok(/^[a-f0-9]{40}$/.test(commit),'commit');
  const json=p=>JSON.parse(git(repo,['show',`${commit}:${p}`]));
  const state=json(PATHS.state),history=json(PATHS.history);
  return {commit,state,history,state_sha256:digest(state),history_sha256:digest(history)};
}
export function readMaterial(repo,sha){
  ok(/^[a-f0-9]{40}$/.test(sha),'code SHA');
  return {queue:JSON.parse(git(repo,['show',`${sha}:${PATHS.material}`])),image:git(repo,['show',`${sha}:${PATHS.image}`])};
}
// Parent-side only. Dedicated clean checkout at current remote main is required.
// Ordinary non-force push acts as CAS: a competing commit rejects our mutation.
// After failure leave the local commit intact; never rebase/retry automatically.
export function persist(repo,command,input,now=new Date()){
  ok(!git(repo,['status','--porcelain']).toString().trim(),'dedicated clean checkout required');
  const before=readSnapshot(repo),head=git(repo,['rev-parse','HEAD']).toString().trim();
  ok(head===before.commit,'checkout must equal freshly fetched main');
  const material=readMaterial(repo,input.code_sha);
  ok(digest(material.queue)===before.state.material_sha256,'material changed');
  let next;
  if(command==='claim'){
    git(repo,['merge-base','--is-ancestor',input.code_sha,before.commit]);
    next={state:claimStage(before.state,before.history,material.queue,material.image,input,now),history:before.history};
  }else if(command==='apply'){
    // Re-read the actual committed intent, rather than trusting receipt metadata.
    const intent=readSnapshot(repo,{fetch:false,ref:input.intent_commit});
    ok(intent.state_sha256===input.intent_sha256&&intent.history_sha256===input.history_sha256,'receipt has no matching Git intent');
    git(repo,['merge-base','--is-ancestor',input.intent_commit,before.commit]);
    next=applyReceipt(before.state,before.history,material.queue,input);
  }else throw Error('command');
  writeFileSync(join(repo,PATHS.state),JSON.stringify(next.state,null,2)+'\n');
  writeFileSync(join(repo,PATHS.history),JSON.stringify(next.history,null,2)+'\n');
  git(repo,['add','--',PATHS.state,PATHS.history]);
  git(repo,['commit','-m',`C3 ${command} ${input.stage} run ${input.run_id}`]);
  const commit=git(repo,['rev-parse','HEAD']).toString().trim();
  git(repo,['push','origin','HEAD:refs/heads/main']); // Never force or retry.
  const after=readSnapshot(repo);git(repo,['merge-base','--is-ancestor',commit,after.commit]);
  ok(after.state_sha256===digest(next.state),'remote state advanced/conflicted; inspect before continuing');
  if(command==='apply'&&input.stage==='post')ok(after.history.posts.some(p=>p.content_id===next.state.content_id&&p.catch_up_run_id===input.run_id),'history not durable');
  if(command==='apply'&&input.stage==='verify'&&input.outcome==='confirmed')ok(after.history.posts.some(p=>p.content_id===next.state.content_id&&p.status==='published_verified'&&p.tweet_id===input.post_id),'verified history not durable');
  return {commit,remote_commit:after.commit,state_sha256:after.state_sha256,history_sha256:after.history_sha256};
}
