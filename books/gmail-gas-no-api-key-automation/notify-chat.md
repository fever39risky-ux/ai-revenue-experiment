---
title: "新着メールをSlack・Google Chatに通知する（二重通知なし）"
---

問い合わせや取引先からのメールに気づくのが遅れる——チームがチャット中心で動いていると、よく起きることです。この章では Google Apps Script（GAS）で、**条件に合うGmailの新着メールを、SlackやGoogle Chatのチャンネルに1件ずつ通知する**仕組みを作ります。

## 1. できること

| 項目 | この章のコード |
| --- | --- |
| 通知先 | Slack の Incoming Webhook、または Google Chat スペースの Webhook（どちらも同じコードで動きます） |
| 通知の内容 | 送信元・件名・本文の先頭200文字・Gmailで開くリンク |
| 対象 | Gmailの検索式 `QUERY` に合うメール（初期値は受信トレイの直近2日、プロモーション/SNS/新着タブは除外）。noreply・メルマガは通知しません |
| 二重通知の防止 | 通知したスレッドに「通知済み」ラベルを付け、次回からは対象外。送信に失敗したものはラベルを付けず、次回もう一度送ります |

メール本文の一部がチャットに流れます。社外秘のメールが届くアドレスでは、`QUERY` で対象を絞るか、本文を送らない設定（後述）にしてください。

## 2. 準備

- **Webhook URLを用意します。** Slack：Slack API の「Incoming Webhooks」でアプリを作り、通知したいチャンネルのWebhook URLを発行します。Google Chat：通知したいスペースの「アプリと統合」→「Webhook を追加」でURLを発行します（Google Workspace のアカウントが必要です）。

- [script.google.com](https://script.google.com/) で「新しいプロジェクト」を作り、下のコードを貼り付けます。

- 左の歯車「プロジェクトの設定」→「スクリプト プロパティ」で、プロパティ `WEBHOOK_URL`、値にWebhook URLを保存します。**URLはコードに直接書かないでください**（URLを知っている人は誰でもそのチャンネルに投稿できます）。

- ▶ で `notifyNewMail` を一度実行し、Gmailと外部への接続を許可します。直近2日の該当メールが通知されます。

- 左の時計アイコン「トリガー」→ 関数 `notifyNewMail`・「時間主導型」・「分ベースのタイマー」・「5分おき」または「10分おき」で保存します。

## 3. コード全文（コピペで動きます）


```javascript
const QUERY = 'in:inbox -category:promotions -category:social -category:updates newer_than:2d';
const DONE_LABEL = '通知済み';          // 通知したスレッドに付けるラベル（二重通知の防止）
const SKIP_FROM = /no-?reply|mailer-daemon|newsletter|magazine/i;
const MAX_PER_RUN = 20;               // 1回の実行で通知する上限

function notifyNewMail() {
  const url = PropertiesService.getScriptProperties().getProperty('WEBHOOK_URL');
  if (!url) throw new Error('スクリプトプロパティ WEBHOOK_URL を設定してください');
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;     // 前回の実行が終わっていなければ何もしない
  try {
    const done = GmailApp.getUserLabelByName(DONE_LABEL) || GmailApp.createLabel(DONE_LABEL);
    const threads = GmailApp.search(QUERY + ' -label:' + DONE_LABEL, 0, MAX_PER_RUN).reverse(); // 古い順
    for (const th of threads) {
      const msgs = th.getMessages();
      const m = msgs[msgs.length - 1];
      if (SKIP_FROM.test(m.getFrom())) { th.addLabel(done); continue; }
      const text = '📩 新着メール\n' +
        '送信元: ' + clean_(m.getFrom(), 80) + '\n' +
        '件名: ' + clean_(m.getSubject() || '(件名なし)', 120) + '\n' +
        clean_(m.getPlainBody(), 200) + '\n' +
        'https://mail.google.com/mail/u/0/#all/' + th.getId();
      const res = UrlFetchApp.fetch(url, {
        method: 'post', contentType: 'application/json; charset=UTF-8',
        payload: JSON.stringify({ text: text }), muteHttpExceptions: true
      });
      if (res.getResponseCode() >= 300) {  // 失敗したらラベルを付けずに止め、次回もう一度送る
        console.warn('通知に失敗: HTTP ' + res.getResponseCode());
        break;
      }
      th.addLabel(done);
    }
  } finally {
    lock.releaseLock();
  }
}

// 外部から届いた文字列を、通知先でリンクやメンションとして解釈されない形に整える
function clean_(s, max) {
  const t = String(s).replace(/\s+/g, ' ').trim()
    .replace(/</g, '＜').replace(/>/g, '＞').replace(/&/g, '＆').replace(/@(channel|here|everyone|all)\b/gi, '＠$1');
  return t.length > max ? t.slice(0, max) + '…' : t;
}
```

書き換えるのは主に `QUERY`（どのメールを通知するか）です。例：`'in:inbox from:(@torihikisaki.co.jp) newer_than:2d'`、`'in:inbox to:(info@example.com) newer_than:2d'`。本文を送りたくない場合は、`clean_(m.getPlainBody(), 200) + '\n' +` の行を消してください。

## 4. このコードが防いでいる4つの失敗

- **同じメールが何度も通知される**：5分おきに実行しても、通知済みのスレッドには「通知済み」ラベルが付いているので検索に出てきません。前回の実行がまだ終わっていないときは `LockService` で今回の実行をスキップします。

- **送信に失敗したメールが通知されないまま消える**：Webhookが200番台以外を返したら、そのスレッドにはラベルを付けずに止めます。次回の実行でもう一度送られます。

- **メールの件名で @channel やリンクが発動する**：件名・本文は外部の人が自由に書ける文字列です。`<!channel>` や `@here`、`<URL|表示名>` 形式のリンクがそのままチャットで解釈されないよう、`< > &` と `@channel` などを全角にしてから送ります。

- **Webhook URLが漏れる**：URLはスクリプトプロパティに置き、コードには書きません。コードを他の人に共有しても、URLは一緒に渡りません。

## 5. よくあるつまずき

- **何も届かない**：実行ログに「通知に失敗: HTTP 4xx」と出ていないか確認してください。403/404ならWebhook URLの貼り間違いか、Webhookが削除されています。
- **同じスレッドに返信が来ても通知されない**：このコードはスレッド単位で「通知済み」にします。返信のたびに通知したい場合は、通知後にラベルを外す運用にするか、メッセージIDを記録する方式に変える必要があります。
- **過去のメールが一気に流れた**：初回は `QUERY` の `newer_than:2d` の範囲がまとめて通知されます（1回20件まで）。気になる場合は初回だけ `newer_than:1h` にしてください。
- **「Gmailで開く」リンクが別のアカウントを開く**：リンクの `/u/0/` を `/u/1/` などに変えてください。

> 同じ内容をWebページでも公開しています（Webページ版のほうが先に更新されます）: [新着メールをSlack・Google Chatに通知する（二重通知なし）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-notify-slack-google-chat-gas.html?ref=zenn-book-gmail-notify-chat)
