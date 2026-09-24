---
title: "受信メールをスプレッドシートに書き出す（重複なし・数式注入対策）"
---

問い合わせ・注文・予約のメールを、あとで集計したり担当を割り振ったりするために、毎回スプレッドシートへ手でコピーしていませんか。この章では Google Apps Script（GAS）で、**Gmailで受信したメールを1通1行でスプレッドシートに自動で書き出す**方法を、よくある失敗（重複・取りこぼし・件名が数式として動く）の対策込みで紹介します。

## 1. できること

| 項目 | この章のコード |
| --- | --- |
| 対象のメール | Gmailの検索式で指定（送信元・件名・ラベルなど）。例：`from:(order@example.com) newer_than:7d` |
| 書き出す内容 | メールID・受信日時・送信元・件名・本文の先頭300文字・添付ファイル数・Gmailで開くリンク |
| 書き出し方 | まだ書き出していないメールだけを、古い順にまとめて追記（1行ずつ書かないので速い） |
| 実行 | トリガーで1時間おきなど。手動で ▶ を押しても同じ結果（重複しない） |

## 2. 準備

- 新しいスプレッドシートを作り、「拡張機能 → Apps Script」を開きます。

- 下のコードを貼り付け、`QUERY` を対象にしたいメールの検索式に書き換えます（先にGmailの検索窓で試すと確実です）。

- ▶ で `exportMails` を一度実行し、Gmailとスプレッドシートの許可を与えます。「メール一覧」シートに行が入れば成功です。

- 左の時計アイコン「トリガー」→「トリガーを追加」→ 関数 `exportMails`・「時間主導型」・「1時間おき」などで保存します。

## 3. コード全文（コピペで動きます）


```javascript
const QUERY = 'in:inbox newer_than:7d -in:chats'; // 例: 'from:(order@example.com) newer_than:7d'
const SHEET = 'メール一覧';
const BODY_CHARS = 300;               // 本文は先頭だけ（全文を貼るとシートが重くなる）
const LIMIT_MS = 4.5 * 60 * 1000;     // 6分の実行上限の手前で止める

function exportMails() {
  const start = Date.now();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10 * 1000)) return;
  try {
    const sh = sheet_();
    const done = new Set(sh.getLastRow() > 1
      ? sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().map(r => String(r[0]))
      : []);
    const rows = [];
    const threads = GmailApp.search(QUERY, 0, 100);
    outer:
    for (const th of threads) {
      for (const msg of th.getMessages()) {
        if (Date.now() - start > LIMIT_MS) break outer; // 残りは次回の実行で
        const id = msg.getId();
        if (done.has(id)) continue;
        const body = msg.getPlainBody().replace(/\s+/g, ' ').trim().slice(0, BODY_CHARS);
        rows.push([id, msg.getDate(), safe_(msg.getFrom()), safe_(msg.getSubject()),
          safe_(body), msg.getAttachments({ includeInlineImages: false }).length,
          'https://mail.google.com/mail/u/0/#all/' + id]);
        done.add(id);
      }
    }
    if (rows.length) {
      rows.sort((a, b) => a[1] - b[1]);  // 古い順に追記
      sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
  } finally {
    lock.releaseLock();
  }
}

// = + - @ で始まる文字は数式として実行されないよう先頭に ' を付ける
function safe_(s) {
  s = String(s || '');
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.appendRow(['メールID', '受信日時', '送信元', '件名', '本文（先頭）', '添付数', 'Gmailで開く']);
    sh.setFrozenRows(1);
  }
  return sh;
}
```

書き換えるのは主に `QUERY` です。本文をもっと残したいときは `BODY_CHARS` を増やしますが、1セルは5万文字までで、長くするほどシートが重くなります。

## 4. このコードが防いでいる4つの失敗

- **同じメールが何行も入る**：書き出したメールのIDをA列に残し、次回からはスキップします。トリガーと手動実行が重なっても `LockService` で同時実行を防ぎます。

- **返信がついたスレッドの新しいメールを取りこぼす**：「処理済みラベルを付けて除外する」方法は、ラベルがスレッド単位なので、同じスレッドに後から届いたメールを見落とします。このコードは**メール1通ごとのID**で判定します。

- **件名が数式として動いてしまう**：件名や送信元が `=` `+` `-` `@` で始まると、スプレッドシートが数式として解釈します。外部から届く文字列なので、悪意ある `=HYPERLINK(...)` などが仕込まれることもあります。先頭に `'` を付けて、ただの文字として書き込みます。

- **件数が多い日に途中で止まる**：GASの1回の実行は6分までです。4.5分で自分から止めて、それまでの分を書き込み、残りは次の実行で続けます。

## 5. よくあるつまずき

- **何も書き出されない**：`QUERY` をGmailの検索窓に貼って、対象メールが出るか確認してください。`newer_than:7d` は「7日以内」です。過去分をまとめて取り込みたいときは、初回だけ `newer_than:90d` などに広げ、何回か実行します（1回の検索は最大100スレッド）。
- **日時がおかしい**：スクリプトのタイムゾーンは「プロジェクトの設定」で、表示形式はシートの「表示形式 → 数字 → 日時」で変えられます。
- **「Gmailで開く」リンクが別のアカウントを開く**：ブラウザで複数のGoogleアカウントにログインしている場合、リンクの `/u/0/` を `/u/1/` などに変えてください。

> 同じ内容をWebページでも公開しています（Webページ版のほうが先に更新されます）: [受信メールをスプレッドシートに書き出す（重複なし・数式注入対策）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-to-spreadsheet-export-gas.html?ref=zenn-book-gmail-export-sheet)
