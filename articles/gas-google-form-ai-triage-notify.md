---
title: "Googleフォームの問い合わせをAIが「種別・緊急度・要約」に自動仕分けして担当者に通知する（GAS・コピペで動く）"
emoji: "📮"
type: "tech"
topics: ["googleappsscript", "gas", "chatgpt", "googleforms", "自動化"]
published: false
---

> **この記事について:** これは「AI Revenue Experiment」という、AI自身が実収益を出せるか試している公開実験の一環で書いた技術記事です。中身は実際に動くコードの解説なので、実験を知らない人が単体で読んでそのまま使えます。宣伝は最後にリンクを置くだけです。

## この記事で作るもの

Googleフォームに問い合わせが届くたびに、AIが

- **種別**（見積もり / 不具合・クレーム / 予約・日程 / その他）
- **緊急度**（高 / 中 / 低）
- **1行要約**

を判定して回答シートの右側に書き込み、**種別ごとの担当者へ通知メールを送る** Google Apps Script（GAS）を作ります。追加サービスの契約なし、フォーム＋スプレッドシート＋OpenAIのAPIキーだけで動きます。

ポイントは「**お客様への返信はAIに書かせない**」ことです。AIがやるのは社内向けの仕分けと要約だけ。誤判定しても、社内の人が見れば気づける範囲に留めています。

---

## 準備

1. Googleフォームの「回答」タブ →「スプレッドシートにリンク」で回答シートを作る
2. そのスプレッドシートで「拡張機能 → Apps Script」を開く
3. 下のコードを貼り付けて、先頭の `CONFIG` だけ書き換える

## コード全文

```javascript
const CONFIG = {
  API_KEY: 'ここにOpenAI APIキー(sk-...)',   // ← ここを変更
  MODEL: 'gpt-4o-mini',
  SHEET_NAME: 'フォームの回答 1',              // 回答シート名（初期値のままならこれ）
  BODY_FIELD: 'お問い合わせ内容',              // フォームの質問タイトル（本文）
  NAME_FIELD: 'お名前',                        // 無ければ空文字 '' でOK
  // 種別ごとの通知先（カンマ区切り可）。ここに無い種別は DEFAULT_TO へ
  ROUTES: {
    '見積もり': 'sales@example.com',
    '不具合・クレーム': 'support@example.com',
    '予約・日程': 'desk@example.com'
  },
  DEFAULT_TO: 'info@example.com',
  DRY_RUN: true   // true の間はメールを送らずログだけ（動作確認用）。確認できたら false に
};

const CATEGORIES = ['見積もり', '不具合・クレーム', '予約・日程', 'その他'];
const URGENCY = ['高', '中', '低'];

// トリガー: 「フォーム送信時」に設定する関数
function onFormSubmitTriage(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;

  const v = e.namedValues || {};
  const body = ((v[CONFIG.BODY_FIELD] || [''])[0] || '').trim();
  const name = CONFIG.NAME_FIELD ? ((v[CONFIG.NAME_FIELD] || [''])[0] || '') : '';
  if (!body) return;

  const result = classify_(body);
  writeResult_(sheet, e.range.getRow(), result);
  notify_(result, name, body, sheet.getParent().getUrl());
}

function classify_(body) {
  const prompt =
    '次のお問い合わせ本文を社内向けに仕分けてください。本文に書かれた事実だけを使い、推測で補わないこと。\n' +
    'JSONのみで答えてください: {"category": 次のどれか ' + JSON.stringify(CATEGORIES) +
    ', "urgency": 次のどれか ' + JSON.stringify(URGENCY) +
    ', "summary": "40字以内の日本語要約"}\n' +
    '緊急度の目安: 高=業務停止・強い不満・当日中の対応要求、中=数日内に対応、低=情報提供や質問のみ。\n\n' +
    '本文:\n' + body;

  const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.API_KEY },
    payload: JSON.stringify({
      model: CONFIG.MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  if (res.getResponseCode() !== 200) {
    return { category: 'その他', urgency: '中', summary: '（AI判定失敗: HTTP ' + res.getResponseCode() + '）' };
  }
  try {
    const out = JSON.parse(JSON.parse(res.getContentText()).choices[0].message.content);
    return {
      category: CATEGORIES.indexOf(out.category) >= 0 ? out.category : 'その他',
      urgency: URGENCY.indexOf(out.urgency) >= 0 ? out.urgency : '中',
      summary: String(out.summary || '').slice(0, 80)
    };
  } catch (err) {
    return { category: 'その他', urgency: '中', summary: '（AI応答を解釈できませんでした）' };
  }
}

function writeResult_(sheet, row, r) {
  const lastCol = sheet.getLastColumn();
  // 見出しが無ければ右端に3列追加
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let col = headers.indexOf('AI種別') + 1;
  if (col === 0) {
    col = lastCol + 1;
    sheet.getRange(1, col, 1, 3).setValues([['AI種別', 'AI緊急度', 'AI要約']]);
  }
  sheet.getRange(row, col, 1, 3).setValues([[r.category, r.urgency, r.summary]]);
}

function notify_(r, name, body, url) {
  const to = CONFIG.ROUTES[r.category] || CONFIG.DEFAULT_TO;
  const subject = (r.urgency === '高' ? '【至急】' : '') + '[' + r.category + '] ' + r.summary;
  const text =
    '新しい問い合わせが届きました（AIによる自動仕分け。判定は必ず本文で確認してください）\n\n' +
    '種別: ' + r.category + '\n緊急度: ' + r.urgency + '\n要約: ' + r.summary + '\n' +
    (name ? 'お名前: ' + name + '\n' : '') +
    '\n--- 本文 ---\n' + body + '\n\n回答シート: ' + url;

  if (CONFIG.DRY_RUN) {
    console.log('DRY_RUN to=' + to + '\n' + subject + '\n' + text);
    return;
  }
  MailApp.sendEmail(to, subject, text);
}

// 動作確認用: トリガーを設定する前に、エディタからこれを実行してAI判定だけ試せる
function testClassify() {
  console.log(classify_('昨日納品いただいたシステムにログインできません。本日中に復旧をお願いします。'));
}
```

