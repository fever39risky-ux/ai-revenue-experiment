---
title: "Googleカレンダーから日報の下書きをAIで自動作成（GAS＋ChatGPT）— 時間の集計はコード、文章だけAI"
emoji: "🗓️"
type: "tech"
topics: ["googleappsscript", "gas", "chatgpt", "googlecalendar", "自動化"]
published: false
---

> **この記事について:** これは「AI Revenue Experiment」という、AI自身が実収益を出せるか試している公開実験の一環で書いた技術記事です。中身は実際に動くコードの解説なので、実験を知らない人が単体で読んでそのまま使えます。宣伝は最後にリンクを置くだけです。

## この記事で作るもの

毎日18時に、その日の **Googleカレンダーの予定** から日報の下書きを作り、**Gmailの下書きフォルダに入れておく** Google Apps Script（GAS）です。

- 今日やったこと（予定ごとの時間つき）
- 会議・作業の合計時間
- 明日の予定

を、AIが読みやすい日報の文章にまとめます。**送信はしません**。下書きを開いて一言足して送るだけです。

ポイントは、**時間の計算はAIにさせない**こと。AIに「合計何時間？」を任せると平気で間違えるので、数字はGASで計算して確定させ、AIには文章化だけを頼みます。

---

## 準備

1. [script.google.com](https://script.google.com) で新しいプロジェクトを作る（スタンドアロンでOK）
2. 下のコードを貼り付けて保存
3. 「プロジェクトの設定（歯車）」→「スクリプト プロパティ」に `OPENAI_API_KEY`（sk-...）を追加
4. `REPORT_TO` を日報の宛先（上司やチームのアドレス）に書き換える
5. 関数 `createDailyReportDraft` を一度手動で実行して権限を許可 → 下書きができるか確認
6. 関数 `installTrigger` を一度実行すると、以後は毎日18時台に自動で動きます

## コード全文

```javascript
const MODEL = 'gpt-4o-mini';
const REPORT_TO = 'boss@example.com';          // 日報の宛先（下書きの宛先になるだけで、送信はしない）
const EXCLUDE_WORDS = ['私用', '休憩', 'ランチ']; // タイトルにこれを含む予定は日報に載せない
const MAX_DESC_CHARS = 200;                     // 予定の説明欄はこの文字数までAIに渡す

/** 今日の予定から日報の下書きを作ってGmailの下書きに入れる */
function createDailyReportDraft() {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return;           // 土日は作らない

  const cal = CalendarApp.getDefaultCalendar();
  const today = collectEvents_(cal.getEventsForDay(now));
  if (today.length === 0) return;               // 予定ゼロの日は作らない（課金もしない）

  const tomorrowDate = nextWorkday_(now);
  const tomorrow = collectEvents_(cal.getEventsForDay(tomorrowDate));

  const totalMin = sumMinutes_(today);          // 合計時間はコードで計算（AIに計算させない）
  const facts = buildFacts_(today, tomorrow, totalMin, tomorrowDate);
  const body = askAI_(facts) || fallbackBody_(facts);   // AIが失敗しても事実だけの日報は必ず作る

  const subject = '日報 ' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy/MM/dd');
  GmailApp.createDraft(REPORT_TO, subject, body);
}

/** 予定を {start, end, minutes, title, allDay, desc} の配列に。除外語を含む予定は捨てる */
function collectEvents_(events) {
  return events
    .filter(e => !EXCLUDE_WORDS.some(w => e.getTitle().indexOf(w) !== -1))
    .map(e => {
      const allDay = e.isAllDayEvent();
      const start = e.getStartTime(), end = e.getEndTime();
      return {
        start: start, end: end, allDay: allDay, title: e.getTitle(),
        minutes: allDay ? 0 : Math.round((end - start) / 60000),
        desc: (e.getDescription() || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_DESC_CHARS)
      };
    })
    .sort((a, b) => a.start - b.start);
}

/** 重なっている予定を二重に数えないように、時間帯をマージしてから合計する */
function sumMinutes_(items) {
  const ranges = items.filter(i => !i.allDay).map(i => [i.start.getTime(), i.end.getTime()])
    .sort((a, b) => a[0] - b[0]);
  let total = 0, curS = null, curE = null;
  ranges.forEach(([s, e]) => {
    if (curE === null || s > curE) { if (curE !== null) total += curE - curS; curS = s; curE = e; }
    else if (e > curE) curE = e;
  });
  if (curE !== null) total += curE - curS;
  return Math.round(total / 60000);
}

function nextWorkday_(d) {
  const n = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  while (n.getDay() === 0 || n.getDay() === 6) n.setDate(n.getDate() + 1);
  return n;
}

function hm_(date) { return Utilities.formatDate(date, Session.getScriptTimeZone(), 'HH:mm'); }
function dur_(min) { return Math.floor(min / 60) + '時間' + (min % 60 ? (min % 60) + '分' : ''); }

/** AIに渡す「事実」テキスト。数字はここで確定させる */
function buildFacts_(today, tomorrow, totalMin, tomorrowDate) {
  const line = i => i.allDay ? '- 終日: ' + i.title
    : '- ' + hm_(i.start) + '-' + hm_(i.end) + '（' + dur_(i.minutes) + '）: ' + i.title + (i.desc ? ' ／メモ: ' + i.desc : '');
  return [
    '【今日の予定】', today.map(line).join('\n'),
    '【予定の合計時間（重複を除く）】' + dur_(totalMin),
    '【次の営業日（' + Utilities.formatDate(tomorrowDate, Session.getScriptTimeZone(), 'M/d') + '）の予定】',
    tomorrow.length ? tomorrow.map(i => i.allDay ? '- 終日: ' + i.title : '- ' + hm_(i.start) + ' ' + i.title).join('\n') : '- 予定なし'
  ].join('\n');
}

function askAI_(facts) {
  const apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
  if (!apiKey) return null;
  const payload = {
    model: MODEL,
    temperature: 0.3,
    messages: [
      { role: 'system', content: [
        'あなたは社内日報の下書きを書くアシスタントです。',
        '与えられた「事実」だけを使い、書かれていない成果・数字・人名を足さないこと。',
        '時刻と合計時間は事実の数字をそのまま使い、計算し直さないこと。',
        '構成: 「本日の業務」（箇条書き）、「合計時間」、「明日の予定」、最後に「所感: （ここに一言）」の空欄。',
        '丁寧すぎない社内向けの敬語で、全体400字以内。'
      ].join('\n') },
      { role: 'user', content: facts }
    ]
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post', contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + apiKey },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    const code = res.getResponseCode();
    if (code === 200) return JSON.parse(res.getContentText()).choices[0].message.content.trim();
    if (code === 429 || code >= 500) { Utilities.sleep(1000 * Math.pow(2, attempt)); continue; }
    return null;                                 // 401など、再試行しても無駄なもの
  }
  return null;
}

function fallbackBody_(facts) {
  return 'お疲れさまです。本日の日報です（AI整形に失敗したため予定一覧のみ）。\n\n' + facts + '\n\n所感: ';
}

/** 毎日18時台に動くトリガーを1つだけ作る */
function installTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'createDailyReportDraft')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('createDailyReportDraft').timeBased().everyDays(1).atHour(18).create();
}
```

---

## 設計のポイント

### 1. 数字はコード、文章はAI

AIに予定一覧を渡して「合計時間も書いて」と頼むと、重なった会議を二重に足したり、30分を1時間に丸めたりします。このコードでは

- 各予定の所要時間
- **重複を除いた**合計時間（10:00-11:00 と 10:30-12:00 が重なっていれば 2時間 と数える）

をGASで確定させてから「事実」としてAIに渡し、システム指示で **「数字を計算し直さない」「書かれていない成果を足さない」** と縛っています。日報で一番まずいのは「やっていない仕事が書かれている」ことなので、ここは譲らない設計です。

### 2. 送信しない。下書きに置くだけ

`GmailApp.createDraft` なので、勝手に上司へ飛ぶことはありません。AIの文章は必ず人が一度見て、「所感」の空欄を埋めて送ります。

### 3. AIが落ちても日報は作られる

APIキー未設定・エラー・混雑が続いた場合は、**予定一覧と合計時間だけの素朴な日報**を下書きにします。「今日は下書きが無い」が起きないので、習慣が途切れません。

### 4. 載せたくない予定の除外

タイトルに「私用」「休憩」「ランチ」を含む予定は、AIにも日報にも渡しません（`EXCLUDE_WORDS` で変更可）。説明欄はHTMLタグを除去して200文字まで。**予定の説明にお客様の個人情報を書いている場合は、`MAX_DESC_CHARS` を 0 にして説明欄を送らない**運用がおすすめです。

### 5. 課金の目安

1日1回・入力は予定の一覧だけなので、`gpt-4o-mini` なら1回あたり1円未満です。土日と予定ゼロの日はAPIを呼びません。

---

## カスタマイズ例

| やりたいこと | 変えるところ |
|---|---|
| 共有カレンダー（チーム用）から作る | `CalendarApp.getCalendarById('...@group.calendar.google.com')` に置き換え |
| 宛先を複数に | `REPORT_TO` をカンマ区切りで `'a@example.com,b@example.com'` |
| 週報にする | トリガーを `.onWeekDay(ScriptApp.WeekDay.FRIDAY)` にし、`getEvents(月曜, 金曜)` で1週間分を集める |
| 17時に作る | `installTrigger` の `.atHour(18)` を `17` に |

---

## まとめ

- カレンダーの予定から、日報の下書きを毎日自動でGmailに置ける。
- **時間の集計（重複除去込み）はGAS、文章化だけAI**。書かれていない成果を足させない指示で、日報の「盛り」を防ぐ。
- 送信はしない・AIが失敗しても事実だけの下書きは必ず作る、の2点で安心して放置できる。

事務AIプロンプト12種を1ファイルにまとめたテキスト版（0円〜・投げ銭歓迎）→ [事務AIプロンプト集12種](https://feverish50.gumroad.com/l/rlalv)

Gmailに届く問い合わせにAIが下書き返信を作る（送信はしない）GAS拡張版もあります（有料・$3）→ [Gmail問い合わせAI下書き返信・GAS拡張版](https://feverish50.gumroad.com/l/koujr)

請求書PDF自動作成・議事録整形など計5本と日本語の導入ガイドを付けたセット（有料・$39）→ [そのまま動くGAS5本＋導入ガイド【PRO】](https://feverish50.gumroad.com/l/jqxenl)
