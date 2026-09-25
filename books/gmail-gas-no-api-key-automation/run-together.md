---
title: "複数の自動化を1つのプロジェクトで動かす（定数名の衝突・トリガー・ロック）"
---

前の章のコードは、それぞれ **1つのApps Scriptプロジェクトに1本だけ** 貼る前提です。2本以上を同じプロジェクト（同じスプレッドシートの「拡張機能 → Apps Script」）に入れると、ここで説明する3つの問題が起きます。

## 1. 定数名の衝突：「Identifier 'DRY_RUN' has already been declared」

Apps Scriptでは、同じプロジェクトの `.gs` ファイルはすべて1つのグローバル空間で動きます。ファイルを分けても、ラベル分けの `const DRY_RUN` と古いメール整理の `const DRY_RUN` は同じ名前として衝突し、**プロジェクト全体が保存時・実行時にエラー** になります（`BATCH`、`TIME_LIMIT_MS`、`QUERY` なども同様です）。

いちばん簡単な対処は **プロジェクトを分けること** です。混ぜる必要がなければ、1本ずつ別のプロジェクトにしてください。

1つのシートにまとめたい場合は、各スクリプトを「名前の箱」に入れます。箱の中の `const` は外から見えないので衝突しません。

```javascript
// ファイル: cleanup.gs
const Cleanup = (() => {
  const DRY_RUN = true;
  const BATCH = 100;
  function run() {
    // 古いメール整理の cleanupGmail() の中身をここへ（DRY_RUN・BATCH はこの箱の中の値が使われる）
    console.log('cleanup: DRY_RUN=' + DRY_RUN + ' BATCH=' + BATCH);
  }
  return { run };
})();

// ファイル: label.gs
const Label = (() => {
  const DRY_RUN = false;   // 同じ名前でも衝突しない
  const BATCH = 50;
  function run() {
    console.log('label: DRY_RUN=' + DRY_RUN + ' BATCH=' + BATCH);
  }
  return { run };
})();

// トリガーや ▶ から呼ぶのは、箱の外に置いた普通の関数
function cleanupGmail() { Cleanup.run(); }
function sortBySender() { Label.run(); }
```

トリガーに指定できるのは箱の外の関数だけなので、呼び出し用の関数（`cleanupGmail` など）は必ず箱の外に置きます。

## 2. トリガーの重複と「全部消す」事故

「トリガーを作る関数」を2回実行すると、同じ関数のトリガーが2つ登録され、1回の周期に2回動きます。作る前に **その関数のトリガーだけ** を消します。

```javascript
function setTrigger_(fn, minutes) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === fn)   // 他の自動化のトリガーは消さない
    .forEach(t => ScriptApp.deleteTrigger(t));
  if (minutes) ScriptApp.newTrigger(fn).timeBased().everyMinutes(minutes).create(); // 1/5/10/15/30
}

function triggersOn()  { setTrigger_('notifyNewMail', 5); setTrigger_('sortBySender', 15); }
function triggersOff() { ['notifyNewMail', 'sortBySender'].forEach(fn => setTrigger_(fn, 0)); }
```

ネットでよく見る `ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t))` は、**同じプロジェクトの他の自動化のトリガーまで全部消します**。複数入れたら、関数名で絞って消してください。

## 3. ロックはプロジェクト全体で1つ

各章のコードは `LockService.getScriptLock()` で実行の重なりを防いでいますが、このロックは **関数ごとではなくプロジェクト全体で共有** です。古いメール整理が4分動いている間に通知のトリガーが来ると、通知側は「実行中」と判断して何もせずに終わります。

この本のコードは処理済みをラベルやメールIDで記録しているので、スキップされた分は次回の実行でまとめて処理され、取りこぼしにはなりません。ただし通知が数分遅れることはあるので、次のようにずらすと実用上困りません。

- 重い処理（古いメール整理・過去メールへのラベル付け）は **深夜に1日1回**
- 速さが大事な処理（通知）は **5〜10分おき**

## まとめ

| 問題 | 症状 | 対処 |
| --- | --- | --- |
| 定数名の衝突 | 保存・実行時に「already been declared」 | プロジェクトを分ける／名前の箱に入れる |
| トリガーの重複 | 1回の周期に2回動く | 作る前に同じ関数のトリガーだけ消す |
| 全トリガー削除 | 他の自動化が止まる | 関数名で絞って消す |
| ロックの共有 | 重い処理中に他の処理がスキップ | 処理済み記録で次回に回す／時間をずらす |

:::message
**まとめて動かしたい方へ（有料）:** 添付ファイルのドライブ保存・Slack/Google Chat通知・古いメール整理・送信元ラベル・シート書き出し・未返信リマインドの6本を、定数名やトリガーが衝突しないよう整理して1つのスプレッドシートで同時に動くようにし、「今すぐ実行／定期実行ON・OFF（二重登録なし）／状態確認／このセットの定期実行だけ一括停止」メニューと初期シートの自動作成、日本語の導入手順を付けたセットです。APIキー不要・追加費用なし → **Gmail自動化GAS 6本セット（$9）** [Gumroad](https://feverish50.gumroad.com/l/olrtpl)

Gumroadでの販売です。デジタル納品のため、ダウンロード後の返金はお受けできません（不具合時は誠実に対応します）。
:::

