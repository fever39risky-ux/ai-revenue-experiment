---
title: "議事録AI要約【拡張版】（TODO台帳＋期限リマインド）"
---

無料で読めるZenn記事版（[こちら](https://zenn.dev/kinoshita_ai/articles/gas-meeting-minutes-ai-summary)）の仕組みをベースに、実務で使うための機能を足した版です。

## 記事版からの追加点

```text
(1) 長い文字起こしも途中で切らない：自動で分割 → 分割ごとに要点メモ → 最後に1つへ統合
    （記事版は先頭8000字まで）
(2) TODOを「TODO」シートに1行ずつ台帳化。同じ議事録を再実行しても重複しません
(3) AIの出力をコードで検査：担当者名が文字起こしに出てこなければ「未定」に戻します。
    期限は本文に書かれた日付（10/3・10月3日・2026-10-03 など）だけを日付にし、
    「来週中」のような曖昧な表現から日付を作りません
(4) 毎朝、期限切れ・期限間近のTODOを担当者ごとにまとめてリマインド
    （「メンバー」シートに 担当者名 → メールアドレス を書くだけ）
(5) 共有は既定で「Gmailの下書き」。確認してから送れます（直接送信にも切り替え可）
(6) AIへ送る前にメールアドレス・電話番号・郵便番号を伏せ字
(7) API混雑時(429/5xx)の自動リトライ／6分の実行時間制限の手前で区切って次回に続き／
    お試しモード(DRY_RUN)／APIキーはコードに書かずスクリプト プロパティに保存
```

## 導入手順

必要なもの：Googleアカウント、OpenAI の APIキー（従量課金。gpt-4o-mini なら
1時間程度の会議1件で数円が目安）。ChatGPT の有料プランは不要です。

### 【1】スプレッドシートを用意する

新しいGoogleスプレッドシートを1つ作ります（名前は例：「議事録AI」）。

### 【2】スクリプトを貼る

シートの「拡張機能 → Apps Script」を開き、最初からあるコードを全部消して、
minutes_ai_plus.gs の中身を丸ごと貼り付け → 保存。

### 【3】APIキーを登録する

Apps Script 左の「プロジェクトの設定（歯車）」→「スクリプト プロパティ」→
プロパティ OPENAI_API_KEY、値に sk- で始まるキーを追加。
（キーをコードに直接書かないので、シートを共有してもキーは見えません）

### 【4】CONFIG を確認する（ファイル先頭）

・SEND_MODE：'draft'（既定）はGmailの下書きに置くだけ。'send' にすると直接送信
・CHUNK_CHARS / MAX_CHUNKS：長い文字起こしを何文字ずつ・最大何分割で要約するか
・MASK_PII：AIへ送る前にメール・電話番号・郵便番号を伏せ字にする（true 推奨）
・REMIND_DAYS_AHEAD：期限まで何日以内のTODOをリマインドするか（期限切れは常に対象）
・REMIND_HOUR：毎朝何時台にリマインドを作るか
・DRY_RUN：最初は true のまま（メールも下書きも作らず、内容を実行ログに出します）

### 【5】初期設定

関数選択で setupMinutes を選び「実行」。初回は権限の承認画面が出ます
（「詳細」→「（プロジェクト名）に移動」→ 許可。自分で作ったスクリプトなので問題
ありません）。次が自動で用意されます：
  ・「議事録」シート：会議日 / 会議名 / 文字起こし・メモ / 共有先メール / 要約 / 状態 / 処理日時
  ・「TODO」シート：会議日 / 会議名 / 担当 / やること / 期限 / 期限（元の表記）/ 状態 / キー
  ・「メンバー」シート：担当者名（議事録での呼び方）/ メールアドレス
  ・毎日 REMIND_HOUR 時台に動くリマインドのトリガー1つ
「メンバー」シートに、議事録に出てくる呼び方（例：田中）とメールアドレスを書きます。
「田中さん」「田中様」は「田中」と同じ人として扱います。

### 【6】使う

シートを再読み込みすると上部にメニュー「議事録AI」が出ます。
(a)「議事録」シートに1会議1行で、会議日・会議名・文字起こし（またはメモ）を貼る。
   共有したい相手がいれば「共有先メール」にカンマ区切りで入れる（空なら共有しない）
(b) メニュー「未処理の議事録をまとめる」
   → 「要約」列に 要点・決定事項・TODO が入り、「状態」が「完了」になります
   → TODOは「TODO」シートに1行ずつ追加されます
   → 共有先があれば、Gmailに下書き（DRY_RUN中は実行ログに内容）
(c) 中身に納得できたら DRY_RUN を false にして保存。

### 【7】TODO台帳とリマインド

・終わったTODOは「TODO」シートの「状態」を「完了」にしてください。
・毎朝、期限切れと期限間近（REMIND_DAYS_AHEAD 日以内）の未完了TODOを、担当者ごとに
  1通にまとめて下書き（または送信）します。メニュー「TODOリマインドを今すぐ作る」
  でいつでも実行できます。
・「メンバー」シートに無い担当者と「未定」のTODOは、あなた宛ての1通にまとめます。
・期限が日付になっていない（「来週中」など）TODOはリマインド対象外です。必要なら
  「期限」列に日付を手で入れてください。

AIの出力をコードで確かめている所
・担当者：AIが書いた名前が文字起こしに出てこない場合は「未定」に戻します。
・期限：AIが書いた期限の表記が文字起こしにそのまま出てくる場合だけ、コードで
  日付にします（10/3・10月3日・2026/10/3 など）。会議日より前の月日は翌年とみなします
  （12月の会議で「1/10」→ 翌年1月10日）。曖昧な表現は「期限（元の表記）」に残すだけです。
・要点は最大5つ。決定事項が無い会議は「決定事項なし」と表示します。

### よくあるつまずき

・メニュー「議事録AI」が出ない → シートを再読み込み。または onOpen を1回実行
・「状態」が「エラー: …OPENAI_API_KEY が未設定」→【3】のスクリプト プロパティを確認
・「状態」が「エラー: …HTTP 401」がログに出る → APIキーの誤り
・「文字起こしが長すぎます」→ MAX_CHUNKS を増やすか、雑談部分を削ってから貼る
・途中で止まった → 6分の制限の手前で区切っています。もう一度実行すると続きから
・エラーになった行 → 状態が「完了」以外の行は、次の実行で自動的にやり直します
・下書きが増えない → 同じ件名の下書きが残っていると作り直しません（重複防止）
・トリガーを重複して作った → setupMinutes をもう一度実行すると1つにまとまります
・もう一度要約し直したい → その行の「状態」を空にして実行（TODOは重複しません）

ご注意
・AIの要約は必ず目を通してから共有してください。事実だけを使うよう指示し、担当者・
  期限はコードで確かめていますが、要点の言い回しや抜け漏れはあり得ます。
・個人情報の伏せ字は代表的な書式（メール・電話番号・郵便番号）だけが対象です。
  社外秘の会議は、社内のルールに従ってAIへの送信可否を判断してください。
・時短効果などを保証するものではありません。APIの利用料はご自身の負担です。

## コード全文（minutes_ai_plus.gs）

ファイル全体をコピーして、Apps Script エディタに貼り付けてください。

````js
/**
 * 議事録AI要約【拡張版】— 要点・決定事項・TODO ＋ TODO台帳 ＋ 期限リマインド
 *
 * スプレッドシートに紐づけて使います（拡張機能 → Apps Script に貼り付け）。
 * - 長い文字起こしも途中で切らない：一定の長さで分割 → 分割ごとに事実メモ → 最後に1つへ統合
 * - AIの出力はJSONで受け取り、コードで検査してから書き込む
 *   ・担当者名が文字起こしに出てこない場合は「未定」に戻す（AIによる担当者の作文を防ぐ）
 *   ・期限は「2026-10-03」「10/3」「10月3日」など本文に書かれた日付だけをコードで日付化。
 *     「来週中」などの曖昧な表現は元の表記のまま残し、勝手に日付を作らない
 * - TODOを「TODO」シートに1行ずつ台帳化（同じ議事録を再実行しても重複しない）
 * - 毎朝、期限切れ・期限間近のTODOを担当者ごとにまとめてリマインド（「メンバー」シートで宛先を管理）
 * - 共有は既定で「Gmailの下書き」。人が確認してから送る（SEND_MODE: 'send' で直接送信も可）
 * - AIへ送る前にメールアドレス・電話番号・郵便番号を伏せ字 / API混雑時(429/5xx)の自動リトライ
 * - 6分の実行時間制限の手前で止まり、次回の実行で続きから処理 / お試しモード（DRY_RUN）
 */
const CONFIG = {
  MODEL: 'gpt-4o-mini',
  SEND_MODE: 'draft',          // 'draft' = Gmailの下書きに置くだけ（推奨） / 'send' = 直接送信
  SUBJECT_PREFIX: '【議事録まとめ】',
  CHUNK_CHARS: 6000,           // この文字数ごとに分割して要約
  MAX_CHUNKS: 10,              // 分割数の上限（超えた分は処理せず、状態欄に書く）
  MASK_PII: true,              // AIへ送る前に個人情報っぽい文字列を伏せ字にする
  REMIND_DAYS_AHEAD: 2,        // 期限まで何日以内のTODOをリマインドするか（期限切れは常に対象）
  REMIND_HOUR: 9,              // 毎朝この時台にリマインドを作る
  TIME_LIMIT_SEC: 300,         // これを超えたら区切って次回に回す（GASの上限は6分）
  DRY_RUN: true                // 最初は true。ログで中身を確認してから false に
};

const MINUTES_SHEET = '議事録';
const TODO_SHEET = 'TODO';
const MEMBER_SHEET = 'メンバー';
const MINUTES_HEADER = ['会議日', '会議名', '文字起こし・メモ', '共有先メール（カンマ区切り）', '要約（AIが書く）', '状態', '処理日時'];
const TODO_HEADER = ['会議日', '会議名', '担当', 'やること', '期限', '期限（元の表記）', '状態', 'キー'];
const MEMBER_HEADER = ['担当者名（議事録での呼び方）', 'メールアドレス'];
const UNDECIDED = '未定';
const DONE = '完了';

// ---------------------------------------------------------------- メニュー・初期設定

function onOpen() {
  SpreadsheetApp.getUi().createMenu('議事録AI')
    .addItem('初期設定（シートとトリガー作成）', 'setupMinutes')
    .addItem('未処理の議事録をまとめる', 'processMinutes')
    .addItem('TODOリマインドを今すぐ作る', 'remindTodos')
    .addToUi();
}

function setupMinutes() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  [[MINUTES_SHEET, MINUTES_HEADER], [TODO_SHEET, TODO_HEADER], [MEMBER_SHEET, MEMBER_HEADER]].forEach(p => {
    if (!ss.getSheetByName(p[0])) ss.insertSheet(p[0]).getRange(1, 1, 1, p[1].length).setValues([p[1]]);
  });
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'remindTodos')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('remindTodos').timeBased().everyDays(1).atHour(CONFIG.REMIND_HOUR).create();
  log_('初期設定が完了しました（毎朝' + CONFIG.REMIND_HOUR + '時台にTODOリマインド）');
}

