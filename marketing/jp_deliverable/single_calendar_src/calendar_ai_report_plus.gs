/**
 * Googleカレンダー → AI日報・週報の下書き【拡張版】
 *
 * スプレッドシートに紐づけて使います（拡張機能 → Apps Script に貼り付け）。
 * - 複数カレンダー（自分＋チームの共有カレンダー）をまとめて集計
 * - 「分類ルール」シートのキーワードで予定を顧客・案件ごとに分類し、分類別の時間をコードで集計
 * - 毎日の予定を「稼働ログ」シートに記録（同じ日を再実行しても重複しない）
 * - 週の最終営業日は週報の下書きも作成 / 月次の分類別集計シート（請求・工数管理用）
 * - 土日・祝日・辞退した予定は除外、説明欄の個人情報（メール・電話・郵便番号）を伏せ字
 * - 送信はしない（Gmailの下書きに置くだけ）。同じ件名の下書きがあれば作り直さない
 * - AIが失敗しても事実だけの下書きは必ず作る。DRY_RUN中は下書きを作らず内容をログに出す
 *   （稼働ログシートへの記録は DRY_RUN 中も行います）
 *
 * 数字（時間・件数）はすべてコードで計算し、AIには文章化だけを頼みます。
 */
const CONFIG = {
  MODEL: 'gpt-4o-mini',
  REPORT_TO: 'boss@example.com',           // 下書きの宛先（送信はしない）
  CC: '',                                  // 例: 'team@example.com'
  CALENDAR_IDS: ['primary'],               // 'primary' = 自分のカレンダー。共有カレンダーIDを追加可
  EXCLUDE_WORDS: ['私用', '休憩', 'ランチ'],  // タイトルにこれを含む予定は載せない
  MAX_DESC_CHARS: 200,                     // 説明欄をAIに渡す文字数。0 で説明欄を送らない
  SKIP_HOLIDAYS: true,                     // 日本の祝日は作らない
  HOLIDAY_CALENDAR_ID: 'ja.japanese#holiday@group.v.calendar.google.com',
  DAILY_HOUR: 18,                          // 毎日この時台に作成
  WEEKLY_REPORT: true,                     // 週の最終営業日に週報も作る
  DRY_RUN: true                            // 最初は true。ログで中身を確認してから false に
};

const RULE_SHEET = '分類ルール';
const LOG_SHEET = '稼働ログ';
const MONTH_SHEET = '月次集計';
const LOG_HEADER = ['日付', '開始', '終了', '分', '分類', '予定名', 'カレンダー', 'キー'];
const OTHER = 'その他';

// ---------------------------------------------------------------- メニュー・初期設定

function onOpen() {
  SpreadsheetApp.getUi().createMenu('日報AI')
    .addItem('初期設定（シートとトリガー作成）', 'setupReport')
    .addItem('今日の日報を作る', 'createDailyReport')
    .addItem('今週の週報を作る', 'createWeeklyReport')
    .addItem('今月の分類別集計', 'summarizeThisMonth')
    .addItem('先月の分類別集計', 'summarizeLastMonth')
    .addToUi();
}

function setupReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(RULE_SHEET)) {
    const sh = ss.insertSheet(RULE_SHEET);
    sh.getRange(1, 1, 4, 2).setValues([
      ['キーワード（タイトルに含む）', '分類'],
      ['A社', 'A社案件'],
      ['定例', '社内会議'],
      ['採用', '採用']
    ]);
  }
  if (!ss.getSheetByName(LOG_SHEET)) {
    ss.insertSheet(LOG_SHEET).getRange(1, 1, 1, LOG_HEADER.length).setValues([LOG_HEADER]);
  }
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'dailyJob')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyJob').timeBased().everyDays(1).atHour(CONFIG.DAILY_HOUR).create();
  log_('初期設定が完了しました。「分類ルール」シートを自分の顧客・案件名に書き換えてください。');
}

// ---------------------------------------------------------------- 毎日のジョブ

/** トリガーから毎日呼ばれる。営業日なら日報、週の最終営業日なら週報も */
function dailyJob(now) {
  now = now instanceof Date ? now : new Date();
  if (!isWorkday_(now)) return;
  createDailyReport(now);
  if (CONFIG.WEEKLY_REPORT && isLastWorkdayOfWeek_(now)) createWeeklyReport(now);
}

