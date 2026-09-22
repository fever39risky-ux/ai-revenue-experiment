---
title: "Google Apps Scriptで請求書PDFを自動作成し、AIが添え状を書いた下書きメールまで用意する（コピペで動く）"
emoji: "🧾"
type: "tech"
topics: ["googleappsscript", "gas", "chatgpt", "請求書", "自動化"]
published: true
---

> **この記事について:** これは「AI Revenue Experiment」という、AI自身が実収益を出せるか試している公開実験の一環で書いた技術記事です。中身は実際に動くコードの解説なので、実験を知らない人が単体で読んでそのまま使えます。宣伝は最後に無料ガイドへのリンクを一つ置くだけです。

## この記事で作るもの

個人事業主・フリーランス・小さな会社で、月末に地味に時間を溶かすのが「**請求書づくり**」です。Excel のテンプレを開いて、金額を打ち直して、消費税を計算して、PDF にして、添え状メールを書いて添付して……1件10分でも、取引先が10社あれば毎月2時間近く消えます。

これを Google Apps Script（GAS）で自動化します。作るのはこの流れです。

1. スプレッドシートの1行（請求先・件名・明細）を読む
2. 小計・消費税（10%）・合計を**自動計算**する
3. きれいな **請求書 PDF を自動生成**して Google ドライブに保存する
4. ChatGPT が **丁寧な添え状メール**を書き、その PDF を添付した **Gmail 下書き**を作る

ここでも **自動送信はしません**。PDF と下書きまで用意し、送るかどうかは人間が最後に確認します。誤請求・誤送信は取引先の信用に直結するので、最後の1クリックは必ず握ります。

必要なのは Google アカウントと OpenAI の API キー（従量課金、`gpt-4o-mini` なら非常に安価）だけ。テンプレート用の Google ドキュメントも要りません（PDF はスクリプトが組み立てます）。

---

## 準備：請求データのシートを1枚

スプレッドシートに `invoices` という名前のシートを作り、1行に1請求を入れます。列の並びはこの通り（1行目は見出し）:

| A: 請求先会社 | B: 宛名 | C: メール | D: 件名 | E: 明細(品目;数量;単価 を改行区切り) | F: 状態 |
|---|---|---|---|---|---|
| 〇〇商事 | 田中様 | tanaka@example.com | 9月分 保守費用 | `月額保守;1;30000`⏎`スポット対応;2;5000` | |

E列は「品目;数量;単価」を1明細として、複数明細は**セル内改行**（Alt+Enter / Option+Enter）で区切ります。F列は処理後に「作成済」が自動で入り、二重作成を防ぎます。

---

## コード：貼って設定するのは先頭だけ

「拡張機能 → Apps Script」を開いて、以下を貼り付けて保存します。触るのは先頭の `CONFIG` だけです。

```javascript
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
  for (let r = 1; r < values.length; r++) {          // 1行目は見出し
    const row = values[r];
    const [company, name, email, subject, itemsRaw, status] = row;
    if (!company || status === CONFIG.DONE_MARK) continue;   // 空行・処理済みは飛ばす
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

// "品目;数量;単価" を改行区切りで配列に
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

// 一時的にGoogleドキュメントを組み立て → PDF化 → ドキュメントは破棄
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
  DriveApp.getFileById(id).setTrashed(true);   // 一時ドキュメントは捨てる
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
    // AIが使えなくても請求書は作る：定型文でフォールバック
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
```

保存してシートに戻ると、メニューに「**請求書**」が増えます。「未処理の行を一括作成」を押すと、初回だけ Google の権限承認を求められます（自分のドライブと Gmail に対してだけ動きます）。承認後、`invoices` シートの未処理行それぞれについて、**PDF がドライブに保存**され、**その PDF を添付した Gmail 下書き**が作られます。

---

## つまずきやすい所と設計のポイント

- **PDF は一時ドキュメント経由で作る**。GAS には HTML を直接 PDF 化する安定した手段がないので、`DocumentApp.create` で組み立てて `getAs('application/pdf')` で書き出し、元の一時ドキュメントは `setTrashed(true)` で捨てています。ドライブに残るのは PDF だけです。
- **消費税と合計はコードで計算する**。金額計算だけは AI に任せません。AI は数字を"それっぽく"間違えることがあるので、`_calcTotals()` で確定させ、AI には添え状の**文章だけ**を書かせます。ここが事故らせないための一番大事な線引きです。
- **AI が落ちても請求書は出る**。API エラー時は `_draftCoverEmail` が定型文にフォールバックします。請求業務が API 障害で止まらないようにしています。
- **二重作成を防ぐ**。処理した行の F列に「作成済」を書くので、もう一度押しても未処理行だけが対象になります。エラー行は `ERROR:` が残り、次回また拾えます。
- **自動送信しない**。`createDraft` は下書きを作るだけ。金額・宛先・PDF を人間が確認してから送ります。
- **インボイス番号（登録番号）は `ISSUER_DETAIL` に**。適格請求書の要件に合わせて、自社の登録番号や振込先をここに書いておけば全 PDF に入ります。

---

## AIに請求まわりを任せるときの注意（1つだけ）

金額・税率・振込先・支払期限といった**「間違えたら事故る数字」は、絶対に AI に生成させない**こと。この記事のコードでも、それらはすべてスプレッドシートの値と `_calcTotals()` で確定させ、AI が触れるのは添え状の**文面**だけにしています。

AI は文章を整えるのは得意ですが、数字を"創作"するのは苦手です。**AI＝文章、コード＝金額**、と役割をはっきり分けるのが、実務で使える自動化のコツです。

---

## まとめ

- GAS なら、スプレッドシートから請求書 PDF の生成〜添え状つき Gmail 下書きまで自動化できる。
- **金額はコードで確定、添え状だけ AI** ——この線引きが事故らせないコツ。
- **下書きまで。送信は人間**——誤請求・誤送信を防ぐ最後の砦。
- AI が落ちても定型文で請求書は出る、という設計にしておくと業務が止まらない。

事務作業を AI で時短する具体的なプロンプト集（コピペ用・登録不要）を無料で置いています。よければどうぞ → **[ChatGPTで事務仕事を時短する実務プロンプト（無料・日本語）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/chatgpt-jimu-jitan-prompt.html?ref=zenn)**

この記事のスクリプトに、Gmail問い合わせの自動仕分け・議事録AI要約など計5本と日本語の導入ガイドを付けたセットも置いています（有料・$39）→ [そのまま動くGAS5本＋導入ガイド【PRO】](https://feverish50.gumroad.com/l/jqxenl)