// ---------------------------------------------------------------- 議事録の要約

/** 「議事録」シートで状態が「完了」でない行を上から処理する。途中で止まっても再実行で続きから */
function processMinutes(now) {
  const started = Date.now();
  now = now instanceof Date ? now : new Date();
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(MINUTES_SHEET);
  if (!sh) throw new Error('「' + MINUTES_SHEET + '」シートがありません。先に初期設定を実行してください');
  const values = sh.getDataRange().getValues();
  let done = 0, failed = 0, paused = false;
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    const transcript = String(row[2] || '').trim();
    if (!transcript || String(row[5]).indexOf(DONE) === 0) continue;
    if ((Date.now() - started) / 1000 > CONFIG.TIME_LIMIT_SEC) { paused = true; break; }
    const meetingDay = cellYmd_(row[0]) || ymd_(now);
    const title = String(row[1] || '').trim() || '会議';
    try {
      const result = summarizeTranscript_(transcript, meetingDay);
      const body = formatSummary_(meetingDay, title, result);
      const added = appendTodos_(meetingDay, title, result.todos, r + 1);
      const to = String(row[3] || '').split(/[,、\s]+/).filter(isEmail_).join(',');
      let shared = '共有なし';
      if (to) shared = deliver_(to, CONFIG.SUBJECT_PREFIX + meetingDay + ' ' + title, body + FOOTER_);
      sh.getRange(r + 1, 5, 1, 3).setValues([[body, DONE + '（TODO ' + added + '件・' + shared + '）', fmt_(now, 'yyyy-MM-dd HH:mm')]]);
      done++;
    } catch (e) {
      sh.getRange(r + 1, 6).setValue('エラー: ' + e.message);
      failed++;
    }
  }
  const msg = '処理 ' + done + ' 件 / エラー ' + failed + ' 件' + (paused ? ' / 時間切れのため中断（もう一度実行すると続きから）' : '');
  toast_(msg);
  return { done: done, failed: failed, paused: paused };
}

