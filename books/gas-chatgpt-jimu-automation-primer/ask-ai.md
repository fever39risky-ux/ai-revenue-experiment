---
title: "共通関数 askAI()：エラーを待って再試行する"
---

どの自動化でも「プロンプトを渡して、答えの文字列を受け取る」部分は同じです。1つの関数にまとめ、エラー処理をここに集めます。

```javascript
const AI_CONFIG = {
  MODEL: 'gpt-4o-mini',   // 安価で事務用途には十分。精度重視なら上位モデルに
  TEMPERATURE: 0.2,       // 事務用途は低め（毎回ぶれにくい）
  MAX_RETRIES: 4
};

function askAI(prompt, systemPrompt) {
  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });

  for (let attempt = 0; attempt <= AI_CONFIG.MAX_RETRIES; attempt++) {
    const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + getApiKey_() },
      payload: JSON.stringify({
        model: AI_CONFIG.MODEL,
        messages: messages,
        temperature: AI_CONFIG.TEMPERATURE
      }),
      muteHttpExceptions: true   // エラー時も例外にせず、ステータスを自分で見る
    });
    const code = res.getResponseCode();
    if (code === 200) {
      const body = JSON.parse(res.getContentText());
      return body.choices[0].message.content.trim();
    }
    // 429（混雑・レート制限）と5xx（一時的な障害）だけ待って再試行
    if ((code === 429 || code >= 500) && attempt < AI_CONFIG.MAX_RETRIES) {
      Utilities.sleep(Math.pow(2, attempt) * 1000 + Math.floor(Math.random() * 500)); // 1,2,4,8秒…
      continue;
    }
    let msg = 'HTTP ' + code;
    try { msg = JSON.parse(res.getContentText()).error.message || msg; } catch (e) {}
    throw new Error(msg);
  }
}
```

## ポイント

- **`muteHttpExceptions: true`**：これがないと、4xx/5xxでスクリプトが即停止し、原因のメッセージも見えにくくなります。
- **再試行するのは429と5xxだけ**：401（キーが違う）や400（リクエストが不正）は、何度送っても失敗します。待たずに止めて、エラー内容をシートに書く方が早く直せます。
- **429には2種類ある**：短時間に送りすぎた場合は待てば通りますが、「残高不足（insufficient_quota）」も429で返ります。これは待っても直りません。再試行を使い切ったら、エラーメッセージを見て判断してください。
- **待ち時間を倍にしていく（指数バックオフ）**：固定の1秒待ちより、混雑時に通りやすくなります。

## 動作確認

```javascript
function testAskAI() {
  Logger.log(askAI('「お世話になっております」を英語のビジネスメール冒頭に言い換えて。1文で。'));
}
```

エディタで `testAskAI` を選んで実行し、初回の承認画面で許可します。実行ログに英文が出れば準備完了です。
