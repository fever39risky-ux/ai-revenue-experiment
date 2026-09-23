---
title: "AIの答えをJSONで受け取り、検証してからシートに書く"
---

「この問い合わせを分類して」と頼むと、AIは「分類：見積依頼です。理由は…」のように毎回少しずつ違う書き方で答えます。これをそのままシートに書くと、後で集計やフィルタができません。**決まった形（JSON）で答えさせ、コードで中身を確かめてから書く**のが基本です。

## response_format で JSON を強制する

OpenAIのChat Completions APIでは、`response_format: { type: 'json_object' }` を付けると、必ずJSONとして読める文字列が返ります（プロンプト内に「JSON」という語を含める必要があります）。前章の `askAI()` に引数を1つ足します。

```javascript
function askAIJson(prompt, systemPrompt) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });
  const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + getApiKey_() },
    payload: JSON.stringify({
      model: AI_CONFIG.MODEL,
      messages: messages,
      temperature: 0,
      response_format: { type: 'json_object' }
    }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  return JSON.parse(JSON.parse(res.getContentText()).choices[0].message.content);
}
```

（再試行が必要なら、前章の `askAI()` と同じループで包んでください。）

## 「形」だけでなく「中身」も検証する

JSONとして読めても、`category` に想定外の値が入ることはあります。許可した値だけを通します。

```javascript
const CATEGORIES = ['見積依頼', '注文・申込', '不具合・クレーム', '営業・勧誘', 'その他'];

function classifyInquiry(text) {
  const system = 'あなたは中小企業の事務担当です。問い合わせを分類し、JSONのみで答えてください。';
  const prompt =
    '次の問い合わせを分類してください。\n' +
    'category は次のいずれか1つ: ' + CATEGORIES.join(' / ') + '\n' +
    'urgency は high / normal / low のいずれか。\n' +
    'summary は本文に書かれている事実だけで60字以内。書かれていないことは書かない。\n' +
    '出力形式: {"category":"...","urgency":"...","summary":"..."}\n\n' +
    '問い合わせ:\n' + text;

  const r = askAIJson(prompt, system);
  if (CATEGORIES.indexOf(r.category) === -1) r.category = 'その他（要確認）';
  if (['high', 'normal', 'low'].indexOf(r.urgency) === -1) r.urgency = 'normal';
  r.summary = String(r.summary || '').slice(0, 80);
  return r;
}
```

## ポイント

- **temperature は 0**：分類や抽出は、毎回同じ答えが出る方が扱いやすいです。
- **選択肢はコードに一覧で持つ**：プロンプトとチェックが同じ一覧を使うので、選択肢を増やしても食い違いません。
- **想定外の値は「要確認」に倒す**：AIの判断に自信が持てない行を人が見るための目印になります。
- **金額や日付は、AIに計算させない**：請求書の合計などはコードで計算し、AIには文章（添え状など）だけを書かせます。AIに数字を扱わせる場合も、コード側の計算結果と一致するか照合します。
