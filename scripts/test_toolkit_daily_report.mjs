import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source = execFileSync('python3', ['-c', "import zipfile; print(zipfile.ZipFile('downloads/ai-automation-toolkit-8f3a2c.zip').read('4_daily_report.gs').decode())"], {encoding:'utf8'});
const fmt = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tokyo'});
function run(code, rows) {
  const sent = [], prompts = [];
  const context = {
    SpreadsheetApp: {getActiveSpreadsheet: () => ({getSheetByName: () => ({getDataRange: () => ({getValues: () => rows})})})},
    Utilities: {formatDate: d => {if (!Number.isFinite(d.getTime())) throw new Error('Invalid date'); return fmt.format(d);}},
    Session: {getScriptTimeZone: () => 'Asia/Tokyo'},
    MailApp: {sendEmail: (...args) => sent.push(args)},
    askAI: prompt => {prompts.push(prompt); return 'Mock summary (not a live model result)';},
  };
  vm.createContext(context);
  vm.runInContext(code + '\ndailyReport();', context);
  return {sent, prompts};
}
for (const [label, code] of [
  ['download ZIP', source],
  ['published article', readFileSync('articles/gas-chatgpt-batch-summary-mail.md','utf8').split('```javascript').find(s => s.includes('function dailyReport()'))?.split('```')[0] || ''],
]) {
  assert.ok(code.includes('function dailyReport()'), `${label}: source found`);
  const today = new Date(), yesterday = new Date(Date.now()-86400000);
  const mixed = run(code, [['date','value'],[today,'today record'],['','blank record'],['not-a-date','bad record'],[yesterday,'old record']]);
  assert.equal(mixed.sent.length,1);
  assert.equal(mixed.prompts.length,1);
  assert.match(mixed.prompts[0],/today record/);
  assert.doesNotMatch(mixed.prompts[0],/blank record|bad record|old record/);
  const none = run(code,[['date','value'],['','blank'],['invalid','bad'],[yesterday,'old']]);
  assert.equal(none.prompts.length,0);
  assert.equal(none.sent.length,1);
  assert.match(none.sent[0][2],/対象データはありません/);
  console.log(`${label}: mixed-date filtering and no-data behavior passed (mocked Apps Script services; no network/mail)`);
}
