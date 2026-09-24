---
title: "スプレッドシート =AI() 関数【拡張版】"
---

## 記事版からの追加点

```text
(1) =AI_CLASSIFY(セル, "要望/不満/質問/その他")：選択肢のどれか1つだけを返す。
    AIが余計な言葉を付けても選択肢に合わせ、合わなければ「#判定不能」。集計がそのまま使える
(2) =AI_EXTRACT(セル, "会社名/氏名/金額")：項目ごとに右のセルへ横並びで抜き出す
(3) =AI_TRANSLATE(セル, "英語")：翻訳
(4) 一括処理（値で書き込み）：選んだ列を数式を使わずに処理。再計算で課金されない。
    実行前に件数と概算の利用料（円）を表示、6分制限の手前で止まって自動で続きから再開、
    すでに答えが入っている行は飛ばす（途中で止まっても二重課金しない）
(5) 月の予算上限（円）：超えたらAPIを呼ばずに「#予算上限」。今月の利用量をメニューで確認
(6) メールアドレス・電話番号・郵便番号を伏せ字にしてからAIへ送るオプション
(7) 記事版と同じキャッシュ・空セル除外・「値で確定」（新しい関数にも対応）
```

## 導入手順

必要なもの：Googleアカウント、OpenAI の APIキー（従量課金）。
ChatGPT の有料プランは不要です。

### 【1】スクリプトを貼る

使いたいスプレッドシートで「拡張機能 → Apps Script」を開き、最初からあるコードを
全部消して、sheets_ai_plus.gs の中身を丸ごと貼り付け → 保存。

### 【2】APIキーを登録する

Apps Script 左の「プロジェクトの設定（歯車）」→「スクリプト プロパティ」→
プロパティ OPENAI_API_KEY、値に sk- で始まるキーを追加。
（コードに直接書かないので、シートを閲覧共有してもキーは見えません）

### 【3】CONFIG を確認する（ファイル先頭）

・MONTHLY_BUDGET_JPY：今月の概算利用料の上限（円）。初期値500円。0で無制限
・PRICE_IN_USD_PER_1M / PRICE_OUT_USD_PER_1M：モデルの単価。OpenAIの料金ページで
  現在の値を確認して更新してください（概算と予算の計算に使います）
・JPY_PER_USD：為替の目安
・MASK_PII：true だとメール・電話・郵便番号を伏せ字にしてから送ります
・BATCH_OUTPUT_OFFSET：一括処理の書き込み先（選択列の何列右か。初期値1＝すぐ右）

### 【4】初回の承認

シートを再読み込みすると、上部にメニュー「AI」が出ます。どれか1つ実行すると権限の
承認画面が出ます（「詳細」→「（プロジェクト名）に移動」→ 許可）。

### 使い方

見本を試すなら、新しいシートに 02_sample_feedback.csv を「ファイル → インポート」で
読み込みます（A列：自由記述）。

■ 関数（少量・試行錯誤向け）
  =AI("30文字以内で要約して", A2)
  =AI_CLASSIFY(A2, "要望/不満/質問/その他")
  =AI_EXTRACT(A2, "商品名/金額/希望日")      ← 右に3列ぶん使います。右側を空けておく
  =AI_TRANSLATE(A2, "英語")
  指示を調整したら下へコピー（最初は20〜30行ずつ）。結果が出たら範囲を選択して
  メニュー「AI → 選択範囲の =AI() を値で確定」。以後は再計算されず課金もされません。

■ 一括処理（数百行向け・おすすめ）
  1. 入力の列（例：A2:A300）を1列だけ選択
  2. メニュー「AI → 一括処理（値で書き込み）」→ 指示を入力（例：「30文字以内で要約して」）
  3. 件数と概算の利用料が表示されるので「はい」
  4. すぐ右の列に答えが「値」で書き込まれます。約4分半ごとに区切り、1分後に自動で
     続きから再開します（シートを閉じても進みます）
  ・すでに答えが入っている行は飛ばすので、途中で止めても・もう一度実行しても二重に
    課金されません。混雑で取れなかった行は空欄のまま残り、再実行で取り直せます
  ・止めたいときは「AI → 一括処理を中止」

■ 利用量
  メニュー「AI → 今月の利用量」で回数・トークン数・概算の円が見られます。
  上限に達すると関数は「#予算上限」を返し、一括処理は停止します。翌月に自動で
  リセットされます（上限を上げるなら MONTHLY_BUDGET_JPY を変更）。

