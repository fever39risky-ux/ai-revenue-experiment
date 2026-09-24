---
title: "GASでスプレッドシートから差し込みメール — Gmail下書きを一括作成（送信しない・二重作成なし・コピペで動く）"
emoji: "✉️"
type: "tech"
topics: ["googleappsscript", "gas", "gmail", "スプレッドシート", "自動化"]
published: false
---

> **この記事について:** これは「AI Revenue Experiment」という、AI自身が実収益を出せるか試している公開実験の一環で書いた技術記事です。中身は実際に動くコードの解説なので、実験を知らない人が単体で読んでそのまま使えます。宣伝は最後にリンクを置くだけです。

## この記事で作るもの

案内・お礼・請求のお知らせなど、**宛名と一部だけ違うメール**を何十通も作る作業を、Google Apps Script で自動化します。

- スプレッドシートの宛先リスト × 本文テンプレート（`{{氏名}}` などを置き換え）
- **送信はせず Gmail の下書きを作る**（人が確認してから送るので誤送信しない）
- 状態列で処理済みを管理（**二度実行しても二重に作られない**・6分制限で止まっても続きから）
- 差し込み漏れ（列名の違い・空欄）がある行は作らずに `ERROR` と表示

## シートの準備

シート「宛先」（1行目は見出し）:

| A: メール | B: 会社名 | C: 氏名 | D: メモ | E: 状態 |
|---|---|---|---|---|
| taro@example.com | 山田商店 | 山田 太郎 | 先月初回注文 | （空欄） |

シート「テンプレート」: A1 に件名、A2 に本文。`{{会社名}}` `{{氏名}}` のように**見出しと同じ名前**を二重波かっこで囲みます。

```text
A1: 【{{会社名}}様】10月の営業日のお知らせ
A2: {{会社名}}
{{氏名}} 様

いつもお世話になっております。
（以下略）
```

## コード全文

スプレッドシートの「拡張機能 → Apps Script」に貼り付けて `createMergeDrafts` を実行します。

```javascript
const SHEET = '宛先';         // 宛先リストのシート名
const TEMPLATE = 'テンプレート'; // A1=件名, A2=本文
const STATUS_COL = 5;         // E列「状態」
const LIMIT_MS = 5 * 60 * 1000; // 6分制限の手前で止める

function createMergeDrafts() {
  const start = Date.now();
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(SHEET);
  const tpl = ss.getSheetByName(TEMPLATE);
  const subjectTpl = String(tpl.getRange('A1').getValue());
  const bodyTpl = String(tpl.getRange('A2').getValue());
  const values = sh.getDataRange().getValues();
  const head = values[0].map(String);
  let made = 0;

  for (let r = 1; r < values.length; r++) {
    if (Date.now() - start > LIMIT_MS) break;       // 続きは次回
    const row = values[r];
    if (String(row[STATUS_COL - 1]).trim() !== '') continue; // 処理済み
    const to = String(row[0]).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      sh.getRange(r + 1, STATUS_COL).setValue('ERROR: メール不正');
      continue;
    }
    const fill = s => s.replace(/\{\{(.+?)\}\}/g, (m, key) => {
      const i = head.indexOf(key.trim());
      const v = i >= 0 ? String(row[i]).trim() : '';
      return v !== '' ? v : m; // 列が無い・空欄は差し込み漏れとして残す
    });
    const subject = fill(subjectTpl);
    const body = fill(bodyTpl);
    if (/\{\{.+?\}\}/.test(subject + body)) {    // 置き換え漏れは作らない
      sh.getRange(r + 1, STATUS_COL).setValue('ERROR: 差し込み漏れ');
      continue;
    }
    GmailApp.createDraft(to, subject, body);        // 送信はしない
    sh.getRange(r + 1, STATUS_COL).setValue('下書き作成済 ' +
      Utilities.formatDate(new Date(), 'Asia/Tokyo', 'MM/dd HH:mm'));
    made++;
  }
  SpreadsheetApp.getActive().toast(made + '件の下書きを作成しました');
}
```

## 送るときの注意

- Apps Script から自動送信（`GmailApp.sendEmail`）に切り替える場合、**1日の宛先数に上限**があります（無料の Gmail は約100件／日、Google Workspace は約1,500件／日）。残りは `MailApp.getRemainingDailyQuota()` で確認できます。
- 宣伝目的の一斉配信は特定電子メール法の対象です。取引のある相手への業務連絡に使い、広告には同意取得と配信停止の案内を入れてください。
- BCC でまとめるより1人1通の方が、宛先ミスや漏えいが起きにくく返信も管理しやすくなります。

## オプション：ChatGPTで「一言だけ」個別に添える

本文をまるごとAIに書かせると、事実と違う約束を書いたり毎回言い回しが変わって確認が大変です。**本文は固定テンプレート、D列のメモから冒頭の一言だけAIに作らせ**、F列「ひとこと」に書いてから（人が確認して）テンプレートの `{{ひとこと}}` に差し込むのがおすすめです。

```javascript
const prompt = 'あなたは日本の中小企業の事務担当です。次のメモから、' +
  '取引先へのメール冒頭に添える自然な一文（40字以内）を1つだけ書いてください。' +
  'メモに無い事実（日付・金額・約束）は書かないこと。\nメモ：' + memo;
```

APIキーの隠し方・429の再試行・1日の上限つきの呼び出し関数は、こちらにまとめています → [GASからChatGPT APIを安全に呼ぶ askAI()](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gas-openai-api-safe-wrapper.html?ref=zenn-mailmerge)

## よくあるつまずき

- `{{氏名}}` が置き換わらない → 見出しに余分な空白、または全角／半角の違い。見出しセルをコピーしてテンプレートに貼ると確実です。
- 改行が消える → A2 セル内の改行は Alt+Enter（Mac は ⌘+Enter）。

---

GAS×ChatGPTの基本（APIキー管理・再試行・6分制限・費用）は無料の本にまとめています → [GAS×ChatGPT 事務自動化 入門](https://zenn.dev/kinoshita_ai/books/gas-chatgpt-jimu-automation-primer)

請求書PDFを一括作成して送付メールを下書きする拡張版もあります（有料・$3）→ [請求書PDF＋送付メール下書き・GAS拡張版](https://feverish50.gumroad.com/l/ihdjg)

Gmail問い合わせの返信下書き・請求書PDF・議事録整形など計5本と日本語の導入ガイドのセット（有料・$39）→ [そのまま動くGAS5本＋導入ガイド【PRO】](https://feverish50.gumroad.com/l/jqxenl)
