// Synthetic proof only. No Sheets/Gmail access, driver assignment or mail sending.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
const orders = [
  {id:'DEMO-001', date:'2026-09-23', from:'架空拠点A', to:'架空拠点B', driver:'担当例A'},
  {id:'DEMO-002', date:'2026-09-23', from:'架空拠点C', to:'架空拠点D', driver:''}
];
function build(rows, previous={}) {
  const seen=new Set(), ledger=[], previews=[], warnings=[];
  for(const r of rows) {
    if(!r.id || seen.has(r.id)) throw new Error('missing_or_duplicate_id');
    seen.add(r.id);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||!r.from||!r.to) throw new Error('incomplete_order');
    const fingerprint=JSON.stringify([r.date,r.from,r.to,r.driver]);
    ledger.push({...r, status:r.driver?'配車済み（人間が指定）':'未配車'});
    if(!r.driver) {warnings.push({id:r.id,reason:'未配車のため下書き対象外'});continue;}
    if(previous[r.id] && previous[r.id]!==fingerprint) warnings.push({id:r.id,reason:'変更あり：以前の下書きを人間が確認し、差替えが必要'});
    previews.push({id:r.id,driver:r.driver,subject:`回送確認 ${r.id}`,body:`日付: ${r.date}\n出発: ${r.from}\n到着: ${r.to}\n人間の確認後に送信してください。`,fingerprint});
  }
  return {ledger,previews,warnings};
}
const first=build(orders);
assert.equal(first.ledger.length,2);assert.equal(first.previews.length,1);
assert.equal(first.warnings[0].id,'DEMO-002');
assert.deepEqual(build(orders),first); // same input yields same plan, not duplicate writes
assert.throws(()=>build([orders[0],orders[0]]),/duplicate_id/);
assert.throws(()=>build([{...orders[0],from:''}]),/incomplete_order/);
const changed=build([{...orders[0],driver:'担当例B'}],{'DEMO-001':first.previews[0].fingerprint});
assert.equal(changed.warnings.length,1);
assert.equal(changed.previews[0].driver,'担当例B');
const report={synthetic:true,external_calls:0,tests_passed:6,first_run:first,changed_assignment:changed,limitations:['Pure JavaScript plan only; not deployed to GAS','No real Gmail drafts or sheet writes','No claim of concurrency, rollback, layout/formula preservation or complete Phase1 implementation']};
writeFileSync(new URL('./result.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log('6 checks passed; synthetic result.json generated; no external calls.');