const FOOTER_ = '\n\n---\n（AIが会議メモから作成した要約です。担当・期限は原文で確認してください）';

const PART_PROMPT_ =
  '以下は会議の文字起こし（またはメモ）の一部です。書かれている事実だけを使い、推測や創作はしないでください。' +
  '議題・発言の要点・決まったこと・誰が何をいつまでにやるか、を日本語の箇条書きで漏れなく抜き出してください。' +
  '人名と日付は原文の表記のまま書いてください。';

const FINAL_PROMPT_ =
  'あなたは議事録係です。入力は会議の文字起こし、または分割要約のメモです。書かれている事実だけを使い、推測や創作はしないでください。' +
  '次のJSONだけを返してください: {"points":["要点(最大5つ)"],"decisions":["決定事項"],"todos":[{"owner":"担当者名","task":"やること","due":"期限"}]}。' +
  'owner は本文に出てくる人名を原文の表記のまま書き、本文に無ければ "未定"。' +
  'due は本文に書かれた期限を原文の表記のまま書き、無ければ "未定"。日付を計算したり補ったりしないでください。' +
  '決定事項が無ければ decisions は空配列にしてください。';

/** 文字起こし → {points, decisions, todos}。長文は分割して段階的に要約する */
function summarizeTranscript_(transcript, meetingDay) {
  const text = CONFIG.MASK_PII ? maskPII_(transcript) : transcript;
  const chunks = splitChunks_(text, CONFIG.CHUNK_CHARS);
  if (chunks.length > CONFIG.MAX_CHUNKS) {
    throw new Error('文字起こしが長すぎます（' + chunks.length + '分割）。MAX_CHUNKS を増やすか、雑談部分を削ってください');
  }
  let input = text;
  if (chunks.length > 1) {
    input = chunks.map((c, i) => {
      const notes = askAI_(PART_PROMPT_, c, false);
      if (!notes) throw new Error('AIの呼び出しに失敗しました（分割 ' + (i + 1) + '/' + chunks.length + '）');
      return '【パート' + (i + 1) + '】\n' + notes;
    }).join('\n\n');
  }
  const raw = askAI_(FINAL_PROMPT_, input, true);
  if (!raw) throw new Error('AIの呼び出しに失敗しました');
  return verifyResult_(parseJson_(raw), transcript, meetingDay);
}

