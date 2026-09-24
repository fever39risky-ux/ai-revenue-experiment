---
title: "定期実行の落とし穴：トリガーの重複・二重処理・複数スクリプトの共存"
---

自動化は「手動で1回動いた」あとに壊れがちです。原因のほとんどは**定期実行（時間主導トリガー）**まわりです。この章のコードはAPIキー不要なので、Gmailやスプレッドシートの自動化全般にそのまま使えます。

## 1. トリガーは「作る前に消す」

トリガー作成の関数を2回実行すると、同じ関数が2つ登録され、1回の周期で2回走ります。作成前に同じ関数のトリガーを消すと、何度実行しても1つだけになります。

```javascript
function installTrigger() {
  const fn = 'main';
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === fn)
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(fn).timeBased().everyMinutes(15).create(); // 1/5/10/15/30分のいずれか
}
```

## 2. 前の実行が終わる前に次が始まる

処理が長引くと、前回の実行中に次のトリガーが動き、同じメールや行を2回処理します。`LockService` で「実行中なら今回は何もしない」にします。

```javascript
function main() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;   // 前回がまだ動いている
  try {
    run();
  } finally {
    lock.releaseLock();
  }
}
```

## 3. 「処理済み」はスレッドではなくメッセージ単位で記録する

Gmailの自動化でよくあるのが「処理したスレッドにラベルを付けて、ラベル付きは除外」という方法です。ところが**同じスレッドに返信が届くと、新しいメッセージが処理されません**（スレッドにはもうラベルが付いているため）。処理済みはメッセージIDで記録します。

```javascript
function isDone(id) {
  return PropertiesService.getScriptProperties().getProperty('done_' + id) !== null;
}
function markDone(id) {
  PropertiesService.getScriptProperties().setProperty('done_' + id, '1');
}
// for (const msg of thread.getMessages()) { if (isDone(msg.getId())) continue; ... markDone(msg.getId()); }
```

件数が多い場合は、スクリプトプロパティではなくログ用シートにIDを書き出します（プロパティは全体で約500KBまで）。

## 4. 複数のスクリプトを1つのプロジェクトに入れると壊れる

別々に拾ってきたスクリプトを同じプロジェクトに貼ると、`SyntaxError: Identifier 'CONFIG' has already been declared` のように止まります。GASはファイルが分かれていても**すべて同じグローバル空間**だからです。

- 設定は `const GMAIL_SAVE = { ... }` のように、スクリプトごとに名前を分ける
- `onOpen()` はプロジェクトに1つだけ。メニューはその中でまとめて作る
- 上の `installTrigger()` も、関数名ごとに消してから作る

詳しい直し方は [GASで複数のスクリプトを1つのプロジェクトにまとめる方法（解説ページ）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gas-multiple-scripts-one-project.html?ref=zenn-book-triggers) にまとめています。

## APIキー不要のGmail自動化

この章の4点（トリガーの重複防止・ロック・メッセージ単位の処理済み記録・名前の衝突回避）を入れた例を、無料の解説ページで公開しています。

- [Gmailの添付ファイルをGoogleドライブに自動保存する](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-attachment-auto-save-drive-gas.html?ref=zenn-book-triggers)
- [Gmailの返信漏れを防ぐ未返信リマインド](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-unreplied-reminder-gas.html?ref=zenn-book-triggers)
- [GmailをSlack / Google Chatに通知する](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-notify-slack-google-chat-gas.html?ref=zenn-book-triggers)

6本を1つのシートで同時に動かせるよう名前を分け、定期実行のON/OFF・状態確認メニューを付けたセットもあります → **Gmail自動化GAS 6本セット・APIキー不要（$9）** [Gumroad](https://feverish50.gumroad.com/l/olrtpl)
