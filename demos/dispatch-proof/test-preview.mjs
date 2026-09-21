import vm from 'node:vm';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const header=['id','date','from','to','driver'];
const valid=[header,['DEMO-A','2026-09-24','架空A','架空B','担当例'],['DEMO-B','2026-09-24','架空C','架空D','']];
let data=valid,book='TEST_DEMO',writes=[],inserts=[];
const context=vm.createContext({SpreadsheetApp:{getActiveSpreadsheet:()=>({getName:()=>book,getSheetByName:()=>({getDataRange:()=>({getDisplayValues:()=>data})}),insertSheet:name=>{inserts.push(name);return {getRange:(...range)=>({setValues:rows=>writes.push({range,rows})})};}})},Utilities:{getUuid:()=> 'synthetic123'}});
vm.runInContext(fs.readFileSync(new URL('./preview.gs',import.meta.url),'utf8'),context);
context.previewDispatch();assert.equal(writes[0].rows.length,3);assert.equal(writes[0].rows[2][6],'');
assert.equal(writes[0].rows[1][5],'要確認');
for(const bad of [[header,valid[1],valid[1]],[header,['x','2026-02-30','A','B','C']],[header,['x','2026-09-24','','B','C']],[['bad']]]) {
 data=bad;const before=inserts.length;assert.throws(()=>context.previewDispatch());assert.equal(inserts.length,before);
}
book='LIVE';data=valid;assert.throws(()=>context.previewDispatch(),/TEST_/);
const safe=context.planDispatchPreview([header,['=1','2026-09-24','+abc','B','@name']]);assert.equal(safe[1][0],"'=1");
assert.equal(safe[1][2],"'+abc");
console.log('PASS: assigned/unassigned previews, duplicate ID, invalid calendar date, missing location, bad header, TEST guard, formula-like text; invalid inputs cause no writes. Mock services only.');