function createDailyReport(now) {
  now = now instanceof Date ? now : new Date();
  const rules = loadRules_();
  const today = collectEvents_(now, rules);
  writeLog_(ymd_(now), today);                    // 予定ゼロでも「その日の行を消す」ために呼ぶ
  if (today.length === 0) { log_('予定がないため日報は作りません: ' + ymd_(now)); return; }

  const next = nextWorkday_(now);
  const tomorrow = collectEvents_(next, rules);
  const facts = dailyFacts_(today, tomorrow, next);
  const subject = '日報 ' + fmt_(now, 'yyyy/MM/dd');
  const system = [
    'あなたは社内日報の下書きを書くアシスタントです。',
    '与えられた「事実」だけを使い、書かれていない成果・数字・人名を足さないこと。',
    '時刻・時間・件数は事実の数字をそのまま使い、計算し直さないこと。',
    '構成: 「本日の業務」（分類ごとの箇条書き）、「合計時間」、「明日の予定」、最後に「所感: （ここに一言）」の空欄。',
    '丁寧すぎない社内向けの敬語で、全体500字以内。'
  ].join('\n');
  const body = askAI_(system, facts) || fallback_('本日の日報', facts);
  saveDraft_(subject, body);
}

function createWeeklyReport(now) {
  now = now instanceof Date ? now : new Date();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
  const rows = readLog_(ymd_(monday), ymd_(now));
  if (rows.length === 0) { log_('今週の稼働ログがないため週報は作りません'); return; }
  const facts = periodFacts_(rows, '今週（' + fmt_(monday, 'M/d') + '〜' + fmt_(now, 'M/d') + '）');
  const subject = '週報 ' + fmt_(monday, 'yyyy/MM/dd') + '週';
  const system = [
    'あなたは社内週報の下書きを書くアシスタントです。',
    '与えられた「事実」だけを使い、書かれていない成果・数字・人名を足さないこと。',
    '時間・件数は事実の数字をそのまま使い、計算し直さないこと。',
    '構成: 「今週の概要」（2〜3行）、「分類別の稼働」（箇条書き）、「主な予定」、最後に「来週の課題: （ここに記入）」の空欄。',
    '社内向けの敬語で、全体600字以内。'
  ].join('\n');
  const body = askAI_(system, facts) || fallback_('今週の週報', facts);
  saveDraft_(subject, body);
}

// ---------------------------------------------------------------- 月次集計（AIは使わない）

function summarizeThisMonth(now) { return summarizeMonth_(now instanceof Date ? now : new Date(), 0); }
function summarizeLastMonth(now) { return summarizeMonth_(now instanceof Date ? now : new Date(), -1); }

function summarizeMonth_(now, offset) {
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  const rows = readLog_(ymd_(first), ymd_(last));
  const s = summarize_(rows);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(MONTH_SHEET) || ss.insertSheet(MONTH_SHEET);
  sh.clear();
  const out = [[fmt_(first, 'yyyy年M月') + ' 分類別集計', '', ''], ['分類', '時間(h)', '件数']];
  s.categories.forEach(c => out.push([c.name, round1_(c.minutes / 60), c.count]));
  out.push(['合計（重複を除く）', round1_(s.totalMinutes / 60), s.count]);
  out.push(['稼働日数', s.days, '']);
  sh.getRange(1, 1, out.length, 3).setValues(out);
  log_(fmt_(first, 'yyyy年M月') + ' の集計を「' + MONTH_SHEET + '」に書き出しました（' + s.count + '件）');
  return out;
}

// ---------------------------------------------------------------- 予定の収集

function collectEvents_(date, rules) {
  const seen = {};
  const items = [];
  CONFIG.CALENDAR_IDS.forEach(id => {
    const cal = id === 'primary' ? CalendarApp.getDefaultCalendar() : CalendarApp.getCalendarById(id);
    if (!cal) { log_('カレンダーが見つかりません: ' + id); return; }
    cal.getEventsForDay(date).forEach(e => {
      const title = e.getTitle();
      if (CONFIG.EXCLUDE_WORDS.some(w => title.indexOf(w) !== -1)) return;
      if (isDeclined_(e)) return;
      const allDay = e.isAllDayEvent();
      // 日をまたぐ予定は、その日の0:00〜24:00の範囲だけを数える
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      const start = new Date(Math.max(e.getStartTime().getTime(), dayStart.getTime()));
      const end = new Date(Math.min(e.getEndTime().getTime(), dayEnd.getTime() - 60000));
      const key = ymd_(date) + '|' + e.getId() + '|' + (allDay ? 'allday' : start.getTime());
      if (seen[key]) return;                       // 複数カレンダーに同じ予定がある場合は1回だけ
      seen[key] = true;
      items.push({
        key: key, calendar: cal.getName(), title: title, allDay: allDay,
        start: start, end: end,
        minutes: allDay ? 0 : Math.round((end - start) / 60000),
        category: categorize_(title, rules),
        desc: CONFIG.MAX_DESC_CHARS > 0 ? cleanDesc_(e.getDescription()) : ''
      });
    });
  });
  return items.sort((a, b) => a.start - b.start);
}

