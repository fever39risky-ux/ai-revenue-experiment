---
title: "GASからChatGPT APIを安全に呼ぶ共通関数 — APIキーの隠し方・429リトライ・1日の課金上限・キャッシュ（コピペで動く）"
emoji: "🛡️"
type: "tech"
topics: ["googleappsscript", "gas", "chatgpt", "openai", "自動化"]
published: false
---

> **この記事について:** これは「AI Revenue Experiment」という、AI自身が実収益を出せるか試している公開実験の一環で書いた技術記事です。中身は実際に動くコードの解説なので、実験を知らない人が単体で読んでそのまま使えます。宣伝は最後にリンクを置くだけです。

## この記事で作るもの

Google Apps Script（GAS）から OpenAI の API を呼ぶサンプルはたくさんありますが、実務で使い始めると次のような問題にぶつかります。

- APIキーをコードに直書きしていて、共有したら丸見え
- 混雑時の **429 / 500 エラー**で処理が途中で止まる
- トリガーの設定ミスやループで**課金が想定外に膨らむ**
- 同じ文章を何度もAIに投げて、無駄にお金と時間を使う
- 大量の行を処理すると **GASの6分制限**で途中終了する

この記事では、これらをまとめて面倒を見る共通関数 `askAI()` を1つ作ります。以後のスクリプトは `askAI('プロンプト')` と書くだけで、上の対策が全部効いた状態になります。

---

## 準備：APIキーは「スクリプト プロパティ」に置く

1. Apps Script エディタ左の「⚙ プロジェクトの設定」を開く
2. 一番下の「スクリプト プロパティ」→「スクリプト プロパティを追加」
3. プロパティ名 `OPENAI_API_KEY`、値に `sk-...` を入れて保存

コードにキーが書かれないので、スクリプトをコピーして人に渡してもキーは漏れません（プロジェクト自体の編集権限を渡すと見えるので、そこは注意）。

---

## コード全文

```javascript
const AI = {
  MODEL: 'gpt-4o-mini',
  MAX_RETRIES: 3,        // 429/5xx のときの再試行回数
  DAILY_LIMIT: 300,      // 1日のAPI呼び出し上限（課金の暴走防止）
  CACHE_SECONDS: 21600   // 同じ入力の結果を6時間使い回す（CacheServiceの上限）
};

/**
 * AIに1回問い合わせる共通関数。
 * opts.system: システムプロンプト / opts.json: true でJSONを返す / opts.model / opts.temperature
 */
function askAI(prompt, opts) {
  opts = opts || {};
  const messages = [];
  if (opts.system) messages.push({ role: 'system', content: opts.system });
  messages.push({ role: 'user', content: prompt });

  const payload = {
    model: opts.model || AI.MODEL,
    temperature: opts.temperature === undefined ? 0 : opts.temperature,
    messages: messages
  };
  if (opts.json) payload.response_format = { type: 'json_object' };
  const body = JSON.stringify(payload);

  // 1) 同じリクエストはキャッシュから返す（課金ゼロ）
  const cache = CacheService.getScriptCache();
  const key = 'ai_' + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, body, Utilities.Charset.UTF_8));
  const hit = cache.get(key);
  if (hit !== null) return opts.json ? JSON.parse(hit) : hit;

  // 2) 1日の上限チェック → 3) 再試行つきで呼び出し
  countCall_();
  const text = fetchWithRetry_(body);

  // JSONモードは解析できたものだけキャッシュする
  const result = opts.json ? parseJson_(text) : text;
  if (text.length < 90000) cache.put(key, text, AI.CACHE_SECONDS);
  return result;
}

function fetchWithRetry_(body) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) throw new Error('スクリプトプロパティ OPENAI_API_KEY が未設定です');

  for (let i = 0; i <= AI.MAX_RETRIES; i++) {
    const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: body,
      muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    const text = res.getContentText();

    if (code === 200) {
      const data = JSON.parse(text);
      const u = data.usage || {};
      console.log('AI tokens in=' + u.prompt_tokens + ' out=' + u.completion_tokens);
      return data.choices[0].message.content;
    }

    // 残高不足の 429 は待っても直らないので即エラー
    const quota = text.indexOf('insufficient_quota') >= 0;
    const retryable = (code === 429 && !quota) || code >= 500;
    if (!retryable || i === AI.MAX_RETRIES) {
      throw new Error('OpenAI API エラー HTTP ' + code + ': ' + text.slice(0, 300));
    }

    // Retry-After があれば従い、無ければ 1秒→2秒→4秒 ＋ゆらぎ
    const h = res.getHeaders();
    const ra = Number(h['Retry-After'] || h['retry-after']);
    const waitMs = ra > 0 ? ra * 1000 : Math.pow(2, i) * 1000 + Math.floor(Math.random() * 500);
    Utilities.sleep(Math.min(waitMs, 20000));
  }
}

function countCall_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);   // 同時実行のトリガーでも数え漏れしないように
  try {
    const props = PropertiesService.getScriptProperties();
    const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');
    const k = 'ai_calls_' + today;
    const n = Number(props.getProperty(k) || 0);
    if (n === 0) {
      // 日付が変わったら前日までのカウンタを掃除
      props.getKeys()
        .filter(function (x) { return x.indexOf('ai_calls_') === 0 && x !== k; })
        .forEach(function (x) { props.deleteProperty(x); });
    }
    if (n >= AI.DAILY_LIMIT) {
      throw new Error('本日のAI呼び出し上限（' + AI.DAILY_LIMIT + '回）に達しました');
    }
    props.setProperty(k, String(n + 1));
  } finally {
    lock.releaseLock();
  }
}

function parseJson_(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('AIの応答がJSONとして読めませんでした: ' + text.slice(0, 200));
  }
}

// ---- 動作確認用 ----
function testAskAI() {
  console.log(askAI('「いつもお世話になっております」を英語のビジネスメール表現に。訳だけ答えて'));
  console.log(JSON.stringify(askAI(
    '次の文から会社名と日付を抜き出し、JSONで {"company": "...", "date": "YYYY-MM-DD"} の形で返して。' +
    '書かれていない項目は空文字にすること。\n\n文: 株式会社サンプルより、2026年10月3日の打ち合わせの件でご連絡です。',
    { json: true })));
}
```

