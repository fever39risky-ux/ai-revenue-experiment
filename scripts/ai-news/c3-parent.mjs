// Explicit parent command: commits and pushes ONLY C3 state/history.
// node scripts/ai-news/c3-parent.mjs claim|apply INPUT_JSON CLEAN_CHECKOUT
import {readFileSync} from 'node:fs';
import {persist} from './c3-git.mjs';
const [command,path,repo]=process.argv.slice(2);
try{if(!['claim','apply'].includes(command)||!path||!repo)throw Error('arguments');console.log(JSON.stringify(persist(repo,command,JSON.parse(readFileSync(path)))));}
catch{console.error('C3_PARENT_STOPPED: inspect local/remote state; no automatic retry or rebase.');process.exitCode=1;}