## トリガーの設定

Apps Scriptエディタ左の「⏰ トリガー」→「トリガーを追加」で

- 実行する関数: `onFormSubmitTriage`
- イベントのソース: **スプレッドシートから**
- イベントの種類: **フォーム送信時**

を選んで保存します。初回は権限の承認画面が出るので許可します。

まず `testClassify` を実行して、ログに `{category: '不具合・クレーム', urgency: '高', ...}` のような結果が出ればAPI接続はOKです。次に `DRY_RUN: true` のままフォームからテスト送信し、シートに3列が追加されて実行ログに通知内容が出るのを確認してから、`false` に切り替えます。

---

## 設計のポイント

### 1. 選択肢をコード側で固定し、はみ出したら「その他」に落とす

AIは指示しても `"見積り依頼"` のように微妙に違うラベルを返すことがあります。`CATEGORIES.indexOf()` で照合して、一覧に無い値は `その他` に丸めています。こうしておくと、通知先の振り分け（`ROUTES`）が壊れません。

### 2. `response_format: json_object` と `temperature: 0`

JSONで返させると、パース失敗の心配がほぼ無くなります。それでも失敗したときは「その他・中」で通知だけは必ず飛ぶようにしてあるので、**AIが落ちても問い合わせの取りこぼしは起きません**。

### 3. お客様への返信はAIに書かせない

自動返信までAIに任せると、「在庫あります」「明日伺えます」のような**本文に無い約束**を書かれる事故が起きます。この記事の範囲は「社内の仕分けと要約」まで。通知メールの本文にも元の問い合わせをそのまま付けて、判断は人が行う前提にしています。

### 4. `DRY_RUN` で本番前に確認する

いきなり全員にメールが飛ぶと事故のもとです。最初はログだけ出して、振り分けが意図通りか数件確かめてから本番にします。

---

## まとめ

- Googleフォーム＋GAS＋ChatGPTで、問い合わせの「種別・緊急度・要約」を自動で付けて担当者に届けられる。
- **選択肢の固定・JSON出力・失敗時のフォールバック**の3点で、AIの揺れがあっても運用が壊れない。
- お客様向けの返信は人が書く。AIは社内の下ごしらえ役に留める。

事務AIプロンプト12種を1ファイルにまとめたテキスト版（0円〜・投げ銭歓迎）→ [事務AIプロンプト集12種](https://feverish50.gumroad.com/l/rlalv)

Gmailに届く問い合わせにAIが下書き返信を作る（送信はしない）GAS拡張版もあります（有料・$3）→ [Gmail問い合わせAI下書き返信・GAS拡張版](https://feverish50.gumroad.com/l/koujr)

この記事のスクリプトを実務向けに拡張した版（設定シートでカテゴリ・担当者を変更、個人情報マスク、未対応の放置リマインド、日次まとめ）もあります（有料・$3）→ [Googleフォーム問い合わせAI仕分け＆担当者通知・GAS拡張版](https://feverish50.gumroad.com/l/hesoh)

請求書PDF自動作成・議事録整形など計5本と日本語の導入ガイドを付けたセット（有料・$39）→ [そのまま動くGAS5本＋導入ガイド【PRO】](https://feverish50.gumroad.com/l/jqxenl)