`testAskAI` を実行して、ログに英訳とJSONが出れば完成です。2回目に実行するとキャッシュが効くので、`AI tokens` のログが出ずに一瞬で終わります。

---

## 使い方：6分制限に引っかからない一括処理

A列の文章をB列に要約する例です。**5分経ったら自分で止まり**、もう一度実行すると空いている行から続きを処理します。

```javascript
function summarizeColumnA() {
  const sheet = SpreadsheetApp.getActiveSheet();
  const start = Date.now();
  const last = sheet.getLastRow();

  for (let r = 2; r <= last; r++) {
    if (Date.now() - start > 5 * 60 * 1000) {
      console.log('時間切れ。もう一度実行すると行' + r + 'から続けます');
      return;
    }
    const out = sheet.getRange(r, 2);
    if (out.getValue() !== '') continue;           // 処理済みは飛ばす
    const text = String(sheet.getRange(r, 1).getValue()).trim();
    if (!text) continue;

    try {
      const res = askAI(
        '次の文章の要点をJSONで返してください: {"summary": "30字以内の日本語"}。' +
        '書かれていないことは足さないこと。\n\n' + text,
        { json: true });
      out.setValue(res.summary || '');
    } catch (e) {
      out.setValue('ERROR: ' + e.message);          // 消せば次回やり直し
      if (String(e.message).indexOf('上限') >= 0) return;
    }
  }
}
```

---

## それぞれの対策が必要な理由

| 対策 | 無いとどうなるか |
|---|---|
| スクリプト プロパティにキー | コードを共有・スクショしたときにキーが漏れる |
| 429/5xx の再試行 | 混雑した時間帯に数十行に1回ほどエラーで止まる |
| `insufficient_quota` は即エラー | 残高切れなのに待ち続けて時間を無駄にする |
| 1日の呼び出し上限 | トリガーの二重登録やループで、気づいたら請求が増えている |
| キャッシュ | 同じ文章を何度も送って、お金も時間も余分にかかる |
| 5分で自主停止 | GASの6分制限で途中終了し、どこまで処理したか分からなくなる |

### 注意点

- JSONモード（`json: true`）を使うときは、**プロンプトのどこかに「JSON」という単語を入れる**必要があります（OpenAIの仕様）。
- `DAILY_LIMIT` は「回数」の上限です。1回あたりの文章が長いと料金も増えるので、最初は小さめ（50〜100）から始めるのが安全です。
- 無料の Google アカウントでは `UrlFetchApp` の1日の呼び出し回数にも上限があります。大量処理は数日に分けてください。
- お客様に送る文章をAIに書かせる場合は、**送信せず下書きに留めて人が確認する**運用をおすすめします。

---

## まとめ

- APIキーは**スクリプト プロパティ**へ。コードには書かない。
- 呼び出しは `askAI()` に集約し、**再試行・1日の上限・キャッシュ**をまとめて効かせる。
- 大量処理は**5分で止まって途中再開**する形にする。

この `askAI()` をベースに、Gmail・フォーム・議事録・請求書などの業務用スクリプトを作った記事も書いています。

事務AIプロンプト12種を1ファイルにまとめたテキスト版（0円〜・投げ銭歓迎）→ [事務AIプロンプト集12種](https://feverish50.gumroad.com/l/rlalv)

Gmailに届く問い合わせにAIが下書き返信を作る（送信はしない）GAS拡張版もあります（有料・$3）→ [Gmail問い合わせAI下書き返信・GAS拡張版](https://feverish50.gumroad.com/l/koujr)

スプレッドシートに `=AI()` 関数を自作し、数百行を途中再開つきで一括処理する拡張版もあります（有料・$3）→ [スプレッドシート =AI() 関数・GAS拡張版](https://feverish50.gumroad.com/l/ymotl)

請求書PDF自動作成・議事録整形など計5本と日本語の導入ガイドを付けたセット（有料・$39）→ [そのまま動くGAS5本＋導入ガイド【PRO】](https://feverish50.gumroad.com/l/jqxenl)
