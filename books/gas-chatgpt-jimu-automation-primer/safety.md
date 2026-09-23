---
title: "安全設計：自動送信しない・DRY_RUN・個人情報・作り話対策"
---

事務の自動化で失敗すると、困るのは自分ではなく**取引先やお客様**です。次の4つを最初から組み込みます。

## 1. 送信ではなく「下書き」を作る

メールを自動化するときは、`GmailApp.sendEmail()` ではなく `GmailApp.createDraft()` を使います。AIが書いた文面を人が一度見てから送る運用にすると、宛先違いや不自然な文面をそこで止められます。

```javascript
GmailApp.createDraft(to, subject, body);   // 送信はしない。下書きフォルダで確認してから送る
```

慣れてきて「この種類のメールは毎回そのまま送っている」と確信できたものだけ、送信に切り替えます。

## 2. DRY_RUN（予行演習）モード

書き込みや下書き作成の前に、「何をするつもりか」だけをログに出すモードを用意します。

```javascript
const DRY_RUN = true;   // 最初は true。ログを見て問題なければ false に

function createDraftSafely(to, subject, body) {
  if (DRY_RUN) {
    Logger.log('[DRY_RUN] 下書き予定 to=%s subject=%s', to, subject);
    return;
  }
  GmailApp.createDraft(to, subject, body);
}
```

## 3. 個人情報を送りすぎない

APIに送った文章は、OpenAIのサーバーで処理されます。

- 送るのは**判断に必要な列だけ**にする（住所・電話番号・口座番号などは、要約や分類に不要なら送らない）
- 社内規程や取引先との契約で外部AIへの送信が制限されていないか確認する
- API経由のデータの扱い（学習への利用や保存期間）は、OpenAIの最新の利用規約・データ方針で確認する

## 4. AIの作り話（ハルシネーション）対策

AIは、文中にない日付や金額をもっともらしく補うことがあります。プロンプトとコードの両方で防ぎます。

- プロンプトに「**本文に書かれている事実だけを使う。書かれていないことは『記載なし』と書く**」と明記する
- 金額・日付・件数は**コードで計算・抽出**し、AIには文章だけを書かせる
- AIの出力に、元データにない数字が含まれていないかを簡単にチェックする

```javascript
// AIの文章中の数字が、元データにあるか確認（簡易版）
function hasUnknownNumbers(aiText, sourceText) {
  const nums = (aiText.match(/\d[\d,]*/g) || []).map(n => n.replace(/,/g, ''));
  const src = sourceText.replace(/,/g, '');
  return nums.some(n => src.indexOf(n) === -1);
}
```

`true` が返った行は「要確認」として人が見るようにすれば、自動化の手間を減らしつつ事故を防げます。