function isDeclined_(e) {
  try { return String(e.getMyStatus()) === 'NO'; } catch (err) { return false; }
}

function loadRules_() {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(RULE_SHEET);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1)
    .filter(r => String(r[0]).trim() && String(r[1]).trim())
    .map(r => ({ word: String(r[0]).trim(), category: String(r[1]).trim() }));
}

/** 上の行から順に見て、最初に当てはまった分類。どれにも当たらなければ「その他」 */
function categorize_(title, rules) {
  const hit = rules.find(r => title.indexOf(r.word) !== -1);
  return hit ? hit.category : OTHER;
}

function cleanDesc_(desc) {
  return maskPII_(String(desc || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, CONFIG.MAX_DESC_CHARS);
}

function maskPII_(s) {
  return s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[メール]')
    .replace(/\b0\d{1,4}-\d{1,4}-\d{3,4}\b|\b0\d{9,10}\b/g, '[電話]')
    .replace(/〒\s?\d{3}-?\d{4}|\b\d{3}-\d{4}\b/g, '[郵便番号]');
}

// ---------------------------------------------------------------- 稼働ログ

/** その日の行をいったん消してから書き直す（再実行・予定変更でも重複しない） */
function writeLog_(day, items) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET);
  if (!sh) return;
  const values = sh.getDataRange().getValues();
  for (let r = values.length - 1; r >= 1; r--) {
    if (cellYmd_(values[r][0]) === day) sh.deleteRow(r + 1);
  }
  const rows = items.filter(i => !i.allDay).map(i =>
    [day, fmt_(i.start, 'HH:mm'), fmt_(i.end, 'HH:mm'), i.minutes, i.category, i.title, i.calendar, i.key]);
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function readLog_(fromYmd, toYmd) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LOG_SHEET);
  if (!sh) return [];
  return sh.getDataRange().getValues().slice(1)
    .map(r => ({ day: cellYmd_(r[0]), start: cellHm_(r[1]), end: cellHm_(r[2]),
                 minutes: Number(r[3]) || 0, category: String(r[4] || OTHER), title: String(r[5] || '') }))
    .filter(r => r.day && r.day >= fromYmd && r.day <= toYmd);
}

// ---------------------------------------------------------------- 集計（すべてコード）

/** 時間帯 [開始分, 終了分] の配列を、重なりを除いて合計する */
function mergedMinutes_(ranges) {
  const rs = ranges.filter(r => r[1] > r[0]).sort((a, b) => a[0] - b[0]);
  let total = 0, s = null, e = null;
  rs.forEach(r => {
    if (e === null || r[0] > e) { if (e !== null) total += e - s; s = r[0]; e = r[1]; }
    else if (r[1] > e) e = r[1];
  });
  if (e !== null) total += e - s;
  return total;
}

/** 稼働ログの行 → 分類別の時間（分類ごとに重複除去）・全体の時間（全体で重複除去）・件数・日数 */
function summarize_(rows) {
  const byDay = {}, byCat = {};
  rows.forEach(r => {
    const rg = [hmToMin_(r.start), hmToMin_(r.end)];
    (byDay[r.day] = byDay[r.day] || []).push(rg);
    const c = byCat[r.category] = byCat[r.category] || { name: r.category, days: {}, count: 0, titles: {} };
    (c.days[r.day] = c.days[r.day] || []).push(rg);
    c.count++;
    c.titles[r.title] = (c.titles[r.title] || 0) + 1;
  });
  const categories = Object.keys(byCat).map(k => {
    const c = byCat[k];
    const minutes = Object.keys(c.days).reduce((t, d) => t + mergedMinutes_(c.days[d]), 0);
    return { name: c.name, minutes: minutes, count: c.count, titles: c.titles };
  }).sort((a, b) => b.minutes - a.minutes);
  const totalMinutes = Object.keys(byDay).reduce((t, d) => t + mergedMinutes_(byDay[d]), 0);
  return { categories: categories, totalMinutes: totalMinutes, count: rows.length, days: Object.keys(byDay).length };
}

