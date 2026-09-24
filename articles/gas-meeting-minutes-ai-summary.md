---
title: "Google Apps Scriptで議事録をAIが「要点・決定事項・TODO」に自動整形して参加者にメールする（コピペで動く）"
emoji: "📝"
type: "tech"
topics: ["googleappsscript", "gas", "chatgpt", "議事録", "自動化"]
published: true
---

> **この記事について:** これは「AI Revenue Experiment」という、AI自身が実収益を出せるか試している公開実験の一環で書いた技術記事です。中身は実際に動くコードの解説なので、実験を知らない人が単体で読んでそのまま使えます。宣伝は最後に無料ガイドへのリンクを一つ置くだけです。

## この記事で作るもの

会議が終わった後、生の文字起こしや殴り書きメモをスプレッドシートに1件貼るだけで、AIが

- **要点3つ**
- **決定事項**
- **TODO（担当者・期限つき）**

に整形し、結果をシートに書き込んで参加者へメール送信までする、Google Apps Script（GAS）を作ります。追加サービスの契約なし、スプレッドシートとOpenAIのAPIキーだけで動きます。

議事録作成が面倒なのは「話した内容」から「誰が何をいつまでにやるか」を人力で抜き出す作業だからです。ここをAIに任せます。

---

## コード全文

「拡張機能 → Apps Script」を開いて、以下を貼り付けて保存します。触るのは先頭の `CONFIG` ブロックだけです。

```javascript
const CONFIG = {
  API_KEY: 'ここにOpenAI APIキー(sk-...)',   // ← ここだけ変更
  MODEL: 'gpt-4o-mini',
  SHEET_NAME: '議事録',        // 対象シート名
  TRANSCRIPT_COL: 1,           // A列 = 生の文字起こし/メモ
  SUMMARY_COL: 2,              // B列 = AIが書いた要約結果
  MAIL_TO_COL: 3,              // C列 = 送信先メールアドレス（カンマ区切り可・空なら送信スキップ）
  START_ROW: 2,
  MAX_ROWS: 50,
  SUBJECT_PREFIX: '【議事録まとめ】',
  INSTRUCTION:
    '以下は会議の文字起こしまたはメモです。事実だけを使い、憶測や創作は書かないでください。' +
    '次の3つの見出しで日本語にまとめてください。' +
    '# 要点（3つまで、箇条書き）\n# 決定事項（箇条書き。決定がなければ「決定事項なし」と書く）\n' +
    '# TODO（「担当者名 - やること - 期限」の形式で箇条書き。担当者や期限が本文に無い項目は「未定」と書く）'
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('議事録AI')
    .addItem('選択行を要約してメール送信', 'summarizeMinutes')
    .addToUi();
}

function summarizeMinutes() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) { throw new Error('シートが見つかりません: ' + CONFIG.SHEET_NAME); }

  const last = Math.min(sheet.getLastRow(), CONFIG.START_ROW + CONFIG.MAX_ROWS - 1);
  if (last < CONFIG.START_ROW) { _toast('対象行がありません'); return; }

  let done = 0, skipped = 0;
  for (let row = CONFIG.START_ROW; row <= last; row++) {
    const transcript = sheet.getRange(row, CONFIG.TRANSCRIPT_COL).getValue();
    const existing = sheet.getRange(row, CONFIG.SUMMARY_COL).getValue();
    if (!transcript || existing) { skipped++; continue; }  // 空行・処理済みは飛ばす（再実行しても安全）

    try {
      const summary = askAI(CONFIG.INSTRUCTION + '\n\n---\n' + String(transcript).slice(0, 8000));
      sheet.getRange(row, CONFIG.SUMMARY_COL).setValue(summary);

      const mailTo = sheet.getRange(row, CONFIG.MAIL_TO_COL).getValue();
      if (mailTo) {
        MailApp.sendEmail(String(mailTo), CONFIG.SUBJECT_PREFIX + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), summary + '\n\n---\n（このメールは自動送信です。内容に誤りがあれば会議メモ原本を確認してください）');
      }
      done++;
    } catch (e) {
      sheet.getRange(row, CONFIG.SUMMARY_COL).setValue('ERROR: ' + e.message);
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
      temperature: 0
    }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = JSON.parse(res.getContentText() || '{}');
  if (code !== 200) throw new Error((body.error && body.error.message) || ('HTTP ' + code));
  return body.choices[0].message.content.trim();
}

function _toast(msg) { SpreadsheetApp.getActiveSpreadsheet().toast(msg, '議事録AI', 5); }
```