エラーの見方（# で始まる答えは「値で確定」の対象外）
#APIキー未設定 … 【2】のスクリプトプロパティ名が OPENAI_API_KEY か確認
#AIエラー 401  … APIキーの誤り。429/5xx は自動で再試行済み
#AI混雑中      … 一度に多すぎ。少し待ってセルを再入力、または一括処理を使う
#判定不能      … 選択肢に当てはまらない答えだった。選択肢に「その他」を入れると減ります
#抽出失敗      … AIがJSONで答えなかった。項目名を短く具体的に
#予算上限      … 今月の上限に達した

ご注意
・セルの内容は OpenAI の API に送られます。伏せ字は代表的な書式（メール・電話・
  郵便番号）だけが対象です。氏名・住所などは送らないか、社内規程で可否を確認して
  ください。
・利用量の円は、APIが返すトークン数と CONFIG の単価・為替から計算した概算です。
  実際の請求は OpenAI の管理画面で確認してください。
・AIの答えは間違えることがあります。時短効果などを保証するものではありません。
  APIの利用料はご自身の負担です。

## コード全文（sheets_ai_plus.gs）

ファイル全体をコピーして、Apps Script エディタに貼り付けてください。

```js
/**
 * スプレッドシート =AI() 関数【拡張版】（Google Apps Script × ChatGPT）
 *
 * スプレッドシートの「拡張機能 → Apps Script」に貼り付けて使います。
 * - =AI(指示, セル)            … 汎用（記事版と同じ使い方）
 * - =AI_CLASSIFY(セル, "要望/不満/質問/その他") … 選択肢のどれか1つだけを返す（それ以外は「#判定不能」）
 * - =AI_EXTRACT(セル, "会社名/氏名/金額")        … 項目ごとに右のセルへ横並びで抜き出す
 * - =AI_TRANSLATE(セル, "英語")                  … 翻訳
 * - メニュー「一括処理（値で書き込み）」… 選んだ列を数式を使わずに処理。6分制限の手前で止まり、
 *   自動で続きから再開。実行前に件数と概算の利用料（円）を表示して確認
 * - 月の予算上限（円）：超えたらAPIを呼ばずに「#予算上限」を返す。今月の利用量をメニューで確認
 * - 個人情報（メール・電話番号・郵便番号）を伏せ字にしてから送るオプション
 * - 同じ「指示＋対象」の答えは6時間キャッシュ、空セルは呼ばない、「値で確定」メニュー
 */
const CONFIG = {
  MODEL: 'gpt-4o-mini',
  MAX_INPUT_CHARS: 4000,          // 1セルあたりAIに渡す最大文字数
  CACHE_SECONDS: 21600,           // 6時間（CacheServiceの上限）
  MONTHLY_BUDGET_JPY: 500,        // 今月の概算利用料がこれを超えたらAPIを呼ばない（0で無制限）
  PRICE_IN_USD_PER_1M: 0.15,      // 入力100万トークンあたりの単価（OpenAIの料金表で確認して更新）
  PRICE_OUT_USD_PER_1M: 0.60,     // 出力100万トークンあたりの単価
  JPY_PER_USD: 150,
  MASK_PII: true,                 // メール・電話・郵便番号を伏せ字にしてから送る
  BATCH_OUTPUT_OFFSET: 1,         // 一括処理の書き込み先：選択列の何列右か
  BATCH_TIME_LIMIT_MS: 270000     // 1回の実行で使う時間（6分制限の手前で止める）
};

const SYSTEM = '指示に対する答えだけを返す（言語の指定が無ければ日本語）。前置き・説明・引用符は付けない。分からない場合は「不明」とだけ返す。';
const BUSY = '#AI混雑中（あとで再実行）';

// ================================================================ カスタム関数

/**
 * ChatGPTに指示を送って答えを返す。
 * @param {string} instruction 指示（例: "30文字以内で要約して"）
 * @param {string} input 対象のテキスト（セル参照でOK）
 * @return 答え
 * @customfunction
 */
function AI(instruction, input) {
  if (!instruction) return '';
  const text = toText_(input);
  if (input !== undefined && text.trim() === '') return '';
  return askAI_(String(instruction), text, 0);
}

/**
 * 選択肢のどれか1つだけを返す分類。選択肢以外の答えは「#判定不能」。
 * @param {string} input 分類したいテキスト
 * @param {string} choices 選択肢を / か , で区切る（例: "要望/不満/質問/その他"）
 * @return 選択肢のどれか
 * @customfunction
 */
function AI_CLASSIFY(input, choices) {
  const text = toText_(input);
  if (text.trim() === '') return '';
  const list = splitList_(choices);
  if (list.length < 2) return '#選択肢を2つ以上指定してください';
  const ans = askAI_('次の選択肢のどれか1つだけを、そのまま答えて: ' + list.join(' / '), text, 0);
  if (ans.charAt(0) === '#') return ans;
  return matchChoice_(ans, list) || '#判定不能';
}

/**
 * テキストから項目を抜き出し、項目ごとに右のセルへ横並びで返す。見つからない項目は空欄。
 * @param {string} input 対象のテキスト
 * @param {string} fields 項目名を / か , で区切る（例: "会社名/氏名/金額"）
 * @return 横1行の配列
 * @customfunction
 */
function AI_EXTRACT(input, fields) {
  const text = toText_(input);
  const list = splitList_(fields);
  if (list.length === 0) return '#項目を指定してください';
  if (text.trim() === '') return [list.map(() => '')];
  const ans = askAI_('次の項目を抜き出し、JSONオブジェクト1つだけで返して（キーは項目名そのまま、見つからない項目は空文字）: ' +
    list.join(', '), text, 0);
  if (ans.charAt(0) === '#') return [[ans].concat(list.slice(1).map(() => ''))];
  const obj = parseJsonObject_(ans);
  if (!obj) return [['#抽出失敗'].concat(list.slice(1).map(() => ''))];
  return [list.map(k => obj[k] === undefined || obj[k] === null ? '' : String(obj[k]))];
}

/**
 * 翻訳。
 * @param {string} input 翻訳したいテキスト
 * @param {string} lang 訳す言語（例: "英語"）
 * @return 訳文
 * @customfunction
 */
function AI_TRANSLATE(input, lang) {
  const text = toText_(input);
  if (text.trim() === '') return '';
  return askAI_('自然な' + (lang || '英語') + 'に翻訳して。訳文だけを返す', text, 0);
}

// ================================================================ AI呼び出し（キャッシュ・予算・リトライ）

function askAI_(instruction, text, maxRetrySleepMs) {
  const clipped = maskIfNeeded_(text).slice(0, CONFIG.MAX_INPUT_CHARS);
  const key = cacheKey_(CONFIG.MODEL + '\u0000' + instruction + '\u0000' + clipped);
  const cache = CacheService.getScriptCache();
  const hit = cache.get(key);
  if (hit !== null) return hit;                                  // 同じ質問は再課金しない

  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) return '#APIキー未設定';
  if (overBudget_()) return '#予算上限（今月の上限に達しました）';

  const payload = {
    model: CONFIG.MODEL, temperature: 0,
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: '指示: ' + instruction + (clipped ? '\n\n対象:\n' + clipped : '') }
    ]
  };
  // カスタム関数は30秒で打ち切られるので待ち時間は短く。一括処理は長めに待てる
  const tries = maxRetrySleepMs > 0 ? 5 : 3;
  for (let attempt = 0; attempt < tries; attempt++) {
    const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code === 200) {
      let json;
      try { json = JSON.parse(res.getContentText()); } catch (e) { return '#AI応答の形式エラー'; }
      recordUsage_(json.usage);
      const answer = String(json.choices[0].message.content || '').trim();
      cache.put(key, answer.slice(0, 30000), CONFIG.CACHE_SECONDS);
      return answer;
    }
    if (code === 429 || code >= 500) {
      Utilities.sleep(Math.min(1000 * Math.pow(2, attempt), maxRetrySleepMs > 0 ? maxRetrySleepMs : 4000));
      continue;
    }
    return '#AIエラー ' + code;                                    // 401など、再試行しても無駄なもの
  }
  return BUSY;
}

// ================================================================ 利用量と予算

function monthKey_() {
  return 'usage_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMM');
}

function readUsage_() {
  const raw = PropertiesService.getScriptProperties().getProperty(monthKey_());
  const u = raw ? JSON.parse(raw) : {};
  return { calls: u.calls || 0, inTok: u.inTok || 0, outTok: u.outTok || 0 };
}

function usageJpy_(u) {
  return (u.inTok * CONFIG.PRICE_IN_USD_PER_1M + u.outTok * CONFIG.PRICE_OUT_USD_PER_1M) / 1e6 * CONFIG.JPY_PER_USD;
}

function overBudget_() {
  return CONFIG.MONTHLY_BUDGET_JPY > 0 && usageJpy_(readUsage_()) >= CONFIG.MONTHLY_BUDGET_JPY;
}

function recordUsage_(usage) {
  if (!usage) return;
  const lock = LockService.getScriptLock();
  const locked = lock.tryLock(5000);                              // 取れなくても記録は続ける（多少の誤差は許容）
  try {
    const u = readUsage_();
    u.calls += 1;
    u.inTok += usage.prompt_tokens || 0;
    u.outTok += usage.completion_tokens || 0;
    PropertiesService.getScriptProperties().setProperty(monthKey_(), JSON.stringify(u));
  } finally { if (locked) lock.releaseLock(); }
}

function showUsage() {
  const u = readUsage_();
  const msg = '今月のAI利用: ' + u.calls + '回 / 入力' + u.inTok + '・出力' + u.outTok + 'トークン / 概算 ' +
    Math.round(usageJpy_(u) * 10) / 10 + '円' +
    (CONFIG.MONTHLY_BUDGET_JPY > 0 ? '（上限 ' + CONFIG.MONTHLY_BUDGET_JPY + '円）' : '');
  SpreadsheetApp.getUi().alert(msg);
  return msg;
}

// ================================================================ メニュー

function onOpen() {
  SpreadsheetApp.getUi().createMenu('AI')
    .addItem('一括処理（値で書き込み）', 'startBatch')
    .addItem('一括処理を中止', 'cancelBatch')
    .addItem('選択範囲の =AI() を値で確定', 'freezeSelection')
    .addItem('今月の利用量', 'showUsage')
    .addToUi();
}

/** 選択範囲の =AI 系の結果を値として書き戻す。以後は再計算されない */
function freezeSelection() {
  const range = SpreadsheetApp.getActiveRange();
  const formulas = range.getFormulas();
  const values = range.getValues();
  let frozen = 0, skipped = 0;
  for (let r = 0; r < formulas.length; r++) {
    for (let c = 0; c < formulas[r].length; c++) {
      if (!/^=\s*AI(_CLASSIFY|_EXTRACT|_TRANSLATE)?\s*\(/i.test(formulas[r][c])) continue;
      const v = String(values[r][c]);
      if (v.charAt(0) === '#' || v === 'Loading...') { skipped++; continue; }
      range.getCell(r + 1, c + 1).setValue(values[r][c]);
      frozen++;
    }
  }
  SpreadsheetApp.getActive().toast(frozen + '件を値で確定 / ' + skipped + '件はエラーのため数式のまま');
  return { frozen: frozen, skipped: skipped };
}

// ================================================================ 一括処理（数式を使わない）

/** 選択した1列を入力に、BATCH_OUTPUT_OFFSET 列右へ答えを書く。答えが入っている行は飛ばす */
function startBatch() {
  const ui = SpreadsheetApp.getUi();
  const range = SpreadsheetApp.getActiveRange();
  if (range.getNumColumns() !== 1) { ui.alert('入力にする列を1列だけ選択してから実行してください'); return; }
  const p = ui.prompt('一括処理', 'AIへの指示（例: 30文字以内で要約して）', ui.ButtonSet.OK_CANCEL);
  if (p.getSelectedButton() !== ui.Button.OK || !p.getResponseText().trim()) return;
  const sheet = range.getSheet();
  const job = {
    sheet: sheet.getName(), startRow: range.getRow(), endRow: range.getLastRow(),
    inCol: range.getColumn(), outCol: range.getColumn() + CONFIG.BATCH_OUTPUT_OFFSET,
    instruction: p.getResponseText().trim(), next: range.getRow(), done: 0, failed: 0
  };
  const est = estimate_(sheet, job);
  if (est.rows === 0) { ui.alert('処理する行がありません（入力が空か、書き込み先がすでに埋まっています）'); return; }
  const ok = ui.alert('確認', est.rows + '行を処理します。概算の利用料は約' + est.jpy + '円です（' +
    columnName_(job.outCol) + '列に書き込み）。実行しますか？', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  PropertiesService.getDocumentProperties().setProperty('batch_job', JSON.stringify(job));
  return runBatch_();
}

/** 時間切れで止まった一括処理の続き（トリガーから呼ばれる） */
function continueBatch() { return runBatch_(); }

function cancelBatch() {
  PropertiesService.getDocumentProperties().deleteProperty('batch_job');
  deleteBatchTriggers_();
  SpreadsheetApp.getActive().toast('一括処理を中止しました（書き込み済みの行はそのまま残ります）');
}

function runBatch_() {
  const props = PropertiesService.getDocumentProperties();
  const raw = props.getProperty('batch_job');
  deleteBatchTriggers_();
  if (!raw) return null;
  const job = JSON.parse(raw);
  const sheet = SpreadsheetApp.getActive().getSheetByName(job.sheet);
  if (!sheet) { props.deleteProperty('batch_job'); return null; }
  const began = Date.now();
  while (job.next <= job.endRow) {
    if (Date.now() - began > CONFIG.BATCH_TIME_LIMIT_MS) {        // 6分制限の手前で止めて、1分後に続きから
      props.setProperty('batch_job', JSON.stringify(job));
      ScriptApp.newTrigger('continueBatch').timeBased().after(60 * 1000).create();
      SpreadsheetApp.getActive().toast(job.done + '行完了。続きを自動で再開します');
      return job;
    }
    const input = toText_(sheet.getRange(job.next, job.inCol).getValue());
    const outCell = sheet.getRange(job.next, job.outCol);
    const current = String(outCell.getValue());
    if (input.trim() !== '' && (current === '' || current === BUSY)) {
      const ans = askAI_(job.instruction, input, 16000);
      if (ans.indexOf('#予算上限') === 0) {                        // 予算に達したら止める
        props.deleteProperty('batch_job');
        SpreadsheetApp.getActive().toast('今月の予算上限に達したため停止しました（' + job.done + '行完了）');
        job.stopped = 'budget';
        return job;
      }
      if (ans === BUSY || ans.indexOf('#AIエラー') === 0) job.failed++;
      else job.done++;
      if (ans !== BUSY) outCell.setValue(ans);                    // 混雑は空のまま＝再実行で取り直す
    }
    job.next++;
  }
  props.deleteProperty('batch_job');
  SpreadsheetApp.getActive().toast('一括処理が完了しました: ' + job.done + '行' + (job.failed ? ' / 失敗 ' + job.failed + '行（もう一度実行すると空欄だけ処理します）' : ''));
  job.finished = true;
  return job;
}

function estimate_(sheet, job) {
  const n = job.endRow - job.startRow + 1;
  const ins = sheet.getRange(job.startRow, job.inCol, n, 1).getValues();
  const outs = sheet.getRange(job.startRow, job.outCol, n, 1).getValues();
  let rows = 0, chars = 0;
  for (let i = 0; i < n; i++) {
    const t = toText_(ins[i][0]);
    if (t.trim() === '' || String(outs[i][0]) !== '') continue;
    rows++;
    chars += Math.min(t.length, CONFIG.MAX_INPUT_CHARS) + job.instruction.length + SYSTEM.length;
  }
  // 日本語は概ね1文字≒1トークン、答えは1行あたり100トークンで概算（多めに見積もる）
  const usd = (chars * CONFIG.PRICE_IN_USD_PER_1M + rows * 100 * CONFIG.PRICE_OUT_USD_PER_1M) / 1e6;
  return { rows: rows, jpy: Math.max(1, Math.ceil(usd * CONFIG.JPY_PER_USD)) };
}

function deleteBatchTriggers_() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'continueBatch')
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// ================================================================ 小道具

function toText_(v) {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.map(r => Array.isArray(r) ? r.join(' ') : String(r)).join('\n');
  return String(v);
}

function splitList_(s) {
  return String(s || '').split(/[\/,、，]/).map(x => x.trim()).filter(x => x);
}

/** AIの答えを選択肢に合わせる。完全一致→「」や句点を除いて一致→選択肢を1つだけ含む、の順 */
function matchChoice_(ans, list) {
  const a = String(ans).trim();
  if (list.indexOf(a) !== -1) return a;
  const b = a.replace(/[「」『』"'。．.\s]/g, '');
  const exact = list.find(c => c === b);
  if (exact) return exact;
  const contained = list.filter(c => b.indexOf(c) !== -1);
  return contained.length === 1 ? contained[0] : null;
}

function parseJsonObject_(s) {
  const m = String(s).match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { const o = JSON.parse(m[0]); return o && typeof o === 'object' && !Array.isArray(o) ? o : null; }
  catch (e) { return null; }
}

function maskIfNeeded_(s) {
  if (!CONFIG.MASK_PII) return s;
  return s
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[メール]')
    .replace(/\b0\d{1,4}-\d{1,4}-\d{3,4}\b|\b0\d{9,10}\b/g, '[電話]')
    .replace(/〒\s?\d{3}-?\d{4}|\b\d{3}-\d{4}\b/g, '[郵便番号]');
}

function cacheKey_(s) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8);
  return 'ai_' + Utilities.base64EncodeWebSafe(bytes);
}

function columnName_(n) {
  let s = '';
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s;
  return s;
}
```

## アンケート自由記述の見本（02_sample_feedback.csv）

```csv
自由記述
配送が予定より3日遅れました。次回は事前に連絡がほしいです。
黒のMサイズの再入荷はいつ頃になりますか？
とても使いやすく、家族にもすすめました。
請求書の宛名を「株式会社サンプル」に変更したいです。10月分からお願いします。
アプリにログインできません。パスワード再設定のメールも届きません。
```
