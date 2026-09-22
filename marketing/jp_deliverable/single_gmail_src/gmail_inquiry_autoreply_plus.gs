/**
 * Gmail問い合わせ 自動仕分け＆下書き返信【拡張版】
 * Zenn記事版のスクリプトに、次の3機能を追加したものです。
 *   (1) FAQ参照：営業時間・料金・キャンセル規定などを CONFIG.FAQ に書いておくと、
 *       AIはそこに書かれた事実だけを使って回答する（書いていない事実は「確認して折り返します」）
 *   (2) 除外送信元：noreply・請求通知・メルマガなど、返信不要な送信元をスキップ
 *   (3) お試しモード：DRY_RUN=true の間は下書きもラベルも作らず、ログに結果だけ出す
 *
 * 導入手順（詳しくは 01_setup_guide_ja.txt）：
 *  1) Gmail側で、対応したいメールに付くラベルを1つ用意する（例：「問い合わせ」）
 *  2) script.google.com で新規プロジェクトを作り、このファイルの中身だけを貼る
 *  3) 下の CONFIG を自社向けに設定（まずは DRY_RUN: true のまま）
 *  4) processInquiries を手動実行 → 「実行ログ」で分類と返信案を確認（初回は権限承認が必要）
 *  5) 問題なければ DRY_RUN: false にして、トリガー（時間主導型・1時間おき など）を設定
 *
 * 安全メモ：下書きを作るだけで、自動送信は一切しない。送信は必ず人間が確認してから。
 */

const CONFIG = {
  API_KEY: 'ここにOpenAI APIキー(sk-...)',   // ← ここだけは必ず変更
  MODEL: 'gpt-4o-mini',
  SOURCE_LABEL: '問い合わせ',                   // この未読スレッドだけを対象にする
  DONE_LABEL: 'AI下書き済',                     // 処理済みに付けるラベル（自動作成）
  SKIPPED_LABEL: 'AI対象外',                    // 除外送信元に付けるラベル（自動作成）
  MAX_THREADS: 20,                             // 一度に処理する最大スレッド数（暴走防止）
  DRY_RUN: true,                               // true の間はログ出力のみ。確認できたら false に
  SIGNATURE: '——\n山田太郎 / 〇〇商店\ninfo@example.com',  // 下書き末尾に付ける署名

  // 返信の方針。業種別の例は 02_reply_policy_templates_ja.txt からコピーして差し替え可。
  REPLY_POLICY: 'あなたは丁寧で簡潔な日本語のカスタマーサポート担当です。相手の名前が分かれば宛名を付け、要件を1文で受け止めてから回答します。過度な謝罪や誇張はしません。',

  // AIが回答に使ってよい「確定した事実」。ここに無い事実は断定させません。
  FAQ: [
    '営業時間：平日10:00〜18:00（土日祝休み）',
    'お問い合わせへの返信：原則1営業日以内',
    // '料金：〇〇プラン 月額3,300円（税込）',
    // 'キャンセル：ご利用日の2日前まで無料',
  ],

  // 返信不要な送信元（部分一致・大文字小文字無視）。該当スレッドは SKIPPED_LABEL を付けて飛ばす。
  SKIP_SENDERS: ['noreply', 'no-reply', 'mailer-daemon', 'notification', 'newsletter'],
};

function processInquiries() {
  const doneLabel = _getOrCreateLabel(CONFIG.DONE_LABEL);
  const skippedLabel = _getOrCreateLabel(CONFIG.SKIPPED_LABEL);
  const query = `label:${CONFIG.SOURCE_LABEL} is:unread -label:${CONFIG.DONE_LABEL} -label:${CONFIG.SKIPPED_LABEL}`;
  const threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS);
  if (threads.length === 0) { Logger.log('対象スレッドなし'); return; }

  let drafted = 0, skipped = 0;
  for (const thread of threads) {
    try {
      const msg = thread.getMessages().pop();
      const from = msg.getFrom();
      const subject = msg.getSubject();

      if (_isSkippedSender(from)) {
        Logger.log(`[除外] ${from} / ${subject}`);
        if (!CONFIG.DRY_RUN) thread.addLabel(skippedLabel);
        skipped++;
        continue;
      }

      const body = msg.getPlainBody().slice(0, 4000);
      const ai = _analyzeAndDraft(from, subject, body);

      if (CONFIG.DRY_RUN) {
        Logger.log(`[お試し] ${subject}\n分類: ${ai.category}\n返信案:\n${ai.reply}\n`);
        continue;
      }

      thread.addLabel(_getOrCreateLabel('AI:' + ai.category));
      thread.createDraftReply(ai.reply + '\n\n' + CONFIG.SIGNATURE);
      thread.addLabel(doneLabel);
      drafted++;
      Utilities.sleep(400);
    } catch (e) {
      Logger.log('ERROR: ' + e.message);  // 失敗したスレッドは処理済みにしないので、次回また拾われる
    }
  }
  Logger.log(`下書き作成 ${drafted} 件 / 除外 ${skipped} 件` + (CONFIG.DRY_RUN ? '（お試しモード：何も作成していません）' : ''));
}

function _isSkippedSender(from) {
  const f = String(from).toLowerCase();
  return CONFIG.SKIP_SENDERS.some(s => f.indexOf(String(s).toLowerCase()) !== -1);
}

function _analyzeAndDraft(from, subject, body) {
  const facts = CONFIG.FAQ.length
    ? '回答に使ってよい確定事実（これ以外の在庫・価格・日程・規定などは断定せず「確認して折り返します」と書く）:\n- ' + CONFIG.FAQ.join('\n- ')
    : '在庫・価格・日程・規定などの事実は断定せず「確認して折り返します」と書く。';
  const prompt =
    CONFIG.REPLY_POLICY + '\n' + facts + '\n\n' +
    '次の問い合わせメールについて、JSONだけを返してください。前置きやコードブロックは不要です。\n' +
    'JSONの形式: {"category":"緊急|質問|要望|クレーム|その他のいずれか一語","reply":"返信本文（署名は付けない）"}\n\n' +
    `差出人: ${from}\n件名: ${subject}\n本文:\n${body}`;

  const parsed = _safeJson(_askAI(prompt));
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
