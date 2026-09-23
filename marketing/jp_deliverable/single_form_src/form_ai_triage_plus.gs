/**
 * Googleフォーム問い合わせ AI仕分け＆担当者通知【拡張版】
 * フォームに届いた問い合わせを、AIが「種別・緊急度・要約」に仕分けて回答シートに書き込み、
 * 種別ごとの担当者へ通知する。お客様への返信はAIに書かせない（社内向けの仕分けだけ）。
 *
 * Zenn記事版からの追加点
 *  (1) 種別と通知先を「仕分け設定」シートで管理：コードを触らずに種別の追加・変更ができる。
 *      通知先を空欄にした種別（例：営業・スパム）は、記録だけして通知しない。
 *  (2) 個人情報のマスク：メールアドレス・電話番号・郵便番号を伏せ字にしてからAIへ送る。
 *  (3) 緊急度「高」はエスカレーション先にも同時通知。Googleチャット（Webhook）にも通知可。
 *  (4) 対応状況の列（未対応／対応中／完了／対象外のプルダウン）と、未対応のまま放置された
 *      緊急度「高」の問い合わせのリマインド。
 *  (5) 毎朝の日次まとめ：前日分の件数を種別・緊急度ごとに集計して1通で届ける。
 *  (6) 過去分の一括仕分け：導入前に届いていた回答もまとめて仕分け（6分制限の手前で止まり、続きから再開）。
 *  (7) API混雑（429/5xx）時の自動リトライ。失敗しても「その他・中」で必ず通知＝取りこぼしなし。
 *  (8) お試しモード：DRY_RUN=true の間はメールもチャットも送らず、ログに出すだけ。
 *
 * 安全メモ：AIが書くのは社内向けの種別・緊急度・要約だけ。お客様へは何も送らない。
 *          判定は必ず本文で確認する前提（通知メールに本文をそのまま付ける）。
 */

const CONFIG = {
  API_KEY: 'ここにOpenAI APIキー(sk-...)',   // ← 必ず変更
  MODEL: 'gpt-4o-mini',
  SHEET_NAME: 'フォームの回答 1',             // 回答シート名（初期値のままならこれ）
  BODY_FIELDS: ['お問い合わせ内容'],          // 本文にする質問タイトル（複数可。順につなげてAIに渡す）
  NAME_FIELD: 'お名前',                       // 無ければ ''
  EMAIL_FIELD: 'メールアドレス',              // 無ければ ''（通知メールの Reply-To に使う）
  DEFAULT_TO: 'info@example.com',             // 設定シートに通知先が無い種別の送り先
  ESCALATION_TO: 'manager@example.com',       // 緊急度「高」のとき追加で送る先（不要なら ''）
  CHAT_WEBHOOK_URL: '',                       // GoogleチャットのWebhook URL（不要なら ''）
  DIGEST_TO: 'info@example.com',              // 日次まとめの送り先（不要なら ''）
  REMIND_HOURS: 4,                            // 緊急度「高」が何時間「未対応」ならリマインドするか
  MASK_PII: true,                             // AIに送る前にメール・電話・郵便番号を伏せる
  SETTINGS_SHEET: '仕分け設定',
  DRY_RUN: true                               // 最初は true。ログで確認してから false に
};

const URGENCY = ['高', '中', '低'];
const STATUS_LIST = ['未対応', '対応中', '完了', '対象外'];
const AI_HEADERS = ['AI種別', 'AI緊急度', 'AI要約', '対応状況', '通知日時'];
const DEFAULT_ROUTES = [
  ['種別', '通知先（カンマ区切り。空欄=通知しない）', 'AIへの説明（どんな問い合わせをこの種別にするか）'],
  ['見積もり', 'sales@example.com', '料金・見積もり・発注の相談'],
  ['不具合・クレーム', 'support@example.com', '不具合、使えない、届かない、対応への不満'],
  ['予約・日程', 'desk@example.com', '予約、日程の変更・キャンセル、来店・訪問の調整'],
  ['営業・スパム', '', '売り込み、広告、無関係な宣伝、意味のない文字列'],
  ['その他', '', '上のどれにも当てはまらないもの（通知先が空欄なら DEFAULT_TO へ）']
];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('AI仕分け')
    .addItem('初期設定（設定シート・列・トリガー）', 'setupTriage')
    .addItem('AI判定だけ試す', 'testClassify')
    .addItem('未仕分けの過去分を一括仕分け', 'triageUnprocessedRows')
    .addItem('日次まとめを今すぐ送る', 'sendDailyDigest')
    .addToUi();
}

