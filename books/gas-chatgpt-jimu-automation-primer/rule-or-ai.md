---
title: "AIを使わない判断：ルールで済む処理を先に片づけて費用を下げる"
---

前の章で費用の見積もり方を扱いました。いちばん確実な節約は、**AIを呼ばなくていい処理でAIを呼ばないこと**です。事務の自動化は、半分以上がルール（条件分岐）だけで済みます。

## 1. ルールで済む処理・AIが要る処理

| 処理 | ルールで済む | AIが要る |
|---|---|---|
| 送信元・件名で振り分け | ○（`from:` やドメインで判定） | |
| 添付ファイルをドライブに保存 | ○ | |
| 古いメールの整理・アーカイブ | ○（日付とラベルで判定） | |
| 未返信メールのリマインド | ○（最後の送信者が自分かどうか） | |
| 受信メールをシートに書き出す | ○ | |
| 本文の内容で種別・緊急度を判定 | △（キーワードで一部は可） | ○ |
| 要約・返信文の下書き | | ○ |
| 表記ゆれのある文から項目を抜き出す | | ○ |

目安は「**判定の根拠がメールの外形（送信元・日付・件名・添付）にあるならルール、本文の意味にあるならAI**」です。

## 2. ルールで判定して、決まらなかったものだけAIに回す

本文の分類でも、キーワードで確実に決まるものは先に決めてしまえば、AIを呼ぶ回数が減ります。

```javascript
const RULES = [
  { test: /請求書|invoice/i,          label: '請求' },
  { test: /パスワード|ログインできない/, label: 'サポート' },
  { test: /配信停止|unsubscribe/i,     label: '配信停止' },
];

function classify(subject, body) {
  const text = subject + '\n' + body.slice(0, 2000);
  for (const r of RULES) {
    if (r.test.test(text)) return { label: r.label, by: 'rule' };
  }
  // ルールで決まらないものだけAIへ（askAI() は前の章の共通関数）
  const res = askAI('次の問い合わせを 請求/サポート/営業/その他 のどれか1語で答えてください。\n' + text);
  const label = ['請求', 'サポート', '営業', 'その他'].includes(res.trim()) ? res.trim() : 'その他';
  return { label, by: 'ai' };
}
```

`by` をシートに記録しておくと、「AIに回った件数」がわかります。AI行を見返して、毎回同じ理由で分類されているものはルールに追加します。使うほどAIの呼び出しが減り、費用も誤判定も下がります。

## 3. ルールだけでも安全設計は同じ

AIを使わない自動化でも、事故はトリガーと二重処理から起きます。前の章の「DRY_RUN」「自動送信しない」と、次の章の「トリガーの重複防止・ロック・メッセージ単位の処理済み記録」は、そのまま使ってください。

## APIキー不要で動く例

ルールだけで完結するGmailの自動化を、コード全文つきで公開しています（OpenAIの契約も費用も不要です）。

- [Gmailを送信元ごとに自動でラベル分けする（スプレッドシートでルール管理）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-sender-auto-label-gas.html?ref=zenn-book-rule-or-ai)
- [Gmailの受信メールをスプレッドシートに自動で書き出す](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-to-spreadsheet-export-gas.html?ref=zenn-book-rule-or-ai)
- [Gmailの古いメールを自動で削除・アーカイブする（お試しモード・スター保護）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-old-mail-auto-cleanup-gas.html?ref=zenn-book-rule-or-ai)
- [Googleフォームの自動返信メールをGASで送る](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/google-form-auto-reply-gas.html?ref=zenn-book-rule-or-ai)

:::message
**時間を省きたい方へ（有料）:** ラベル分け・シート書き出し・古いメール整理・添付ファイル保存・Slack/Google Chat通知・未返信リマインドの6本を、1つのシートで同時に動かせるよう整理し、定期実行のON/OFF・状態確認メニューを付けたセットです → **Gmail自動化GAS 6本セット・APIキー不要（$9）** [Gumroad](https://feverish50.gumroad.com/l/olrtpl)

ルール＋AIの組み合わせ（FAQに載っている事実以外は断定させない返信下書き）が必要なら → **Gmail問い合わせAI下書き返信・GAS拡張版（$3）** [Gumroad](https://feverish50.gumroad.com/l/koujr)
:::