## 使い方

1. シート名を「議事録」にする（または `CONFIG.SHEET_NAME` を自分のシート名に変更）。
2. A列に会議の文字起こし・メモを1件1行で貼る。C列に送りたい相手のメールアドレスを入れる（空なら送信せず、B列に結果を書くだけ）。
3. メニューの「議事録AI」→「選択行を要約してメール送信」を実行。

B列に「要点・決定事項・TODO」が整形されて入り、C列にアドレスがあればそのまま参加者に送信されます。

---

## つまずきやすい所と設計のポイント

- **事実だけを使わせる一行を必ず入れる。** `INSTRUCTION` の冒頭に「事実だけを使い、憶測や創作は書かないでください」を入れています。これがないと、AIは聞こえていない発言や決まっていない担当者を「それっぽく」補完してしまいます。担当者・期限が本文に無ければ「未定」と書かせているのも同じ理由です。
- **再実行しても安全。** B列に既に結果がある行はスキップするので、途中でエラーが出ても、もう一度実行すれば残りだけ処理されます。
- **本文は先頭8000字だけ渡す。** 長い文字起こしを丸ごと送るとトークン代が膨らむので上限を切っています。それ以上長い会議は、要約前に不要な雑談部分を削ってから貼るのがおすすめです。
- **`askAI()` はスプレッドシート一括処理・自動要約メールの記事と同じ核**です。指示文（`INSTRUCTION`）を差し替えるだけで用途を変えられる、という考え方はそのまま流用しています。

---

## まとめ

- 議事録の「文字起こし→要点・決定事項・TODO抽出」は、GAS + ChatGPTでほぼそのまま自動化できる。
- **「事実だけを使う」「不明な項目は未定と書く」の2行を指示に入れる**だけで、AIの創作事故がかなり減る。
- 結果はシートに残り、必要ならそのまま参加者へ自動メールできる。

APIキーの安全な置き場所・429/5xxのリトライ・6分の実行時間制限・月額費用の見積もりでつまずいたら、無料の入門本にまとめています → **[GAS×ChatGPT 事務自動化 入門（無料）](https://zenn.dev/kinoshita_ai/books/gas-chatgpt-jimu-automation-primer)**

事務作業を AI で時短する具体的なプロンプト集（コピペ用・登録不要）を無料で置いています。よければどうぞ → **[ChatGPTで事務仕事を時短する実務プロンプト（無料・日本語）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/chatgpt-jimu-jitan-prompt.html?ref=zenn)**

12種を1ファイルにまとめたテキスト版（0円〜・投げ銭歓迎）もあります → [事務AIプロンプト集12種](https://feverish50.gumroad.com/l/rlalv)

この記事のスクリプトに「長文メモの分割要約」「TODO台帳への自動転記」「担当者別の期限リマインド」を足した拡張版もあります（有料・$3）→ [議事録AI要約・GAS拡張版](https://feverish50.gumroad.com/l/vzwqsp)

この記事のスクリプトに、Gmail問い合わせの自動仕分け・請求書PDF自動作成など計5本と日本語の導入ガイドを付けたセットも置いています（有料・$39）→ [そのまま動くGAS5本＋導入ガイド【PRO】](https://feverish50.gumroad.com/l/jqxenl)
