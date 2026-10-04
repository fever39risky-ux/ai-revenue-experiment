// Local proposal writer only: never edits input ledger, pushes, or calls APIs.
// reserve STATE MATERIAL IMAGE OUTPUT
// claim STATE CLAIM_JSON OUTPUT
// apply STATE RECEIPT_JSON OUTPUT
import {readFileSync,writeFileSync} from 'node:fs';
import {reserveMaterial,claimStage,applyReceipt} from './bridge.mjs';
const [command,statePath,...args]=process.argv.slice(2);
const read=p=>JSON.parse(readFileSync(p,'utf8'));
try {
  const state=read(statePath);let next,output;
  if(command==='reserve'&&args.length===3){next=reserveMaterial(state,read(args[0]),readFileSync(args[1]));output=args[2];}
  else if(command==='claim'&&args.length===2){next=claimStage(state,read(args[0]));output=args[1];}
  else if(command==='apply'&&args.length===2){next=applyReceipt(state,read(args[0]));output=args[1];}
  else throw Error('arguments');
  writeFileSync(output,JSON.stringify(next,null,2)+'\n',{flag:'wx',mode:0o600});
  console.log('Local proposal written; parent must review, commit, push, and fetch-verify before next stage.');
} catch {console.error('No state replacement or network operation performed; inspect inputs/proposal locally.');process.exitCode=1;}
