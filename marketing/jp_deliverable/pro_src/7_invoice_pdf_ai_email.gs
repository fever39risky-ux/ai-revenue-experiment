/**
 * 請求書PDF自動作成 ＋ AI添え状メール下書き — PRO追加スクリプト②
 * スプレッドシートの1行から、消費税込みの請求書PDFを自動生成し、
 * AIが書いた添え状つきのGmail下書きを作る（自動送信はしない）。
 *
 * 導入手順：
 *  1) スプレッドシートに「invoices」という名前のシートを作り、1行に1請求を入れる
 *     列：A請求先会社 / B宛名 / Cメール / D件名 / E明細(品目;数量;単価を改行区切り) / F状態
 *  2) 「拡張機能」→「Apps Script」に、このファイルの中身だけを貼る（自己完結）
 *  3) 下の CONFIG を自社向けに設定（自社名・登録番号・振込先など）
 *  4) 一度 手動で buildInvoices を実行して動作確認（初回は権限承認が必要）
 *
 * 安全メモ：金額・消費税・合計はすべてコードで計算する（AIには文章だけ書かせる）。
 *          自動送信はしない。PDFと下書きを作るところまで。
 */

const CONFIG = {
  API_KEY: 'ここにOpenAI APIキー(sk-...)',   // ← ここだけ変更
  MODEL: 'gpt-4o-mini',
  SHEET_NAME: 'invoices',
  DONE_MARK: '作成済',
  STATUS_COL: 6,                 // F列 = 状態
  TAX_RATE: 0.10,                // 消費税10%
  ISSUER: '〇〇商店 / 山田太郎',  // 自社名（請求元）
  ISSUER_DETAIL: '登録番号 T0000000000000\n振込先: 〇〇銀行 △△支店 普通 1234567',
  PDF_FOLDER: '請求書PDF',        // 保存先ドライブフォルダ（自動作成）
  DUE_DAYS: 30                   // 支払期限（発行日から）
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('請求書')
    .addItem('未処理の行を一括作成', 'buildInvoices').addToUi();
}

function buildInvoices() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEET_NAME);
  const folder = _getOrCreateFolder(CONFIG.PDF_FOLDER);
  const values = sheet.getDataRange().getValues();

  let done = 0;
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const [company, name, email, subject, itemsRaw, status] = row;
    if (!company || status === CONFIG.DONE_MARK) continue;
    try {
      const items = _parseItems(itemsRaw);
      if (items.length === 0) throw new Error('明細が空です');

      const totals = _calcTotals(items);
      const no = _invoiceNo(r);
      const pdf = _makePdf(folder, no, { company, name, subject, items, totals });

      const mailBody = _draftCoverEmail(name || company, subject, totals.total);
      GmailApp.createDraft(email || '', '請求書送付のご案内（' + subject + '）', mailBody,
        { attachments: [pdf.getBlob()] });

      sheet.getRange(r + 1, CONFIG.STATUS_COL).setValue(CONFIG.DONE_MARK);
      done++;
      Utilities.sleep(400);
    } catch (e) {
      sheet.getRange(r + 1, CONFIG.STATUS_COL).setValue('ERROR: ' + e.message);
    }
  }
  SpreadsheetApp.getActiveSpreadsheet().toast('請求書 ' + done + ' 件を作成しました', '請求書', 5);
}

function _parseItems(raw) {
  return String(raw || '').split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const [name, qty, price] = line.split(';').map(x => (x || '').trim());
    return { name, qty: Number(qty) || 0, price: Number(price) || 0 };
  }).filter(it => it.name && it.qty > 0);
}

function _calcTotals(items) {
  const subtotal = items.reduce((s, it) => s + it.qty * it.price, 0);
  const tax = Math.round(subtotal * CONFIG.TAX_RATE);
  return { subtotal, tax, total: subtotal + tax };
}

function _makePdf(folder, no, inv) {
  const doc = DocumentApp.create('invoice-' + no);
  const b = doc.getBody();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy年MM月dd日');
  const due = Utilities.formatDate(new Date(Date.now() + CONFIG.DUE_DAYS * 864e5),
                                   Session.getScriptTimeZone(), 'yyyy年MM月dd日');

  b.appendParagraph('請求書').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  b.appendParagraph(inv.company + ' 御中');
  b.appendParagraph('件名: ' + inv.subject);
  b.appendParagraph('請求書番号: ' + no + '　発行日: ' + today + '　支払期限: ' + due);
  b.appendParagraph('');

  const rows = [['品目', '数量', '単価', '金額']];
  inv.items.forEach(it => rows.push(
    [it.name, String(it.qty), _yen(it.price), _yen(it.qty * it.price)]));
  rows.push(['', '', '小計', _yen(inv.totals.subtotal)]);
  rows.push(['', '', '消費税(10%)', _yen(inv.totals.tax)]);
  rows.push(['', '', 'ご請求金額', _yen(inv.totals.total)]);
  b.appendTable(rows);

  b.appendParagraph('');
  b.appendParagraph(CONFIG.ISSUER);
  b.appendParagraph(CONFIG.ISSUER_DETAIL);
  doc.saveAndClose();

  const id = doc.getId();
  const pdf = folder.createFile(DriveApp.getFileById(id).getAs('application/pdf'))
                    .setName('invoice-' + no + '.pdf');
  DriveApp.getFileById(id).setTrashed(true);
  return pdf;
}

function _draftCoverEmail(name, subject, total) {
  const prompt =
    'あなたは丁寧なビジネス日本語を書く担当者です。以下の条件で、請求書を送付する短い添え状メールの本文だけを書いてください。' +
    '署名や件名は不要。過度な謝罪や誇張はせず、簡潔に。\n' +
    '宛名: ' + name + ' 様\n用件: 「' + subject + '」の請求書を添付で送付\n請求金額: ' + _yen(total) +
    '（税込）\n支払期限は添付PDFに記載、と一言添える。';
  try { return _askAI(prompt) + '\n\n' + CONFIG.ISSUER; }
  catch (e) {
    return name + ' 様\n\nいつもお世話になっております。\n「' + subject +
      '」の請求書を添付いたします。ご確認のほどよろしくお願いいたします。\n\n' + CONFIG.ISSUER;
  }
}

function _askAI(prompt) {
  if (!CONFIG.API_KEY || CONFIG.API_KEY.indexOf('sk-') !== 0) throw new Error('APIキー未設定');
  const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post', contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.API_KEY },
    payload: JSON.stringify({ model: CONFIG.MODEL, temperature: 0.3,
      messages: [{ role: 'user', content: prompt }] }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = JSON.parse(res.getContentText() || '{}');
  if (code !== 200) throw new Error((body.error && body.error.message) || ('HTTP ' + code));
  return body.choices[0].message.content.trim();
}

function _invoiceNo(rowIndex) {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' +
         ('00' + rowIndex).slice(-3);
}
function _yen(n) { return '¥' + Number(n).toLocaleString('ja-JP'); }
function _getOrCreateFolder(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