// ---------- 初期設定 ----------
function setupTriage() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(CONFIG.SETTINGS_SHEET)) {
    const s = ss.insertSheet(CONFIG.SETTINGS_SHEET);
    s.getRange(1, 1, DEFAULT_ROUTES.length, 3).setValues(DEFAULT_ROUTES);
  }
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('回答シート「' + CONFIG.SHEET_NAME + '」が見つかりません。CONFIG.SHEET_NAME を確認してください');
  aiColumns_(sheet);

  const have = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  if (have.indexOf('onFormSubmitTriage') < 0) ScriptApp.newTrigger('onFormSubmitTriage').forSpreadsheet(ss).onFormSubmit().create();
  if (have.indexOf('remindOverdue') < 0) ScriptApp.newTrigger('remindOverdue').timeBased().everyHours(1).create();
  if (have.indexOf('sendDailyDigest') < 0 && CONFIG.DIGEST_TO) ScriptApp.newTrigger('sendDailyDigest').timeBased().everyDays(1).atHour(8).create();
  console.log('初期設定が完了しました（DRY_RUN=' + CONFIG.DRY_RUN + '）');
}

// 見出しから AI列の位置を探し、無ければ右端に追加。{AI種別: 列番号, ...} を返す
function aiColumns_(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  let start = headers.indexOf(AI_HEADERS[0]) + 1;
  if (start === 0) {
    start = lastCol + 1;
    sheet.getRange(1, start, 1, AI_HEADERS.length).setValues([AI_HEADERS]);
    const rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUS_LIST, true).build();
    sheet.getRange(2, start + 3, Math.max(sheet.getMaxRows() - 1, 1), 1).setDataValidation(rule);
  }
  const cols = {};
  AI_HEADERS.forEach(function (h, i) { cols[h] = start + i; });
  return cols;
}

// 「仕分け設定」シートから [{name, to, desc}] を読む（空行は無視。「その他」は必ず含める）
function loadRoutes_() {
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SETTINGS_SHEET);
  const rows = s ? s.getDataRange().getValues().slice(1) : DEFAULT_ROUTES.slice(1);
  const routes = rows
    .filter(function (r) { return String(r[0] || '').trim(); })
    .map(function (r) { return { name: String(r[0]).trim(), to: String(r[1] || '').trim(), desc: String(r[2] || '').trim() }; });
  if (!routes.some(function (r) { return r.name === 'その他'; })) routes.push({ name: 'その他', to: '', desc: '' });
  return routes;
}

// ---------- フォーム送信時（トリガー） ----------
function onFormSubmitTriage(e) {
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_NAME) return;
  triageRow_(sheet, e.range.getRow(), e.namedValues || {}, loadRoutes_(), aiColumns_(sheet));
}

function triageRow_(sheet, row, named, routes, cols) {
  const pick = function (f) { return f ? String((named[f] || [''])[0] || '').trim() : ''; };
  const body = CONFIG.BODY_FIELDS.map(pick).filter(String).join('\n\n');
  if (!body) return null;

  const r = classify_(body, routes);
  sheet.getRange(row, cols['AI種別'], 1, 3).setValues([[r.category, r.urgency, r.summary]]);
  const sent = notify_(r, pick(CONFIG.NAME_FIELD), pick(CONFIG.EMAIL_FIELD), body, routes, sheet.getParent().getUrl());
  const statusCell = sheet.getRange(row, cols['対応状況']);
  if (!statusCell.getValue()) statusCell.setValue(sent ? '未対応' : '対象外');  // 通知しない種別はリマインド対象外
  sheet.getRange(row, cols['通知日時']).setValue(sent ? new Date() : '通知なし');
  return r;
}

// ---------- AI判定 ----------
function maskPii_(text) {
  if (!CONFIG.MASK_PII) return text;
  return text
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[メール]')
    .replace(/0\d{1,4}-?\d{1,4}-?\d{3,4}/g, '[電話]')
    .replace(/〒?\d{3}-\d{4}/g, '[郵便番号]');
}

