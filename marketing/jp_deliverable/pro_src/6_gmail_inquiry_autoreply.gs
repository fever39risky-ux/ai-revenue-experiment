/**
 * Gmail問い合わせ 自動仕分け＆下書き返信 — PRO追加スクリプト①
 * 特定ラベルの未読スレッドをAIが分類し、丁寧な返信の下書きを作る（自動送信はしない）。
 *
 * 導入手順：
 *  1) Gmail側で、対応したいメールに付くラベルを1つ用意する（例：「問い合わせ」）
 *  2) script.google.com で新規プロジェクトを作り、このファイルの中身だけを貼る
 *     （このスクリプトは自己完結。3_ai_batch.gs は不要）
 *  3) 下の CONFIG を自社向けに設定
 *  4) 一度 手動で processInquiries を実行して動作確認（初回は権限承認が必要）
 *  5) 左メニュー「トリガー」→ 時間主導型 → 1時間おき などに processInquiries を設定
 *
 * 安全メモ：下書きを作るだけで、送信は必ず人間が確認してから行う。
 */

const CONFIG = {
  API_KEY: 'ここにOpenAI APIキー(sk-...)',   // ← ここだけ変更
  MODEL: 'gpt-4o-mini',
  SOURCE_LABEL: '問い合わせ',                   // この未読スレッドだけを対象にする
  DONE_LABEL: 'AI下書き済',                     // 処理済みに付けるラベル（自動作成）
  MAX_THREADS: 20,                             // 一度に処理する最大スレッド数（暴走防止）
  SIGNATURE: '——\n山田太郎 / 〇〇商店\ninfo@example.com',  // 下書き末尾に付ける署名
  REPLY_POLICY: 'あなたは丁寧で簡潔な日本語のカスタマーサポート担当です。相手の名前が分かれば宛名を付け、要件を1文で受け止めてから回答します。分からない事実（在庫・価格・日程など）は断定せず「確認して折り返します」と書きます。過度な謝罪や誇張はしません。'
};

function onOpen() {} // Gmail用なのでメニューは不要。トリガーから実行します。

function processInquiries() {
  const doneLabel = _getOrCreateLabel(CONFIG.DONE_LABEL);
  const query = `label:${CONFIG.SOURCE_LABEL} is:unread -label:${CONFIG.DONE_LABEL}`;
  const threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS);
  if (threads.length === 0) { Logger.log('対象スレッドなし'); return; }

  let done = 0;
  for (const thread of threads) {
    try {
      const msg = thread.getMessages().pop();
      const from = msg.getFrom();
      const subject = msg.getSubject();
      const body = msg.getPlainBody().slice(0, 4000);

      const ai = _analyzeAndDraft(from, subject, body);

      const catLabel = _getOrCreateLabel('AI:' + ai.category);
      thread.addLabel(catLabel);

      const draftBody = ai.reply + '\n\n' + CONFIG.SIGNATURE;
      thread.createDraftReply(draftBody);

      thread.addLabel(doneLabel);
      done++;
      Utilities.sleep(400);
    } catch (e) {
      Logger.log('ERROR: ' + e.message);
    }
  }
  Logger.log(`下書き作成 ${done} 件`);
}

function _analyzeAndDraft(from, subject, body) {
  const prompt =
    CONFIG.REPLY_POLICY + '\n\n' +
    '次の問い合わせメールについて、JSONだけを返してください。前置きやコードブロックは不要です。\n' +
    'JSONの形式: {"category":"緊急|質問|要望|クレーム|その他のいずれか一語","reply":"返信本文（署名は付けない）"}\n\n' +
    `差出人: ${from}\n件名: ${subject}\n本文:\n${body}`;

  const raw = _askAI(prompt);
  const parsed = _safeJson(raw);
  return {
    category: (parsed && parsed.category) ? String(parsed.category).slice(0, 10) : '要確認',
    reply: (parsed && parsed.reply) ? String(parsed.reply)
                                    : '（AIの応答を解析できませんでした。手動で返信してください）'
  };
}

function _askAI(prompt) {
  if (!CONFIG.API_KEY || CONFIG.API_KEY.indexOf('sk-') !== 0) {
    throw new Error('APIキーが未設定です。CONFIG.API_KEY を設定してください。');
  }
  const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.API_KEY },
    payload: JSON.stringify({
      model: CONFIG.MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = JSON.parse(res.getContentText() || '{}');
  if (code !== 200) throw new Error((body.error && body.error.message) || ('HTTP ' + code));
  return body.choices[0].message.content.trim();
}

function _safeJson(raw) {
  try { return JSON.parse(raw); } catch (e) {}
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
  return null;
}

function _getOrCreateLabel(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