/** 段落・改行・句点の区切りを優先して、max文字以下のかたまりに分ける */
function splitChunks_(text, max) {
  const out = [];
  let rest = String(text);
  while (rest.length > max) {
    const head = rest.slice(0, max);
    let cut = Math.max(head.lastIndexOf('\n\n'), head.lastIndexOf('\n'), head.lastIndexOf('。'));
    if (cut < max * 0.5) cut = max - 1;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1);
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

function parseJson_(raw) {
  const s = String(raw).replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '');
  const a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a < 0 || b < a) throw new Error('AIの出力がJSONではありませんでした');
  return JSON.parse(s.slice(a, b + 1));
}

/** AIの出力をコードで検査する：担当者は原文に出てくる名前だけ、期限は原文にある日付だけ */
function verifyResult_(obj, transcript, meetingDay) {
  const list = v => (Array.isArray(v) ? v : []).map(x => String(x || '').trim()).filter(Boolean);
  const todos = (Array.isArray(obj.todos) ? obj.todos : []).map(t => {
    const task = String((t && t.task) || '').trim();
    let owner = String((t && t.owner) || '').trim();
    const dueText = String((t && t.due) || '').trim() || UNDECIDED;
    if (!owner || owner === UNDECIDED || transcript.indexOf(baseName_(owner)) < 0) owner = UNDECIDED;
    const due = dueText !== UNDECIDED && transcript.indexOf(dueText) >= 0 ? parseDue_(dueText, meetingDay) : '';
    return { owner: owner, task: task, dueText: dueText, due: due };
  }).filter(t => t.task);
  return { points: list(obj.points).slice(0, 5), decisions: list(obj.decisions), todos: todos };
}