function classify_(body, routes) {
  const names = routes.map(function (r) { return r.name; });
  const guide = routes.map(function (r) { return '・' + r.name + (r.desc ? '：' + r.desc : ''); }).join('\n');
  const prompt =
    '次のお問い合わせ本文を社内向けに仕分けてください。本文に書かれた事実だけを使い、推測で補わないこと。\n' +
    '種別の定義:\n' + guide + '\n' +
    'JSONのみで答えてください: {"category": 次のどれか ' + JSON.stringify(names) +
    ', "urgency": 次のどれか ' + JSON.stringify(URGENCY) +
    ', "summary": "40字以内の日本語要約"}\n' +
    '緊急度の目安: 高=業務停止・強い不満・当日中の対応要求、中=数日内に対応、低=情報提供や質問のみ。\n\n' +
    '本文:\n' + maskPii_(body);

  const fallback = function (why) { return { category: 'その他', urgency: '中', summary: '（' + why + '）本文を確認してください' }; };
  const res = fetchWithRetry_('https://api.openai.com/v1/chat/completions', {
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
  if (!res || res.getResponseCode() !== 200) return fallback('AI判定失敗: HTTP ' + (res ? res.getResponseCode() : '接続不可'));
  try {
    const out = JSON.parse(JSON.parse(res.getContentText()).choices[0].message.content);
    return {
      category: names.indexOf(out.category) >= 0 ? out.category : 'その他',
      urgency: URGENCY.indexOf(out.urgency) >= 0 ? out.urgency : '中',
      summary: String(out.summary || '').replace(/\s+/g, ' ').slice(0, 80)
    };
  } catch (err) {
    return fallback('AI応答を解釈できませんでした');
  }
}

// 429（混雑）と5xxは 2秒→4秒→8秒 待って再試行。それ以外はそのまま返す
function fetchWithRetry_(url, opts) {
  let res = null;
  for (let i = 0; i < 4; i++) {
    try {
      res = UrlFetchApp.fetch(url, opts);
      const code = res.getResponseCode();
      if (code !== 429 && code < 500) return res;
    } catch (err) {
      res = null;
    }
    if (i < 3) Utilities.sleep(2000 * Math.pow(2, i));
  }
  return res;
}

// ---------- 通知 ----------
// 通知したら true。通知先が空欄の種別（営業・スパムなど）は記録だけで false
function notify_(r, name, email, body, routes, url) {
  const route = routes.filter(function (x) { return x.name === r.category; })[0];
  let to;
  if (route && route.name !== 'その他') {
    if (!route.to) return false;              // 通知先が空欄の種別（営業・スパムなど）は記録だけ
    to = route.to;
  } else {
    to = (route && route.to) || CONFIG.DEFAULT_TO;
  }
  if (r.urgency === '高' && CONFIG.ESCALATION_TO) to += ',' + CONFIG.ESCALATION_TO;

  const subject = (r.urgency === '高' ? '【至急】' : '') + '[' + r.category + '] ' + r.summary;
  const text =
    '新しい問い合わせが届きました（AIによる自動仕分け。判定は必ず本文で確認してください）\n\n' +
    '種別: ' + r.category + '\n緊急度: ' + r.urgency + '\n要約: ' + r.summary + '\n' +
    (name ? 'お名前: ' + name + '\n' : '') +
    '\n--- 本文 ---\n' + body + '\n\n回答シート: ' + url;

  if (CONFIG.DRY_RUN) {
    console.log('DRY_RUN to=' + to + '\n' + subject + '\n' + text);
    return true;
  }
  const opts = {};
  if (email && /^[^@\s]+@[^@\s]+$/.test(email)) opts.replyTo = email;
  MailApp.sendEmail(to, subject, text, opts);
  postChat_(subject + '\n' + url);
  return true;
}

function postChat_(text) {
  if (!CONFIG.CHAT_WEBHOOK_URL || CONFIG.DRY_RUN) return;
  UrlFetchApp.fetch(CONFIG.CHAT_WEBHOOK_URL, {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ text: text }), muteHttpExceptions: true
  });
}

