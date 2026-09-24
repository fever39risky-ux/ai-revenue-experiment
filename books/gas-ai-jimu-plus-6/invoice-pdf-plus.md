---
title: "請求書PDF自動作成＋AI添え状メール下書き【拡張版】"
---

無料で読めるZenn記事版（[こちら](https://zenn.dev/kinoshita_ai/articles/gas-invoice-pdf-ai-email)）の仕組みをベースに、実務で使うための機能を足した版です。

## 記事版からの追加点

```text
(1) 税率ごとの区分：10%・8%（軽減税率）・対象外（立替金など）を明細ごとに指定。
    税率ごとの合計額と消費税額をPDFに表示し、端数処理は税率ごとに1回。
(2) 源泉徴収：G列に「する」と入れた請求だけ、源泉徴収税額を差し引いた請求額にする。
(3) 請求書番号の連番：INV-2026-0001 のような年ごとの通し番号。
(4) 支払期限：「月末締め翌月末払い」か「発行日から○日後」。
(5) お試しモード：DRY_RUN で、PDFも下書きも作らず計算結果だけをログで確認。
(6) 添え状の金額チェック：AIの文面に正しい請求額が入っていなければ定型文に切り替え。
```

## 導入手順

必要なもの：Googleアカウントと OpenAI の APIキー（従量課金。gpt-4o-mini は非常に
安価）。ChatGPT の有料プランは不要です。APIキーが無くても、添え状が定型文になる
だけで、請求書PDFと下書きは作られます。

### 【1】スプレッドシートを用意する

新しいスプレッドシートを作り、シート名を「invoices」に変えます。
02_sample_invoices.csv を「ファイル → インポート → 現在のシートを置換」で読み込むと、
見出しと見本3件がそのまま入ります。列の意味：
  A 請求先会社 / B 宛名 / C メール / D 件名 / E 明細 / F 状態（空欄のまま）/ G 源泉徴収
E列は1行に1明細で「品目;数量;単価;税率」。税率は 10 / 8 / 0（省略すると10）。
複数明細はセル内改行（Windows: Alt+Enter / Mac: Option+Enter）で区切ります。
単価は税抜です。立替金（交通費の実費など）は税率0にすると、消費税も源泉徴収も
かかりません。
G列に「する」と入れた行だけ、源泉徴収税額を差し引いた金額で請求します。

### 【2】スクリプトを貼る

スプレッドシートの「拡張機能 → Apps Script」を開き、最初からあるコードを全部消して、
invoice_pdf_ai_email_plus.gs の中身を丸ごと貼り付け → 保存。

### 【3】CONFIG を設定する（ファイル先頭）

・API_KEY：OpenAI の APIキー（sk- で始まる文字列。他人に見せないでください）
・ISSUER：自社名・屋号とお名前
・REG_NO：適格請求書発行事業者の登録番号。登録していなければ '' にします
・ISSUER_DETAIL：住所・振込先など、PDFの最後に入れたい情報
・ROUNDING：消費税の端数処理（'floor' 切り捨て / 'round' 四捨五入 / 'ceil' 切り上げ）
・DUE_MODE：'month_end_next'（翌月末）か 'days'（発行日から DUE_DAYS 日後）
・NUMBER_PREFIX：請求書番号の頭（INV → INV-2026-0001）
・DRY_RUN：最初は true のまま。

### 【4】お試し実行

上部の関数選択で buildInvoices を選び「実行」。初回は権限の承認画面が出ます
（「詳細」→「安全ではないページに移動」→ 許可。自分で作ったスクリプトなので
問題ありません）。下の「実行ログ」に、行ごとの税率別の金額・消費税・源泉徴収額・
請求額・支払期限が出ます。DRY_RUN=true の間は、PDFも下書きも番号も一切作りません。
見本データなら、2行目は請求額 ¥44,000、3行目は ¥103,925（源泉徴収 ¥10,516 差引後）です。

### 【5】本番化

計算に納得できたら DRY_RUN を false にして保存。シートを開き直すとメニューに
「請求書」が出るので、「未処理の行を一括作成」を押します。
・PDF はドライブの「請求書PDF」フォルダに保存されます
・その PDF を添付した Gmail 下書きができます（自動送信はしません）
・F列に「作成済 INV-2026-0001」のように番号が入り、もう一度押しても作り直しません

### よくあるつまずき

・メニューが出ない → シートを再読み込み。または Apps Script から onOpen を1回実行
・F列に「ERROR: 税率は10・8・0のどれか」→ E列の4つ目の値を確認
・F列に「ERROR: 明細が空です」→ 数量が0や空欄、区切りが「;」（半角）になっているか確認
・番号を最初からやり直したい → Apps Script の「プロジェクトの設定 → スクリプト
  プロパティ」で INVOICE_SEQ_2026 を削除（または書き換え）
・同じ行を作り直したい → F列を空欄に戻す（番号は新しく振られます）

ご注意
・源泉徴収の要否、登録番号の記載、端数処理の方法などの税務判断は、ご自身の事業に
  合わせて確認してください（税務上の助言ではありません）。
・源泉徴収額は、税率0以外の明細の税抜合計に対して、100万円以下の部分 10.21%、
  超える部分 20.42% で計算し、1円未満を切り捨てます。
・送信前に、宛先・金額・PDF を必ずご自身で確認してください。

## コード全文（invoice_pdf_ai_email_plus.gs）

ファイル全体をコピーして、Apps Script エディタに貼り付けてください。

```js
/**
 * 請求書PDF自動作成 ＋ AI添え状メール下書き【拡張版】
 * スプレッドシートの1行から、適格請求書の記載事項に沿った請求書PDFを作り、
 * AIが書いた添え状つきのGmail下書きを用意する（自動送信はしない）。
 *
 * Zenn記事版からの追加点
 *  (1) 税率ごとの区分：10%・8%（軽減）・対象外（立替金など）を明細ごとに指定。
 *      税率ごとの合計額と消費税額を表示し、端数処理は税率ごとに1回。8%明細には※印。
 *  (2) 源泉徴収：個人の方への報酬など、源泉徴収する請求に対応（10.21%／100万円超の部分は20.42%）。
 *  (3) 請求書番号の連番：INV-2026-0001 のように、行番号ではなく通し番号で採番。
 *  (4) 支払期限：「発行日から○日」か「月末締め翌月末払い」を選べる。
 *  (5) お試しモード：DRY_RUN=true の間は、PDFも下書きも作らず、計算結果をログに出すだけ。
 *
 * 明細（E列）の書き方：1行に1明細、「品目;数量;単価;税率」。税率は 10 / 8 / 0 で、省略すると 10。
 *   例）Webサイト更新作業;1;50000
 *       打合せ時の飲食物;1;3000;8
 *       交通費（立替）;1;1200;0
 * 単価は税抜で入れます。税率0の明細は、消費税も源泉徴収も計算しません。
 *
 * 安全メモ：金額・消費税・源泉徴収額はすべてコードで計算し、AIには添え状の文章だけ書かせる。
 *          自動送信はしない。PDFと下書きを作るところまで。
 *          税務上の判断（源泉徴収の要否、登録番号の記載など）はご自身の事業に合わせて確認してください。
 */

const CONFIG = {
  API_KEY: 'ここにOpenAI APIキー(sk-...)',   // ← 必ず変更
  MODEL: 'gpt-4o-mini',
  SHEET_NAME: 'invoices',
  DONE_MARK: '作成済',
  STATUS_COL: 6,                 // F列 = 状態
  WITHHOLDING_COL: 7,            // G列 = 源泉徴収（「する」と入れた行だけ差し引く）
  ROUNDING: 'floor',             // 消費税の端数：'floor'=切り捨て / 'round'=四捨五入 / 'ceil'=切り上げ
  ISSUER: '〇〇商店 / 山田太郎',  // 請求元（自社名・屋号）
  REG_NO: 'T0000000000000',      // 適格請求書発行事業者の登録番号（無ければ '' のまま空欄に）
  ISSUER_DETAIL: '〒000-0000 東京都〇〇区…\n振込先: 〇〇銀行 △△支店 普通 1234567',
  PDF_FOLDER: '請求書PDF',        // 保存先ドライブフォルダ（自動作成）
  NUMBER_PREFIX: 'INV',          // 請求書番号の頭：INV-2026-0001
  DUE_MODE: 'month_end_next',    // 'days' = 発行日からDUE_DAYS日後 / 'month_end_next' = 翌月末
  DUE_DAYS: 30,
  DRY_RUN: true                  // 最初は true。ログで計算を確認してから false に
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('請求書')
    .addItem('未処理の行を一括作成', 'buildInvoices')
    .addItem('請求書番号の連番を確認', 'showNextNumber')
    .addToUi();
}

function buildInvoices() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('シートが見つかりません: ' + CONFIG.SHEET_NAME);
  const folder = CONFIG.DRY_RUN ? null : _getOrCreateFolder(CONFIG.PDF_FOLDER);
  const values = sheet.getDataRange().getValues();
  const today = new Date();

  let done = 0;
  for (let r = 1; r < values.length; r++) {          // 1行目は見出し
    const row = values[r];
    const [company, name, email, subject, itemsRaw, status] = row;
    const withholding = String(row[CONFIG.WITHHOLDING_COL - 1] || '').trim() === 'する';
    if (!company || String(status).indexOf(CONFIG.DONE_MARK) === 0) continue;   // 空行・処理済みは飛ばす
    try {
      const items = parseItems(itemsRaw);
      if (items.length === 0) throw new Error('明細が空です');
      const totals = calcTotals(items, withholding, CONFIG.ROUNDING);
      const due = dueDate(today, CONFIG.DUE_MODE, CONFIG.DUE_DAYS);

      if (CONFIG.DRY_RUN) {
        Logger.log('[お試し] ' + (r + 1) + '行目 ' + company + '：' + _summary(totals) +
                   '　支払期限 ' + _fmt(due));
        continue;
      }
      const no = _nextNumber(today);
      const pdf = _makePdf(folder, no, today, due, { company, name, subject, items, totals });
      const mailBody = _draftCoverEmail(name || company, subject, totals, due);
      GmailApp.createDraft(email || '', '請求書送付のご案内（' + subject + '）', mailBody,
        { attachments: [pdf.getBlob()] });

      sheet.getRange(r + 1, CONFIG.STATUS_COL).setValue(CONFIG.DONE_MARK + ' ' + no);
      done++;
      Utilities.sleep(400);
    } catch (e) {
      sheet.getRange(r + 1, CONFIG.STATUS_COL).setValue('ERROR: ' + e.message);
    }
  }
  ss.toast(CONFIG.DRY_RUN ? 'お試しモード：実行ログを確認してください'
                          : '請求書 ' + done + ' 件を作成しました', '請求書', 5);
}

// ---- 計算（AIは使わない） -------------------------------------------------

// "品目;数量;単価;税率" を改行区切りで配列に。税率の省略は10
function parseItems(raw) {
  return String(raw || '').split('\n').map(s => s.trim()).filter(Boolean).map(line => {
    const [name, qty, price, rate] = line.split(';').map(x => (x || '').trim());
    const r = rate === '' || rate === undefined ? 10 : Number(rate);
    if ([10, 8, 0].indexOf(r) < 0) throw new Error('税率は10・8・0のどれか: ' + line);
    return { name, qty: Number(qty) || 0, price: Number(price) || 0, rate: r };
  }).filter(it => it.name && it.qty > 0);
}

// 税率ごとに合計→税額（端数処理は税率ごとに1回）。源泉徴収は税抜の課税明細に対して
function calcTotals(items, withholding, rounding) {
  const round = rounding === 'ceil' ? Math.ceil : rounding === 'round' ? Math.round : Math.floor;
  const byRate = {};
  items.forEach(it => {
    const amt = it.qty * it.price;
    byRate[it.rate] = (byRate[it.rate] || 0) + amt;
  });
  const groups = [10, 8, 0].filter(r => byRate[r] !== undefined).map(r => ({
    rate: r, base: byRate[r], tax: r === 0 ? 0 : round(byRate[r] * r / 100)
  }));
  const subtotal = groups.reduce((s, g) => s + g.base, 0);
  const tax = groups.reduce((s, g) => s + g.tax, 0);
  const taxableBase = groups.filter(g => g.rate > 0).reduce((s, g) => s + g.base, 0);
  const wh = withholding ? withholdingTax(taxableBase) : 0;
  return { groups, subtotal, tax, total: subtotal + tax, withholding: wh,
           billed: subtotal + tax - wh };
}

// 源泉徴収税額（復興特別所得税込み）：100万円以下 10.21%、超える部分 20.42%。1円未満切り捨て
function withholdingTax(base) {
  if (base <= 0) return 0;
  if (base <= 1000000) return Math.floor(base * 1021 / 10000);
  return 102100 + Math.floor((base - 1000000) * 2042 / 10000);
}

function dueDate(issued, mode, days) {
  if (mode === 'month_end_next') return new Date(issued.getFullYear(), issued.getMonth() + 2, 0);
  return new Date(issued.getTime() + days * 864e5);
}

// ---- PDF・メール --------------------------------------------------------

function _makePdf(folder, no, issued, due, inv) {
  const doc = DocumentApp.create('invoice-' + no);
  const b = doc.getBody();
  const t = inv.totals;

  b.appendParagraph('請求書').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  b.appendParagraph(inv.company + ' 御中');
  b.appendParagraph('件名: ' + inv.subject);
  b.appendParagraph('請求書番号: ' + no + '　発行日: ' + _fmt(issued) + '　お支払期限: ' + _fmt(due));
  b.appendParagraph('ご請求金額: ' + _yen(t.billed) + (t.withholding ? '（源泉徴収税額差引後）' : '（税込）'))
    .setHeading(DocumentApp.ParagraphHeading.HEADING2);
  b.appendParagraph('');

  const rows = [['品目', '数量', '単価', '税率', '金額（税抜）']];
  inv.items.forEach(it => rows.push([
    it.name + (it.rate === 8 ? ' ※' : ''), String(it.qty), _yen(it.price),
    it.rate === 0 ? '対象外' : it.rate + '%', _yen(it.qty * it.price)]));
  b.appendTable(rows);
  if (inv.items.some(it => it.rate === 8)) b.appendParagraph('※は軽減税率（8%）対象');

  const sum = [];
  t.groups.forEach(g => sum.push(g.rate === 0
    ? ['対象外（立替金など）', _yen(g.base)]
    : [g.rate + '%対象 ' + _yen(g.base), '消費税 ' + _yen(g.tax)]));
  sum.push(['小計（税抜）', _yen(t.subtotal)]);
  sum.push(['消費税', _yen(t.tax)]);
  sum.push(['合計（税込）', _yen(t.total)]);
  if (t.withholding) {
    sum.push(['源泉徴収税額', '-' + _yen(t.withholding)]);
    sum.push(['差引ご請求金額', _yen(t.billed)]);
  }
  b.appendParagraph('');
  b.appendTable(sum);

  b.appendParagraph('');
  b.appendParagraph(CONFIG.ISSUER);
  if (CONFIG.REG_NO) b.appendParagraph('登録番号: ' + CONFIG.REG_NO);
  b.appendParagraph(CONFIG.ISSUER_DETAIL);
  doc.saveAndClose();

  const id = doc.getId();
  const pdf = folder.createFile(DriveApp.getFileById(id).getAs('application/pdf'))
                    .setName('invoice-' + no + '.pdf');
  DriveApp.getFileById(id).setTrashed(true);   // 一時ドキュメントは捨てる
  return pdf;
}

function _draftCoverEmail(name, subject, t, due) {
  const amount = _yen(t.billed) + (t.withholding ? '（源泉徴収税額差引後）' : '（税込）');
  const prompt =
    'あなたは丁寧なビジネス日本語を書く担当者です。以下の条件で、請求書を送付する短い添え状メールの本文だけを書いてください。' +
    '署名や件名は不要。過度な謝罪や誇張はせず、簡潔に。金額と期限は下の表記をそのまま使い、計算や言い換えはしないこと。\n' +
    '宛名: ' + name + ' 様\n用件: 「' + subject + '」の請求書を添付で送付\n請求金額: ' + amount +
    '\nお支払期限: ' + _fmt(due);
  try {
    const text = _askAI(prompt);
    // 金額がAIの文面に正しく入っていなければ定型文に切り替える
    if (text.indexOf(Number(t.billed).toLocaleString('ja-JP')) < 0) throw new Error('金額不一致');
    return text + '\n\n' + CONFIG.ISSUER;
  } catch (e) {
    return name + ' 様\n\nいつもお世話になっております。\n「' + subject +
      '」の請求書を添付いたします。\nご請求金額は ' + amount + '、お支払期限は ' + _fmt(due) +
      ' です。ご確認のほどよろしくお願いいたします。\n\n' + CONFIG.ISSUER;
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

// ---- 連番 --------------------------------------------------------------

// 年ごとの通し番号。スクリプトのプロパティに保存するので、行を並べ替えても番号は重複しない
function _nextNumber(issued) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const props = PropertiesService.getScriptProperties();
    const year = issued.getFullYear();
    const key = 'INVOICE_SEQ_' + year;
    const n = Number(props.getProperty(key) || 0) + 1;
    props.setProperty(key, String(n));
    return CONFIG.NUMBER_PREFIX + '-' + year + '-' + ('000' + n).slice(-4);
  } finally {
    lock.releaseLock();
  }
}

function showNextNumber() {
  const year = new Date().getFullYear();
  const n = Number(PropertiesService.getScriptProperties().getProperty('INVOICE_SEQ_' + year) || 0);
  SpreadsheetApp.getUi().alert('次の請求書番号: ' + CONFIG.NUMBER_PREFIX + '-' + year + '-' +
                               ('000' + (n + 1)).slice(-4));
}

// ---- 小物 --------------------------------------------------------------

function _summary(t) {
  return t.groups.map(g => (g.rate === 0 ? '対象外 ' : g.rate + '% ') + _yen(g.base) +
    (g.rate ? '（税 ' + _yen(g.tax) + '）' : '')).join(' / ') +
    '　合計 ' + _yen(t.total) + (t.withholding ? '　源泉 -' + _yen(t.withholding) : '') +
    '　請求額 ' + _yen(t.billed);
}
function _fmt(d) { return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日'; }
function _yen(n) { return '¥' + Number(n).toLocaleString('ja-JP'); }
function _getOrCreateFolder(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
```

## invoices シートの見本（02_sample_invoices.csv）

```csv
﻿請求先会社,宛名,メール,件名,明細（品目;数量;単価;税率）,状態,源泉徴収
〇〇商事,田中,tanaka@example.com,9月分 保守費用,"月額保守;1;30000
スポット対応;2;5000",,
△△デザイン,佐藤,sato@example.com,ロゴ制作,"ロゴ制作;1;100000
打合せ時の飲食物;1;3001;8
交通費（立替）;1;1200;0",,する
□□株式会社,鈴木,suzuki@example.com,10月分 記事制作,記事制作;4;15000,,する
```
