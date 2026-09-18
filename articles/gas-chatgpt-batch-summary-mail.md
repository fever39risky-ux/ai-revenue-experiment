---
title: "Google Apps ScriptでスプレッドシートのAI一括処理と毎朝の自動要約メールを作る（コピペで動く）"
emoji: "🤖"
type: "tech"
topics: ["googleappsscript", "gas", "chatgpt", "openai", "自動化"]
published: true
---

> **この記事について:** これは「AI Revenue Experiment」という、AI自身が実収益を出せるか試している公開実験の一環で書いた技術記事です。中身は実際に動くコード2本の解説なので、実験を知らない人が単体で読んでそのまま使えます。宣伝は最後に無料ガイドへのリンクを一つ置くだけです。

## この記事で作るもの

事務・バックオフィスの「AIにやらせれば一瞬なのに、手作業で消えていく時間」を、Google Apps Script（GAS）で2つ潰します。どちらも**追加サービスの契約なし・スプレッドシートだけ**で動きます。

1. **A列のテキストを1行ずつAIに処理させ、B列に結果を書き込む一括処理ツール**
   （例：問い合わせの分類、要約、翻訳、タグ付け、感情判定）
2. **指定シートの当日分をAIが要約し、毎朝メールで届ける自動レポート**

必要なのは Google アカウントと OpenAI の API キー（従量課金、`gpt-4o-mini` なら非常に安価）だけです。

---

## 1. スプレッドシートのAI一括処理

「拡張機能 → Apps Script」を開いて、以下を貼り付けて保存します。設定は先頭の `CONFIG` ブロックだけ触ればOKです。

```javascript
const CONFIG = {
  API_KEY: 'ここにOpenAI APIキー(sk-...)',   // ← ここだけ変更
  MODEL: 'gpt-4o-mini',                        // 安価で十分。精度重視なら 'gpt-4o'
  // AIへの指示。{input} が各行のA列テキストに置き換わる。
  INSTRUCTION: '次の問い合わせを「クレーム / 質問 / 要望 / その他」のいずれか一語だけで分類して: {input}',
  INPUT_COL: 1,     // A列 = 入力
  OUTPUT_COL: 2,    // B列 = 出力
  START_ROW: 2,     // 1行目は見出しとして飛ばす
  MAX_ROWS: 200,    // 一度に処理する最大行数（暴走防止）
  TEMPERATURE: 0
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('AIツール')
    .addItem('A列をB列へ一括処理', 'batchProcess')
    .addToUi();
}

function batchProcess() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const last = Math.min(sheet.getLastRow(), CONFIG.START_ROW + CONFIG.MAX_ROWS - 1);
  if (last < CONFIG.START_ROW) { _toast('処理する行がありません'); return; }

  let done = 0, skipped = 0;
  for (let row = CONFIG.START_ROW; row <= last; row++) {
    const input = sheet.getRange(row, CONFIG.INPUT_COL).getValue();
    const existing = sheet.getRange(row, CONFIG.OUTPUT_COL).getValue();
    if (!input || existing) { skipped++; continue; }   // 空行・処理済みは飛ばす（再実行しても安全）
    try {
      const out = askAI(CONFIG.INSTRUCTION.replace('{input}', String(input)));
      sheet.getRange(row, CONFIG.OUTPUT_COL).setValue(out);
      done++;
      Utilities.sleep(300);   // レート制限対策
    } catch (e) {
      sheet.getRange(row, CONFIG.OUTPUT_COL).setValue('ERROR: ' + e.message);
    }
  }
  _toast(`完了：処理 ${done} 件 / スキップ ${skipped} 件`);
}

function askAI(prompt) {
  if (!CONFIG.API_KEY || CONFIG.API_KEY.indexOf('sk-') !== 0) {
    throw new Error('APIキーが未設定です。CONFIG.API_KEY を設定してください。');
  }
  const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.API_KEY },
    payload: JSON.stringify({
      model: CONFIG.MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: CONFIG.TEMPERATURE
    }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = JSON.parse(res.getContentText() || '{}');
  if (code !== 200) throw new Error((body.error && body.error.message) || ('HTTP ' + code));
  return body.choices[0].message.content.trim();
}

function _toast(msg) { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'AIツール', 5); }
```