// ---------- 過去分の一括仕分け ----------
// AI種別が空の行だけ処理。4分半で止まるので、残りがあればもう一度実行すれば続きから再開する
function triageUnprocessedRows() {
  const started = Date.now();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const cols = aiColumns_(sheet);
  const routes = loadRoutes_();
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  let done = 0, left = 0;
  for (let i = 1; i < values.length; i++) {
    if (String(values[i][cols['AI種別'] - 1] || '')) continue;
    if (Date.now() - started > 270000) { left++; continue; }
    const named = {};
    headers.forEach(function (h, j) { named[h] = [values[i][j]]; });
    if (triageRow_(sheet, i + 1, named, routes, cols)) done++;
  }
  console.log('仕分け ' + done + ' 件' + (left ? '／残り ' + left + ' 件（もう一度実行すると続きから）' : '／完了'));
  return { done: done, left: left };
}

// ---------- リマインド（1時間ごとのトリガー） ----------
function remindOverdue() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const cols = aiColumns_(sheet);
  const values = sheet.getDataRange().getValues();
  const props = PropertiesService.getScriptProperties();
  const now = Date.now();
  const hits = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const ts = row[0] instanceof Date ? row[0].getTime() : 0;  // A列 = タイムスタンプ
    if (row[cols['AI緊急度'] - 1] !== '高' || row[cols['対応状況'] - 1] !== '未対応' || !ts) continue;
    if (now - ts < CONFIG.REMIND_HOURS * 3600000) continue;
    const key = 'REMINDED_' + (i + 1) + '_' + ts;
    if (props.getProperty(key)) continue;   // 同じ問い合わせは1回だけリマインド
    hits.push({ key: key, line: (i + 1) + '行目 [' + row[cols['AI種別'] - 1] + '] ' + row[cols['AI要約'] - 1] });
  }
  if (!hits.length) return 0;
  const to = CONFIG.ESCALATION_TO || CONFIG.DEFAULT_TO;
  const subject = '【リマインド】緊急度「高」が' + CONFIG.REMIND_HOURS + '時間以上未対応です（' + hits.length + '件）';
  const text = hits.map(function (h) { return '・' + h.line; }).join('\n') +
    '\n\n対応を始めたら「対応状況」を「対応中」か「完了」に変えてください。\n' + sheet.getParent().getUrl();
  if (CONFIG.DRY_RUN) console.log('DRY_RUN to=' + to + '\n' + subject + '\n' + text);
  else MailApp.sendEmail(to, subject, text);
  hits.forEach(function (h) { props.setProperty(h.key, '1'); });
  return hits.length;
}

// ---------- 日次まとめ（毎朝8時台のトリガー） ----------
function sendDailyDigest() {
  if (!CONFIG.DIGEST_TO) return null;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEET_NAME);
  const cols = aiColumns_(sheet);
  const values = sheet.getDataRange().getValues().slice(1);
  const since = Date.now() - 24 * 3600000;
  const byCat = {}, byUrg = { '高': 0, '中': 0, '低': 0 };
  let total = 0, open = 0;
  values.forEach(function (row) {
    const ts = row[0] instanceof Date ? row[0].getTime() : 0;
    const cat = row[cols['AI種別'] - 1];
    if (ts < since || !cat) return;
    total++;
    byCat[cat] = (byCat[cat] || 0) + 1;
    if (byUrg[row[cols['AI緊急度'] - 1]] !== undefined) byUrg[row[cols['AI緊急度'] - 1]]++;
    if (row[cols['対応状況'] - 1] === '未対応') open++;
  });
  const subject = '【日次まとめ】問い合わせ ' + total + ' 件（うち未対応 ' + open + ' 件）';
  const text = '直近24時間の問い合わせ\n\n種別:\n' +
    Object.keys(byCat).map(function (k) { return '  ' + k + ': ' + byCat[k] + ' 件'; }).join('\n') +
    '\n\n緊急度: 高 ' + byUrg['高'] + ' / 中 ' + byUrg['中'] + ' / 低 ' + byUrg['低'] +
    '\n\n回答シート: ' + sheet.getParent().getUrl();
  if (CONFIG.DRY_RUN) console.log('DRY_RUN to=' + CONFIG.DIGEST_TO + '\n' + subject + '\n' + text);
  else MailApp.sendEmail(CONFIG.DIGEST_TO, subject, text);
  return { total: total, open: open, byCat: byCat, byUrg: byUrg };
}

// 動作確認用：トリガー設定の前に、AI判定だけ試せる
function testClassify() {
  const r = classify_('昨日納品いただいたシステムにログインできません。本日中に復旧をお願いします。連絡先 03-1234-5678', loadRoutes_());
  console.log(r);
  return r;
}
