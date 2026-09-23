---
title: "6分の壁：大量の行を「続きから」処理する"
---

Apps Scriptの1回の実行には時間制限があり、執筆時点の公式クォータ表では**6分**です。AIを1件呼ぶのに数秒かかるので、数百行を1回で処理しようとすると途中で強制終了します。

## 基本方針

1. 処理済みの行は結果列が埋まっているので**スキップする**（再実行しても二重に処理しない）
2. 開始から一定時間（例：4分30秒）たったら**自分で止める**
3. まだ残っていれば、**1分後に自分自身をもう一度実行する**トリガーを作る

```javascript
const BATCH = {
  SHEET_NAME: 'シート1',
  INPUT_COL: 1,      // A列：入力
  OUTPUT_COL: 2,     // B列：AIの結果
  TIME_BUDGET_MS: 4.5 * 60 * 1000,
  MAX_CALLS_PER_RUN: 50
};

function processRows() {
  const started = Date.now();
  const sheet = SpreadsheetApp.getActive().getSheetByName(BATCH.SHEET_NAME);
  const last = sheet.getLastRow();
  if (last < 2) return;
  const inputs = sheet.getRange(2, BATCH.INPUT_COL, last - 1, 1).getValues();
  const outputs = sheet.getRange(2, BATCH.OUTPUT_COL, last - 1, 1).getValues();

  let calls = 0, remaining = false;
  for (let i = 0; i < inputs.length; i++) {
    const text = String(inputs[i][0]).trim();
    if (!text || String(outputs[i][0]).trim()) continue;          // 空行・処理済みはスキップ
    if (Date.now() - started > BATCH.TIME_BUDGET_MS || calls >= BATCH.MAX_CALLS_PER_RUN) {
      remaining = true;
      break;
    }
    let result;
    try {
      result = askAI('次の文を60字以内で要約して:\n' + text);
    } catch (e) {
      result = 'ERROR: ' + e.message;
    }
    sheet.getRange(i + 2, BATCH.OUTPUT_COL).setValue(result);    // 1行ずつ書く＝途中で止まっても結果が残る
    calls++;
  }
  scheduleNext_(remaining);
}

function scheduleNext_(remaining) {
  // 前回作った「続き」トリガーを消してから作り直す（トリガーが増え続けないように）
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processRows' && t.getEventType() === ScriptApp.EventType.CLOCK)
    .forEach(t => ScriptApp.deleteTrigger(t));
  if (remaining) {
    ScriptApp.newTrigger('processRows').timeBased().after(60 * 1000).create();
  }
}
```

## ポイント

- **結果を1行ずつ書く**：まとめて最後に書く方が速いですが、途中で止まると全部消えます。AI呼び出しの方がずっと遅いので、1行ずつでも体感差はほぼありません。
- **ERROR行は再処理されない**：結果列に `ERROR:` が入った行はスキップされます。原因を直したら、その行のB列を消して再実行してください。
- **トリガーを掃除する**：`after()` のトリガーを消さずに作り続けると、上限に達して作れなくなります。
- **1日の上限もある**：トリガーの合計実行時間や `UrlFetchApp` の呼び出し回数にも1日あたりの上限があり、無料アカウントとGoogle Workspaceで値が違います。大量に回す前に、[公式のクォータ表](https://developers.google.com/apps-script/guides/services/quotas)を確認してください。