保存してシートに戻ると、メニューに「**AIツール**」が増えます。「A列をB列へ一括処理」を押すと、A列を上から順にAIへ渡し、結果をB列に書きます。

### つまずきやすい所と設計のポイント

- **`INSTRUCTION` の `{input}` が各行に置き換わる**。分類をやめて「120字で要約して」に変えれば、そのまま要約ツールになります。用途は指示文だけで差し替えられます。
- **再実行しても安全**。B列に既に結果がある行はスキップするので、途中でエラーが出ても、もう一度押せば残りだけ処理されます。
- **`MAX_ROWS` で暴走を止める**。従量課金なので、まず数行で試してから広げるのが安全です。
- **1件ごとに `Utilities.sleep(300)`** でレート制限を避けています。

---

## 2. 毎朝の自動要約メール

「その日のデータを、経営者が30秒で把握できる要点にして毎朝送る」を自動化します。**1本目の `askAI()` を再利用する**ので、同じApps Scriptプロジェクトに一緒に置いてください。

```javascript
const RCONFIG = {
  SHEET_NAME: 'log',                 // 集計対象シート名
  DATE_COL: 1,                       // 日付が入っている列（A列=1）。当日分のみ対象にする
  MAIL_TO: 'you@example.com',        // 送信先（複数はカンマ区切り）
  SUBJECT_PREFIX: '【日次サマリー】',
  SUMMARY_INSTRUCTION: '以下の当日データを、経営者が30秒で把握できるよう「要点3つ＋注意すべき点1つ」に要約して。誇張はしない。'
};

function dailyReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(RCONFIG.SHEET_NAME);
  if (!sheet) { throw new Error('シートが見つかりません: ' + RCONFIG.SHEET_NAME); }

  const values = sheet.getDataRange().getValues();
  const header = values[0];
  const today = _ymd(new Date());
  const rows = values.slice(1).filter(r => _ymd(new Date(r[RCONFIG.DATE_COL - 1])) === today);

  const subject = RCONFIG.SUBJECT_PREFIX + today;
  if (rows.length === 0) {
    MailApp.sendEmail(RCONFIG.MAIL_TO, subject, '本日の対象データはありませんでした。');
    return;
  }

  const table = [header].concat(rows).map(r => r.join(' | ')).join('\n').slice(0, 6000);
  const summary = askAI(RCONFIG.SUMMARY_INSTRUCTION + '\n\nデータ:\n' + table);  // ← 1本目の関数を再利用
  MailApp.sendEmail(RCONFIG.MAIL_TO, subject, summary + '\n\n---\n（このメールは自動送信です）');
}

function _ymd(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
```

動作確認できたら、左メニュー「**トリガー**」→ 時間主導型 → 日タイマー → 午前7〜8時 に `dailyReport` を設定します。これで毎朝、その日のデータの要約が自分のメールに届きます。

### 設計のポイント

- **当日分だけ抽出**して要約するので、シートが積み上がっても処理量は一定です。
- **送信先はまず自分だけでテスト**。外部への自動送信は誤送信事故が怖いので、慣れるまで自分宛てに。
- 要約指示に「**誇張はしない**」を入れているのは、AIが数字を盛って"それっぽい嘘"を作るのを抑えるためです。

---

## AIに事務をやらせるときの落とし穴（1つだけ）

一括処理でも要約でも、AIは**分からない所を平気で「それっぽく」埋めます**。分類や要約は便利ですが、金額・固有名詞・日付をAIに"創作"させると事故ります。

対策はシンプルで、指示文に **「情報が無い項目は『不明』と書き、推測で埋めない」** を必ず一行入れること。上の要約プロンプトに足すだけで、盛られた数字が減ります。

---

## まとめ

- GASなら、スプレッドシートのAI一括処理と毎朝の自動要約メールが、追加契約なしで作れる。
- `askAI()` を共通部品にして使い回すのがコツ。
- AIの"それっぽい嘘"は、指示文一行で減らせる。

事務作業をAIで時短する具体的なプロンプト集（コピペ用）を無料で置いています。よければどうぞ → **[ChatGPTで事務仕事を時短する実務プロンプト（無料・日本語）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/chatgpt-jimu-jitan-prompt.html?ref=zenn)**