function dailyFacts_(today, tomorrow, nextDate) {
  const timed = today.filter(i => !i.allDay);
  const s = summarize_(timed.map(i => ({ day: 'd', start: fmt_(i.start, 'HH:mm'), end: fmt_(i.end, 'HH:mm'),
                                         category: i.category, title: i.title })));
  const line = i => i.allDay ? '- 終日: ' + i.title
    : '- ' + fmt_(i.start, 'HH:mm') + '-' + fmt_(i.end, 'HH:mm') + '（' + dur_(i.minutes) + '）[' + i.category + '] ' +
      i.title + (i.desc ? ' ／メモ: ' + i.desc : '');
  return [
    '【今日の予定】', today.map(line).join('\n'),
    '【分類別の時間】', s.categories.map(c => '- ' + c.name + ': ' + dur_(c.minutes)).join('\n') || '- なし',
    '【予定の合計時間（重複を除く）】' + dur_(s.totalMinutes),
    '【次の営業日（' + fmt_(nextDate, 'M/d') + '）の予定】',
    tomorrow.length ? tomorrow.map(i => i.allDay ? '- 終日: ' + i.title : '- ' + fmt_(i.start, 'HH:mm') + ' ' + i.title).join('\n')
                    : '- 予定なし'
  ].join('\n');
}

function periodFacts_(rows, label) {
  const s = summarize_(rows);
  const top = c => Object.keys(c.titles).sort((a, b) => c.titles[b] - c.titles[a]).slice(0, 5)
    .map(t => t + (c.titles[t] > 1 ? '×' + c.titles[t] : '')).join('、');
  return [
    '【期間】' + label + '・稼働日数 ' + s.days + '日・予定 ' + s.count + '件',
    '【合計時間（重複を除く）】' + dur_(s.totalMinutes),
    '【分類別】', s.categories.map(c => '- ' + c.name + ': ' + dur_(c.minutes) + '（' + c.count + '件）: ' + top(c)).join('\n')
  ].join('\n');
}

// ---------------------------------------------------------------- AI・下書き

function askAI_(system, facts) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) { log_('OPENAI_API_KEY が未設定のため、事実だけの下書きにします'); return null; }
  const payload = { model: CONFIG.MODEL, temperature: 0.3,
    messages: [{ role: 'system', content: system }, { role: 'user', content: facts }] };
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code === 200) {
      try { return JSON.parse(res.getContentText()).choices[0].message.content.trim(); }
      catch (err) { return null; }
    }
    if (code === 429 || code >= 500) { Utilities.sleep(1000 * Math.pow(2, attempt)); continue; }
    log_('AI呼び出し失敗: HTTP ' + code);
    return null;
  }
  return null;
}

function fallback_(label, facts) {
  return 'お疲れさまです。' + label + 'です（AI整形なし・予定一覧のみ）。\n\n' + facts + '\n\n所感: ';
}

function saveDraft_(subject, body) {
  if (CONFIG.DRY_RUN) { log_('[DRY_RUN] 下書き「' + subject + '」\n' + body); return 'dry'; }
  const exists = GmailApp.getDrafts().some(d => d.getMessage().getSubject() === subject);
  if (exists) { log_('同じ件名の下書きがあるため作りません: ' + subject); return 'skip'; }
  const opt = CONFIG.CC ? { cc: CONFIG.CC } : {};
  GmailApp.createDraft(CONFIG.REPORT_TO, subject, body, opt);
  return 'created';
}

// ---------------------------------------------------------------- 日付の小道具

function isWorkday_(d) {
  if (d.getDay() === 0 || d.getDay() === 6) return false;
  if (!CONFIG.SKIP_HOLIDAYS) return true;
  try {
    const hol = CalendarApp.getCalendarById(CONFIG.HOLIDAY_CALENDAR_ID);
    return !(hol && hol.getEventsForDay(d).length > 0);
  } catch (err) { return true; }
}

function nextWorkday_(d) {
  const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  for (let i = 0; i < 14 && !isWorkday_(n); i++) n.setDate(n.getDate() + 1);
  return n;
}

/** 次の営業日が来週（月曜起点）なら、今日が今週最後の営業日 */
function isLastWorkdayOfWeek_(d) {
  const n = nextWorkday_(d);
  const monday = x => new Date(x.getFullYear(), x.getMonth(), x.getDate() - ((x.getDay() + 6) % 7)).getTime();
  return monday(n) !== monday(d);
}

function fmt_(d, p) { return Utilities.formatDate(d, Session.getScriptTimeZone(), p); }
function ymd_(d) { return fmt_(d, 'yyyy-MM-dd'); }
function cellYmd_(v) { return v instanceof Date ? ymd_(v) : String(v || '').trim(); }
function cellHm_(v) { return v instanceof Date ? fmt_(v, 'HH:mm') : String(v || '').trim(); }
function hmToMin_(hm) { const p = String(hm).split(':'); return Number(p[0]) * 60 + Number(p[1] || 0); }
function dur_(min) { return Math.floor(min / 60) + '時間' + (min % 60 ? (min % 60) + '分' : ''); }
function round1_(x) { return Math.round(x * 10) / 10; }
function log_(msg) { console.log(msg); }
