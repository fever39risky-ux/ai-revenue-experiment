---
title: "費用の見積もり方：トークン数から月額の目安を出す"
---

ChatGPT APIは従量課金で、**送った文字量（入力トークン）と返ってきた文字量（出力トークン）**に応じて課金されます。単価はモデルごとに違い、改定もあるので、この本では数字を固定せず「自分で見積もる方法」を書きます。

## 1. 実際のトークン数を記録する

APIの応答には、その呼び出しで使ったトークン数（`usage`）が入っています。`askAI()` の成功時の処理に1行足して、ログかシートに残しましょう。

```javascript
// askAI() の code === 200 の分岐内
const body = JSON.parse(res.getContentText());
logUsage_(body.usage);   // { prompt_tokens, completion_tokens, total_tokens }
return body.choices[0].message.content.trim();
```

```javascript
function logUsage_(usage) {
  if (!usage) return;
  const sheet = SpreadsheetApp.getActive().getSheetByName('usage')
    || SpreadsheetApp.getActive().insertSheet('usage');
  sheet.appendRow([new Date(), AI_CONFIG.MODEL, usage.prompt_tokens, usage.completion_tokens]);
}
```

## 2. 月額を見積もる

`usage` シートの数日分の平均から、次の式で計算します。

```
1件あたりの費用 = 入力トークン × 入力単価 + 出力トークン × 出力単価
月額の目安     = 1件あたりの費用 × 1日の件数 × 稼働日数
```

単価は[OpenAIの料金ページ](https://openai.com/api/pricing/)で、使っているモデル（`AI_CONFIG.MODEL`）の最新の値を確認してください。多くの場合「100万トークンあたり」で表示されています。

目安として、日本語は**1文字あたり1トークン前後**になることが多いです。問い合わせメール1通（数百字）を分類・要約する程度なら、1件あたりの入出力は合わせて千トークン前後に収まります。

## 3. 費用を下げるコツ

- **送る文字を減らす**：署名・引用された過去メール・定型フッターを削ってから送る
- **安いモデルで足りる作業を見極める**：分類・要約・定型文なら小さいモデルで十分なことが多い。まず小さいモデルで試し、精度に不満がある作業だけ上位モデルにする
- **同じ入力を二度送らない**：結果列が埋まっている行はスキップする（前の章の設計）
- **上限を二重にかける**：OpenAI側の利用上限と、コード側の `MAX_CALLS_PER_RUN`
