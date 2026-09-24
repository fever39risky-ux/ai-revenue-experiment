---
title: "送信元ごとに自動でラベル分けする（ルールはスプレッドシートで管理）"
---

取引先ごと・サービスごとにメールをラベルで分けたい。Gmailの「フィルタ」でもできますが、取引先が数十社になると設定画面で管理しきれず、過去のメールには付け直しの手間もかかります。この章では Google Apps Script（GAS）で、**スプレッドシートの一覧表に書いた「送信元 → ラベル」のとおりに自動でラベルを付ける**仕組みを作ります。

## 1. Gmailのフィルタとの使い分け

| こんなとき | おすすめ |
| --- | --- |
| 振り分けが数件で、今後届くメールだけでよい | Gmail標準のフィルタで十分です（設定 → フィルタとブロック中のアドレス） |
| 取引先が多く、一覧表で管理・共有したい | この章のGAS |
| 過去のメールにもまとめて同じラベルを付けたい | この章のGAS（初回だけ全期間を処理） |
| 付けた件数を確認してから本番にしたい | この章のGAS（お試しモード） |

## 2. 手順

- Googleスプレッドシートを新しく作り、シート名を「ルール」にします。1行目は見出し、2行目から下の表のように書きます。

- メニュー「拡張機能」→「Apps Script」を開き、下のコードを貼り付けて保存します。

- `DRY_RUN = true` のまま ▶ で `sortBySender` を実行し、Gmailとスプレッドシートへのアクセスを許可します。実行ログに「[お試し] @a-sha.co.jp → 取引先/A社: 12件」のように出ます。

- 過去のメールにも付けたい場合は、`LOOKBACK = ''` にして `DRY_RUN = false` で1回実行します（件数が多いと数回に分かれます）。

- `LOOKBACK = 'newer_than:2d'` に戻して保存し、左の時計アイコン「トリガー」→ 関数 `sortBySender`・「時間主導型」・「分ベースのタイマー」・「15分おき」で保存します。

| 送信元（A列） | ラベル（B列） | 受信トレイから外す（C列） |
| --- | --- | --- |
| @a-sha.co.jp | 取引先/A社 | FALSE |
| billing@example-cloud.com | 請求 | TRUE |
| news.example-shop.jp | メルマガ | TRUE |

送信元はメールアドレス（`info@…`）でもドメイン（`@a-sha.co.jp`）でも書けます。ラベル名に「/」を入れると「取引先」の下に「A社」がまとまります。C列を TRUE にした行は、ラベルを付けたうえで受信トレイから外します（削除はしません）。

## 3. コード全文（コピペで動きます）


```javascript
const DRY_RUN = true;                  // まずは true のまま実行し、ログで対象を確認する
const SHEET_NAME = 'ルール';            // A列: 送信元  B列: ラベル名  C列: 受信トレイから外す(TRUE/FALSE)
const LOOKBACK = 'newer_than:2d';      // 定期実行で見る範囲。過去のメールにも付けたい初回だけ '' にする
const BATCH = 100;                     // GmailApp の一括操作は1回100件まで
const TIME_LIMIT_MS = 4.5 * 60 * 1000; // 6分制限の手前で止め、続きは次回

function sortBySender() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  const start = Date.now();
  try {
    const rows = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME).getDataRange().getValues().slice(1);
    for (const [rawSender, rawLabel, rawSkip] of rows) {
      const sender = String(rawSender).trim(), labelName = String(rawLabel).trim();
      if (!sender || !labelName) continue;
      // 空白や OR などが入ると検索式が広がるので、メールアドレス・ドメインの形だけ受け付ける
      if (!/^[A-Za-z0-9._%+\-]*@?[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/.test(sender)) {
        console.warn('送信元の書き方が不正なのでスキップ: ' + sender); continue;
      }
      const skipInbox = rawSkip === true || String(rawSkip).toUpperCase() === 'TRUE';
      const q = 'from:(' + sender + ')' + (LOOKBACK ? ' ' + LOOKBACK : '');
      const label = DRY_RUN ? null : (GmailApp.getUserLabelByName(labelName) || GmailApp.createLabel(labelName));
      let offset = 0, labeled = 0, archived = 0;
      while (Date.now() - start < TIME_LIMIT_MS) {
        const threads = GmailApp.search(q, offset, BATCH);
        if (!threads.length) break;
        offset += threads.length;   // ラベルを付けても検索結果は変わらないので、そのまま次へ進む
        const todo = threads.filter(t => !t.getLabels().some(l => l.getName() === labelName));
        const toArchive = skipInbox ? todo.filter(t => t.isInInbox()) : [];
        labeled += todo.length; archived += toArchive.length;
        if (DRY_RUN) continue;
        if (todo.length) label.addToThreads(todo);
        if (toArchive.length) GmailApp.moveThreadsToArchive(toArchive);
      }
      console.log((DRY_RUN ? '[お試し] ' : '') + sender + ' → ' + labelName + ': ' + labeled + '件' +
        (skipInbox ? '（うち受信トレイから外す ' + archived + '件）' : ''));
      if (Date.now() - start >= TIME_LIMIT_MS) { console.log('時間切れ。続きは次回の実行で処理します'); break; }
    }
  } finally {
    lock.releaseLock();
  }
}
```


## 4. このコードが防いでいる4つの失敗

- **表の書き間違いで大量のメールに付く**：送信元に空白や `OR` が入ると、Gmailの検索式が意図より広くなります。このコードはメールアドレス・ドメインの形になっていない行をスキップし、ログに警告を出します。

- **確認せずに本番で動かしてしまう**：お試しモードでは何も変更せず、ルールごとの件数だけを出します。

- **同じラベルを何度も付け直す・受信トレイに戻したメールをまた外す**：すでにそのラベルが付いているスレッドは処理しません。自分で受信トレイに戻したメールが、次の実行でまた外されることもありません。

- **過去メールが多くてエラーになる**：一括操作は1回100件までなので100件ずつ、実行時間は4.5分で区切り、続きは次回に回します。`LockService` で実行の重なりも防ぎます。

## 5. よくあるつまずき

- **ラベルは付いたのに受信トレイに残っている**：C列が TRUE になっているか確認してください。セルに「はい」などと書くと FALSE 扱いです。
- **関係ないメールまで付いた**：`gmail.com` のように多くの人が使うドメインを書くと、その全員が対象になります。Gmailなどのフリーメールはアドレス単位で書いてください。付いたラベルはGmailでまとめて外せます。
- **「お試し」の件数が0件**：送信元の表記を、実際のメールの差出人アドレスと比べてください。Gmailの検索窓に `from:(@a-sha.co.jp)` と入れて結果が出るかで確かめられます。
- **会社のGoogle Workspaceで使う**：スクリプトからGmailへのアクセスが管理者に制限されている場合があります。

> 同じ内容をWebページでも公開しています（Webページ版のほうが先に更新されます）: [送信元ごとに自動でラベル分けする（ルールはスプレッドシートで管理）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-sender-auto-label-gas.html?ref=zenn-book-gmail-sender-label)
