/**
 * CSV 月次・カテゴリ集計ツール（Google Apps Script）
 *
 * 1枚目のシートにある「日付 / 品目 / カテゴリ / 金額」を、月×カテゴリで集計し「集計結果」シートに出力します。
 * 外部API・追加費用なし。お客様ご自身のスプレッドシートにのみアクセスします。
 *
 * ※ 集計ロジックは transform.mjs（ダミーデータでテスト済み）と同一です。
 */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('集計')
    .addItem('月×カテゴリ集計', '集計する')
    .addToUi();
}

function 集計する() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const src = ss.getSheets()[0];
  const values = src.getDataRange().getValues();

  const totals = {};        // "月\tカテゴリ" -> {month, category, sum, count}
  let skipped = 0;

  for (let i = 1; i < values.length; i++) { // 1行目は見出し
    const row = values[i];
    const item = String(row[1] == null ? '' : row[1]).trim();
    if (item === '') { continue; }          // 品目が空 → 除外

    const month = normalizeMonth_(row[0]);
    if (!month) { skipped++; continue; }     // 日付が読めない → 除外

    const category = String(row[2] == null ? '' : row[2]).trim() || '未分類';
    const amount = toInt_(row[3]);

    const key = month + '\t' + category;
    if (!totals[key]) { totals[key] = { month: month, category: category, sum: 0, count: 0 }; }
    totals[key].sum += amount;
    totals[key].count += 1;
  }

  const rows = Object.keys(totals).map(function (k) { return totals[k]; }).sort(function (a, b) {
    if (a.month !== b.month) { return a.month < b.month ? -1 : 1; }
    return a.category < b.category ? -1 : (a.category > b.category ? 1 : 0);
  });

  const out = ss.getSheetByName('集計結果') || ss.insertSheet('集計結果');
  out.clear();
  out.getRange(1, 1, 1, 4).setValues([['月', 'カテゴリ', '合計金額', '件数']]);
  if (rows.length) {
    out.getRange(2, 1, rows.length, 4).setValues(rows.map(function (r) {
      return [r.month, r.category, r.sum, r.count];
    }));
  }

  SpreadsheetApp.getUi().alert('集計が完了しました。' + (skipped ? ('\n日付が読み取れず除外した行: ' + skipped) : ''));
}

function normalizeMonth_(v) {
  if (v instanceof Date) {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2);
  }
  const m = String(v == null ? '' : v).trim().replace(/\//g, '-').match(/^(\d{4})-(\d{1,2})-\d{1,2}$/);
  if (!m) { return null; }
  return m[1] + '-' + ('0' + m[2]).slice(-2);
}

function toInt_(v) {
  const digits = String(v == null ? '' : v).replace(/[^\d]/g, '');
  return digits === '' ? 0 : parseInt(digits, 10);
}