/** 本文に書かれた明示的な日付だけを yyyy-MM-dd にする。曖昧な表現は '' を返す */
function parseDue_(text, meetingDay) {
  const t = String(text).replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  let y = null, m = null, d = null, hit;
  if ((hit = t.match(/(\d{4})[-\/年.](\d{1,2})[-\/月.](\d{1,2})/))) { y = +hit[1]; m = +hit[2]; d = +hit[3]; }
  else if ((hit = t.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日/)) || (hit = t.match(/(?:^|[^\d\/])(\d{1,2})\/(\d{1,2})(?![\d\/])/))) {
    m = +hit[1]; d = +hit[2];
  } else return '';
  const base = String(meetingDay).split('-').map(Number);
  if (y === null) {
    y = base[0];
    // 会議日より前の月日なら翌年とみなす（例：12月の会議で「1/10」）
    if (m < base[1] || (m === base[1] && d < base[2])) y++;
  }
  if (m < 1 || m > 12 || d < 1 || d > new Date(y, m, 0).getDate()) return '';
  return y + '-' + pad2_(m) + '-' + pad2_(d);
}

function formatSummary_(meetingDay, title, r) {
  const bullets = a => a.length ? a.map(x => '・' + x).join('\n') : '・なし';
  const todo = r.todos.length
    ? r.todos.map(t => '・' + t.owner + ' - ' + t.task + ' - ' + (t.due || t.dueText)).join('\n')
    : '・なし';
  return ['■ ' + title + '（' + meetingDay + '）', '', '【要点】', bullets(r.points), '',
          '【決定事項】', r.decisions.length ? bullets(r.decisions) : '・決定事項なし', '',
          '【TODO（担当 - やること - 期限）】', todo].join('\n');
}

/** TODOシートに追記。キー（議事録の行＋会議日＋内容）が同じ行は追加しない */
function appendTodos_(meetingDay, title, todos, sourceRow) {
  const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TODO_SHEET);
  if (!sh || !todos.length) return 0;
  const keys = {};
  sh.getDataRange().getValues().slice(1).forEach(r => { keys[String(r[7])] = true; });
  const rows = [];
  todos.forEach(t => {
    const key = 'R' + sourceRow + ':' + meetingDay + ':' + hash_(t.owner + '|' + t.task);
    if (keys[key]) return;
    keys[key] = true;
    rows.push([meetingDay, title, t.owner, t.task, t.due, t.dueText, '未着手', key]);
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, TODO_HEADER.length).setValues(rows);
  return rows.length;
}

// ---------------------------------------------------------------- TODOリマインド

