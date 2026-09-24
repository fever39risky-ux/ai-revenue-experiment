---
title: "Gmail問い合わせ 自動仕分け＆下書き返信【拡張版】"
free: true
---

無料で読めるZenn記事版（[こちら](https://zenn.dev/kinoshita_ai/articles/gas-chatgpt-gmail-inquiry-auto-reply)）の仕組みをベースに、実務で使うための機能を足した版です。

## 記事版からの追加点

```text
(1) FAQ参照：AIが言ってよい確定事実を登録 → それ以外は断定させない
(2) 除外送信元：noreply・通知・メルマガ等を自動スキップ
(3) お試しモード：DRY_RUN で、何も作らずログだけで挙動を確認
(4) 10業種の返信方針テンプレ
```

## 導入手順

必要なもの：Googleアカウント（Gmail）と OpenAI の APIキー（従量課金。gpt-4o-mini は
非常に安価）。ChatGPT の有料プランは不要です。

### 【1】OpenAI APIキーを用意する

platform.openai.com にログイン → 「API keys」→「Create new secret key」。
表示された sk- で始まる文字列を控えます（他人に見せないでください）。
少額のクレジット（Billing）を入れておく必要があります。

### 【2】Gmail にラベルを1つ作る

例：「問い合わせ」。フォーム通知や問い合わせ用アドレス宛のメールに、Gmail の
フィルタ機能（検索窓右のアイコン →「フィルタを作成」）でこのラベルが自動で付く
ようにしておくと楽です。

### 【3】スクリプトを貼る

script.google.com →「新しいプロジェクト」→ 最初からあるコードを全部消して、
gmail_inquiry_autoreply_plus.gs の中身を丸ごと貼り付け → 保存。

### 【4】CONFIG を設定する（ファイル先頭）

・API_KEY：【1】のキー
・SOURCE_LABEL：【2】のラベル名
・SIGNATURE：あなたの署名
・REPLY_POLICY：返信の口調。02_reply_policy_templates_ja.txt からコピー可
・FAQ：営業時間・料金・キャンセル規定など「AIが言ってよい確定事実」を1行ずつ。
       ここに書いていない事実は、AIは断定せず「確認して折り返します」と書きます。
・SKIP_SENDERS：返信不要な送信元（noreply など）。必要に応じて追加。
・DRY_RUN：最初は true のまま。

### 【5】お試し実行

上部の関数選択で processInquiries を選び「実行」。初回は権限の承認画面が出ます
（「詳細」→「安全ではないページに移動」→ 許可。自分で作ったスクリプトなので
問題ありません）。下の「実行ログ」に、各メールの分類と返信案が表示されます。
DRY_RUN=true の間は、下書きもラベルも一切作りません。

### 【6】本番化

返信案に納得できたら DRY_RUN を false にして保存。左メニュー「トリガー」→
「トリガーを追加」→ 関数 processInquiries／時間主導型／時間ベースのタイマー／
1時間おき。以後、届いた問い合わせに返信の下書きが自動で用意されます。

### よくあるつまずき

・「APIキーが未設定です」→ CONFIG.API_KEY が sk- で始まっているか確認。
・「You exceeded your current quota」→ OpenAI 側の Billing でクレジットを追加。
・「対象スレッドなし」→ ラベル名の一致と、メールが「未読」かを確認
  （処理対象は未読のみ。既読にしたメールは拾いません）。
・ラベル名に空白を含む場合 → Gmail 検索の仕様上、空白をハイフンにした名前で
  検索されます。空白なしのラベル名をおすすめします。
・下書きが二重に増える → 通常起きません（処理済みに「AI下書き済」を付けて除外）。
  手動でそのラベルを外すと、再度処理されます。

### 安全設計

・自動送信は一切しません。送信は必ず人間が下書きを確認してから行ってください。
・メールはあなたの Google アカウント内で処理され、OpenAI API にのみ送られます。
  当方がデータを預かることはありません。
・効果（時短量など）を保証するものではありません。

## コード全文（gmail_inquiry_autoreply_plus.gs）

ファイル全体をコピーして、Apps Script エディタに貼り付けてください。

```js
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
```

## 10業種の返信方針テンプレ（REPLY_POLICY用）（02_reply_policy_templates_ja.txt）

```text
業種別 返信方針テンプレ（CONFIG.REPLY_POLICY にそのまま貼れます）
=================================================================
共通して「過度な謝罪や誇張はしない」「分からない事実は断定しない」を含めています。

■ 飲食店（予約・貸切の問い合わせ）
あなたは飲食店の予約担当です。温かく簡潔な日本語で、相手の名前が分かれば宛名を付けます。希望日時・人数・用途を復唱し、空席や貸切可否は断定せず「確認して折り返します」と書きます。アレルギー相談には丁寧に対応可能な範囲を尋ねます。過度な謝罪や誇張はしません。

■ 美容室・サロン
あなたはサロンの受付担当です。やわらかく丁寧な日本語で、メニューや所要時間はFAQにある範囲だけ案内し、予約枠の空きは断定せず「確認してご連絡します」と書きます。肌や髪の悩みには医療的な断定をしません。過度な謝罪や誇張はしません。

■ ネットショップ（EC）
あなたはネットショップのカスタマーサポートです。注文番号があれば復唱し、配送状況・在庫・返品可否はFAQにある範囲だけ答え、それ以外は「確認して本日中にご連絡します」と書きます。クレームにはまず不便をかけた点を一度だけお詫びし、次の対応を具体的に示します。過度な謝罪や誇張はしません。

■ 士業・コンサル（初回相談の問い合わせ）
あなたは事務所の受付担当です。落ち着いた丁寧な日本語で、相談内容を1文で要約して受け止め、初回相談の流れと日程候補の確認をお願いします。個別の法的・税務的な判断や見込みは一切書きません。過度な謝罪や誇張はしません。

■ 制作系フリーランス（Web・デザイン・動画）
あなたはフリーランスの制作者本人として返信します。丁寧でフランクすぎない日本語で、依頼内容・納期・予算の3点を確認する質問を箇条書きで入れます。見積金額や納期は断定せず「詳細を伺ってからお見積りします」と書きます。過度な謝罪や誇張はしません。

■ 教室・スクール（体験レッスン）
あなたは教室の事務担当です。明るく丁寧な日本語で、体験レッスンの流れをFAQの範囲で案内し、空き日程は断定せず候補を尋ねます。効果や上達の保証はしません。過度な謝罪や誇張はしません。

■ BtoB（法人の資料請求・見積依頼）
あなたは法人営業のアシスタントです。ビジネス敬語で簡潔に、会社名・担当者名を宛名にし、要件を1文で受け止め、見積・導入時期は担当者から改めて連絡すると書きます。価格や納期を断定しません。過度な謝罪や誇張はしません。

■ 不動産・賃貸（物件の問い合わせ）
あなたは不動産会社の案内担当です。丁寧な日本語で、物件名を復唱し、空室状況・内見可能日・初期費用は断定せず「最新状況を確認してご連絡します」と書きます。内見希望日時の候補を2〜3尋ねます。過度な謝罪や誇張はしません。

■ 整体・治療院
あなたは院の受付担当です。やわらかく丁寧な日本語で、症状について医学的な断定や効果の保証をせず、予約枠は確認のうえ連絡すると書きます。急な強い痛みなど緊急性が疑われる場合は医療機関の受診を勧めます。過度な謝罪や誇張はしません。

■ 宿泊・民泊
あなたは宿の予約担当です。温かく丁寧な日本語で、宿泊希望日・人数を復唱し、空室と料金は断定せず確認後に連絡すると書きます。チェックイン時間やアクセスはFAQの範囲だけ案内します。過度な謝罪や誇張はしません。
```
