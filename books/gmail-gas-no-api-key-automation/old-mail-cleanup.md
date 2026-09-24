---
title: "古いメールを自動で削除・アーカイブする（お試しモード・スター保護）"
---

「Googleアカウントの保存容量がいっぱい」「受信トレイが何万件」——手で消すのは大変ですが、一括削除は大事なメールまで消しそうで怖いものです。この章では Google Apps Script（GAS）で、**決めたルールに合う古いメールだけを、毎日少しずつゴミ箱かアーカイブへ移す**仕組みを作ります。

## 1. できること

| 項目 | この章のコード |
| --- | --- |
| 初期ルール | プロモーション・SNS通知タブは最後のやり取りから30日でゴミ箱へ／受信トレイは90日でアーカイブ（消さずに受信トレイから外すだけ） |
| お試しモード | `DRY_RUN = true` の間は何も動かさず、対象の件数と件名の例だけをログに出します |
| 触らないもの | スター付き・「保存」ラベル付きのスレッド、最後のメッセージがまだ新しいスレッド |
| 大量のメール | 100件ずつ処理し、4.5分で止めて続きは次回（6分の実行時間制限に当たりません） |

ゴミ箱に移したメールは30日間は元に戻せます。完全削除はしません。

## 2. 手順

- [script.google.com](https://script.google.com/) で「新しいプロジェクト」を作り、下のコードを貼り付けます。

- 残したいメールにスターを付けるか、Gmailで「保存」というラベルを作って付けておきます。

- `DRY_RUN = true` のまま ▶ で `cleanupGmail` を実行し、Gmailへのアクセスを許可します。実行ログに「[お試し] プロモーション: 245件 ゴミ箱へ 例: …」のように出ます。

- 件数と例を見て問題なければ、`DRY_RUN = false` にして保存し、もう一度実行します。

- 左の時計アイコン「トリガー」→ 関数 `cleanupGmail`・「時間主導型」・「日付ベースのタイマー」・「午前3時〜4時」などで保存します。初回で終わらなかった分は毎日続きが処理されます。

## 3. コード全文（コピペで動きます）


```javascript
const DRY_RUN = true;                  // まずは true のまま実行し、ログで対象を確認する
const RULES = [                        // days: 最後のメッセージからこの日数が過ぎたスレッドが対象
  { name: 'プロモーション', query: 'category:promotions', days: 30, action: 'trash' },
  { name: 'SNS通知',       query: 'category:social',     days: 30, action: 'trash' },
  { name: '受信トレイ整理', query: 'in:inbox',            days: 90, action: 'archive' },
];
const PROTECT = ' -is:starred -label:保存';   // スター付きと「保存」ラベルは絶対に触らない
const BATCH = 100;                     // GmailApp の一括操作は1回100件まで
const TIME_LIMIT_MS = 4.5 * 60 * 1000; // 6分制限の手前で止め、続きは次回

function cleanupGmail() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;
  const start = Date.now();
  try {
    for (const r of RULES) {
      if (!(r.days >= 1)) throw new Error(r.name + ': days を1以上にしてください');
      const q = r.query + ' older_than:' + r.days + 'd' + PROTECT + (r.action === 'archive' ? ' in:inbox' : '');
      const cutoff = new Date(Date.now() - r.days * 86400000);
      let offset = 0, done = 0, sample = [];
      while (Date.now() - start < TIME_LIMIT_MS) {
        const threads = GmailApp.search(q, offset, BATCH);
        if (!threads.length) break;
        // 検索は「どれか1通が古い」スレッドも返すので、最後のやり取りが新しいものは除外
        const targets = threads.filter(t => t.getLastMessageDate() < cutoff);
        if (sample.length < 5) targets.slice(0, 5 - sample.length).forEach(t => sample.push(t.getFirstMessageSubject()));
        if (DRY_RUN) { done += targets.length; offset += threads.length; continue; }
        if (targets.length) {
          if (r.action === 'trash') GmailApp.moveThreadsToTrash(targets);
          else GmailApp.moveThreadsToArchive(targets);
        }
        done += targets.length;
        offset += threads.length - targets.length;  // 除外したぶんだけ次の検索位置をずらす
      }
      console.log((DRY_RUN ? '[お試し] ' : '') + r.name + ': ' + done + '件 ' +
        (r.action === 'trash' ? 'ゴミ箱へ' : 'アーカイブ') + ' 例: ' + sample.join(' / '));
    }
  } finally {
    lock.releaseLock();
  }
}
```

書き換えるのは `RULES` です。例：`{ name: '通販の発送通知', query: 'from:(@example-shop.jp) subject:発送', days: 60, action: 'trash' }`、`{ name: '大きいメール', query: 'larger:10M', days: 365, action: 'archive' }`。`query` はGmailの検索窓と同じ書き方です。検索窓で試してから入れると確実です。

## 4. このコードが防いでいる4つの失敗

- **最近返信が来たスレッドまで消える**：Gmailの検索は「スレッドのどれか1通が条件に合う」と結果に出るので、`older_than:30d` だけだと、昨日返信があった古いやり取りも対象になります。このコードは最後のメッセージの日付を確かめ、新しいものは除外します。

- **確認せずに一括で消してしまう**：最初はお試しモードで件数と件名の例だけを出します。ルールの書き間違い（検索式が広すぎる）に、動かす前に気づけます。

- **大事なメールが巻き込まれる**：スター付きと「保存」ラベルは、どのルールでも検索式に除外条件を足しています。

- **数万件でエラーになる**：一括操作は1回100件までなので100件ずつ、実行時間は4.5分で区切ります。`LockService` で、前回の実行が終わる前に次が重なっても二重に動きません。

## 5. よくあるつまずき

- **実行したのに容量が減らない**：ゴミ箱のメールも容量に数えられます。30日で自動的に消えるのを待つか、確認したうえでゴミ箱を手動で空にしてください。アーカイブは容量を減らしません。
- **SNS通知が0件**：Gmailの設定でタブ（カテゴリ）を使っていないと `category:social` には何も入りません。`from:` で送信元を指定するルールに変えてください。
- **間違えて消した**：Gmailの「ゴミ箱」を開き、スレッドを選んで「受信トレイに移動」で戻せます（30日以内）。
- **会社のGoogle Workspaceで使う**：保存義務のあるメール（契約・請求など）は、社内ルールや管理者の保持設定を先に確認してください。

> 同じ内容をWebページでも公開しています（Webページ版のほうが先に更新されます）: [古いメールを自動で削除・アーカイブする（お試しモード・スター保護）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-old-mail-auto-cleanup-gas.html?ref=zenn-book-gmail-old-mail-cleanup)