/** 期限切れ・期限間近（REMIND_DAYS_AHEAD日以内）の未完了TODOを担当者ごとにまとめて知らせる */
function remindTodos(now) {
  now = now instanceof Date ? now : new Date();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(TODO_SHEET);
  if (!sh) return { sent: 0 };
  const today = ymd_(now);
  const limit = ymd_(new Date(now.getTime() + CONFIG.REMIND_DAYS_AHEAD * 86400000));
  const members = {};
  const msh = ss.getSheetByName(MEMBER_SHEET);
  if (msh) msh.getDataRange().getValues().slice(1).forEach(r => {
    const name = String(r[0] || '').trim(), mail = String(r[1] || '').trim();
    if (name && isEmail_(mail)) members[baseName_(name)] = mail;
  });
  const byOwner = {};
  sh.getDataRange().getValues().slice(1).forEach(r => {
    const due = cellYmd_(r[4]);
    if (!due || String(r[6]).trim() === DONE || due > limit) return;
    const owner = baseName_(String(r[2] || '').trim() || UNDECIDED);
    (byOwner[owner] = byOwner[owner] || []).push({ due: due, task: String(r[3]), title: String(r[1]), overdue: due < today });
  });
  const unknown = [];
  let sent = 0;
  Object.keys(byOwner).sort().forEach(owner => {
    const items = byOwner[owner].sort((a, b) => a.due < b.due ? -1 : 1);
    const lines = items.map(i => (i.overdue ? '【期限切れ】' : '') + i.due + ' ' + i.task + '（' + i.title + '）');
    const mail = members[owner];
    if (!mail) { unknown.push(owner + '：\n' + lines.join('\n')); return; }
    const body = owner + ' さん\n\n期限が近い・過ぎているTODOです（' + today + '時点）。\n\n' + lines.join('\n') +
      '\n\n完了したら「TODO」シートの状態を「完了」にしてください。';
    if (deliver_(mail, '【TODOリマインド】' + today + ' ' + owner + ' さん（' + items.length + '件）', body) !== 'スキップ') sent++;
  });
  if (unknown.length) {
    const me = Session.getActiveUser().getEmail();
    const body = '宛先が「メンバー」シートに無い担当者（または担当未定）のTODOです。\n\n' + unknown.join('\n\n');
    if (me) deliver_(me, '【TODOリマインド】' + today + ' 宛先未登録・担当未定分', body);
    else log_(body);
  }
  return { sent: sent, unknownOwners: unknown.length };
}

// ---------------------------------------------------------------- AI・共有

function askAI_(system, user, json) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) throw new Error('スクリプト プロパティ OPENAI_API_KEY が未設定です');
  const payload = { model: CONFIG.MODEL, temperature: 0,
    messages: [{ role: 'system', content: system }, { role: 'user', content: user }] };
  if (json) payload.response_format = { type: 'json_object' };
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

/** 下書き（既定）または送信。同じ件名の下書きがあれば作り直さない */
function deliver_(to, subject, body) {
  if (CONFIG.DRY_RUN) { log_('[DRY_RUN] 宛先 ' + to + '「' + subject + '」\n' + body); return 'お試し'; }
  if (CONFIG.SEND_MODE === 'send') { GmailApp.sendEmail(to, subject, body); return '送信済み'; }
  const exists = GmailApp.getDrafts().some(d => d.getMessage().getSubject() === subject);
  if (exists) { log_('同じ件名の下書きがあるため作りません: ' + subject); return 'スキップ'; }
  GmailApp.createDraft(to, subject, body);
  return '下書き作成';
}

// ---------------------------------------------------------------- 小道具

function maskPII_(s) {
  return String(s)
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[メール]')
    .replace(/\b0\d{1,4}-\d{1,4}-\d{3,4}\b|\b0\d{9,10}\b/g, '[電話]')
    .replace(/〒\s?\d{3}-?\d{4}|\b\d{3}-\d{4}\b/g, '[郵便番号]');
}

/** 「田中さん」「田中様」を「田中」にそろえる */
function baseName_(s) { return String(s).replace(/\s*(さん|様|氏|くん|君)$/, ''); }
function isEmail_(s) { return /^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(String(s).trim()); }
function hash_(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function fmt_(d, p) { return Utilities.formatDate(d, Session.getScriptTimeZone(), p); }
function ymd_(d) { return fmt_(d, 'yyyy-MM-dd'); }
function cellYmd_(v) {
  if (v instanceof Date) return ymd_(v);
  const m = String(v || '').trim().match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  return m ? m[1] + '-' + pad2_(+m[2]) + '-' + pad2_(+m[3]) : '';
}
function toast_(msg) {
  log_(msg);
  try { SpreadsheetApp.getActiveSpreadsheet().toast(msg, '議事録AI', 5); } catch (e) { /* トリガー実行時 */ }
}
function log_(msg) { console.log(msg); }
````
