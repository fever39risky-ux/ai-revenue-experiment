/** @OnlyCurrentDoc */
// TEST spreadsheet only. No Gmail scope, drafts or send operation.
function previewDispatch() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || !ss.getName().startsWith('TEST_')) throw new Error('TEST_ workbook required');
  var input = ss.getSheetByName('DEMO_INPUT');
  if (!input) throw new Error('DEMO_INPUT required');
  var table = input.getDataRange().getDisplayValues();
  var output = planDispatchPreview(table); // validate all input before any writes
  var name = 'PREVIEW_' + Utilities.getUuid().slice(0, 8);
  var sheet = ss.insertSheet(name); // create only; never clear/overwrite existing sheets
  sheet.getRange(1, 1, output.length, output[0].length).setValues(output);
  return name;
}
function planDispatchPreview(table) {
  var expected = ['id','date','from','to','driver'];
  if (!table.length || JSON.stringify(table[0]) !== JSON.stringify(expected)) throw new Error('header mismatch');
  var seen = Object.create(null);
  var out = [['管理番号','日付','出発','到着','担当','確認状態','文面プレビュー（送信なし）']];
  table.slice(1).forEach(function(row) {
    if (row.every(function(v){return !String(v).trim();})) return;
    if(row.length !== 5) throw new Error('column count');
    var r=row.map(function(v){return String(v).trim();});
    if(!r[0] || Object.prototype.hasOwnProperty.call(seen,r[0])) throw new Error('missing/duplicate id');
    seen[r[0]]=true;
    var d=new Date(r[1]+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(r[1]) || !isFinite(d.getTime()) || d.toISOString().slice(0,10)!==r[1]) throw new Error('invalid date');
    if(!r[2]||!r[3]) throw new Error('missing location');
    var message=r[4] ? '管理番号 '+r[0]+' / '+r[1]+' / '+r[2]+' → '+r[3]+' / 担当 '+r[4]+'（人間による確認が必要）' : '';
    out.push(r.concat([r[4]?'要確認':'未配車',message]).map(function(v){return /^[=+@-]/.test(v)?"'"+v:v;}));
  });
  return out;
}
