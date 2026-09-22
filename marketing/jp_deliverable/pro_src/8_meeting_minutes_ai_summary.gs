/**
 * 議事録AI自動要約（要点・決定事項・TODO）＋自動メール — PRO追加スクリプト③
 * 会議の文字起こし/メモを1件貼るだけで、AIが「要点・決定事項・TODO」に整形し、
 * 参加者へメール送信までする。
 *
 * 導入手順：
 *  1) スプレッドシートに「議事録」という名前のシートを作る
 *     列：A生の文字起こし/メモ / B要約結果(AIが書く) / C送信先メールアドレス(空なら送信しない)
 *  2) 「拡張機能」→「Apps Script」に、このファイルの中身だけを貼る（自己完結）
 *  3) 下の CONFIG を設定
 *  4) A列に会議メモ、C列に送信先を入れてから、メニュー「議事録AI」→
 *     「選択行を要約してメール送信」を実行（初回は権限承認が必要）
 *
 * 安全メモ：「事実だけを使う」「不明な項目は未定と書く」を指示に入れて、
 *          AIが担当者や期限を勝手に作文しないようにしている。
 */

const CONFIG = {
  API_KEY: 'ここにOpenAI APIキー(sk-...)',   // ← ここだけ変更
  MODEL: 'gpt-4o-mini',
  SHEET_NAME: '議事録',
  TRANSCRIPT_COL: 1,
  SUMMARY_COL: 2,
  MAIL_TO_COL: 3,
  START_ROW: 2,
  MAX_ROWS: 50,
  SUBJECT_PREFIX: '【議事録まとめ】',
  INSTRUCTION:
    '以下は会議の文字起こしまたはメモです。事実だけを使い、憶測や創作は書かないでください。' +
    '次の3つの見出しで日本語にまとめてください。' +
    '# 要点（3つまで、箇条書き）\n# 決定事項（箇条書き。決定がなければ「決定事項なし」と書く）\n' +
    '# TODO（「担当者名 - やること - 期限」の形式で箇条書き。担当者や期限が本文に無い項目は「未定」と書く）'
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('議事録AI')
    .addItem('選択行を要約してメール送信', 'summarizeMinutes')
    .addToUi();
}

function summarizeMinutes() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) { throw new Error('シートが見つかりません: ' + CONFIG.SHEET_NAME); }

  const last = Math.min(sheet.getLastRow(), CONFIG.START_ROW + CONFIG.MAX_ROWS - 1);
  if (last < CONFIG.START_ROW) { _toast('対象行がありません'); return; }

  let done = 0, skipped = 0;
  for (let row = CONFIG.START_ROW; row <= last; row++) {
    const transcript = sheet.getRange(row, CONFIG.TRANSCRIPT_COL).getValue();
    const existing = sheet.getRange(row, CONFIG.SUMMARY_COL).getValue();
    if (!transcript || existing) { skipped++; continue; }

    try {
      const summary = askAI(CONFIG.INSTRUCTION + '\n\n---\n' + String(transcript).slice(0, 8000));
      sheet.getRange(row, CONFIG.SUMMARY_COL).setValue(summary);

      const mailTo = sheet.getRange(row, CONFIG.MAIL_TO_COL).getValue();
      if (mailTo) {
        MailApp.sendEmail(String(mailTo), CONFIG.SUBJECT_PREFIX + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'), summary + '\n\n---\n（このメールは自動送信です。内容に誤りがあれば会議メモ原本を確認してください）');
      }
      done++;
    } catch (e) {
      sheet.getRange(row, CONFIG.SUMMARY_COL).setValue('ERROR: ' + e.message);
    }
  }
  _toast(`完了：処理 ${done} 件 / スキップ ${skipped} 件`);
}

function askAI(prompt) {
  if (!CONFIG.API_KEY || CONFIG.API_KEY.indexOf('sk-') !== 0) {
    throw new Error('APIキーが未設定です。CONFIG.API_KEY を設定してください。');
  }
  const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + CONFIG.API_KEY },
    payload: JSON.stringify({
      model: CONFIG.MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0
    }),
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  const body = JSON.parse(res.getContentText() || '{}');
  if (code !== 200) throw new Error((body.error && body.error.message) || ('HTTP ' + code));
  return body.choices[0].message.content.trim();
}

function _toast(msg) { SpreadsheetApp.getActiveSpreadsheet().toast(msg, '議事録AI', 5); }
