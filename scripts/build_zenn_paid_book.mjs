// Build the (unpublished) paid Zenn book from the shipped "Plus" deliverable ZIPs.
// Chapter content is taken verbatim from the ZIPs, so the book never claims more than the products do.
// Usage: node scripts/build_zenn_paid_book.mjs   (requires `unzip`)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BOOK = join(ROOT, 'books', 'gas-ai-jimu-plus-6');
const Z = 'https://zenn.dev/kinoshita_ai/articles/';

const PARTS = [
  { slug: 'gmail-inquiry-plus', zip: 'gmail-autoreply-plus-5e71d4', gs: 'gmail_inquiry_autoreply_plus.gs', free: true,
    title: 'Gmail問い合わせ 自動仕分け＆下書き返信【拡張版】', article: 'gas-chatgpt-gmail-inquiry-auto-reply',
    extras: [['02_reply_policy_templates_ja.txt', '10業種の返信方針テンプレ（REPLY_POLICY用）', 'text']] },
  { slug: 'invoice-pdf-plus', zip: 'invoice-pdf-plus-3a57e8', gs: 'invoice_pdf_ai_email_plus.gs',
    title: '請求書PDF自動作成＋AI添え状メール下書き【拡張版】', article: 'gas-invoice-pdf-ai-email',
    extras: [['02_sample_invoices.csv', 'invoices シートの見本', 'csv']] },
  { slug: 'minutes-plus', zip: 'minutes-ai-plus-4ffdaf', gs: 'minutes_ai_plus.gs',
    title: '議事録AI要約【拡張版】（TODO台帳＋期限リマインド）', article: 'gas-meeting-minutes-ai-summary', extras: [] },
  { slug: 'form-triage-plus', zip: 'form-triage-plus-347de2', gs: 'form_ai_triage_plus.gs',
    title: 'Googleフォーム問い合わせ AI仕分け＆担当者通知【拡張版】', article: null,
    extras: [['02_sample_responses.csv', '回答シートの見本', 'csv']] },
  { slug: 'sheets-ai-plus', zip: 'sheets-ai-plus-8b58ed', gs: 'sheets_ai_plus.gs',
    title: 'スプレッドシート =AI() 関数【拡張版】', article: null,
    extras: [['02_sample_feedback.csv', 'アンケート自由記述の見本', 'csv']] },
  { slug: 'calendar-report-plus', zip: 'calendar-report-plus-032cc6', gs: 'calendar_ai_report_plus.gs',
    title: 'Googleカレンダー → AI日報・週報の下書き【拡張版】', article: null, extras: [] },
];

const unzipText = (zip, name) =>
  execFileSync('unzip', ['-p', join(ROOT, 'downloads', zip + '.zip'), name], { encoding: 'utf8' }).replace(/\r\n/g, '\n').trimEnd();

// "Zenn記事版からの追加点" block of START_HERE, minus Gumroad-specific lines.
function additions(zip) {
  const t = unzipText(zip, '00_START_HERE_ja.txt');
  const i = t.indexOf('Zenn記事版からの追加点');
  let body = t.slice(i + 'Zenn記事版からの追加点'.length);
  body = body.split('\n').filter(l => !/gumroad|PRO版|ご質問は/i.test(l)).map(l => l.replace(/^ {2}/, '')).join('\n').replace(/^\n+|\s+$/g, '');
  return body;
}

// Plain-text setup guide -> markdown (keep text, drop the ==== underline title).
function guide(zip) {
  const lines = unzipText(zip, '01_setup_guide_ja.txt').split('\n');
  const out = [];
  for (let k = 0; k < lines.length; k++) {
    if (k === 0) continue; // title line
    if (/^=+$/.test(lines[k])) continue;
    const l = lines[k];
    if (/^【\d+】/.test(l)) out.push('', '### ' + l.trim(), '');
    else if (/^(よくあるつまずき|安全設計|使い方|注意|うまく動かないとき)/.test(l.trim()) && !l.startsWith(' ')) out.push('', '### ' + l.trim(), '');
    else out.push(l.replace(/^ {2}/, ''));
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

const fence = (s) => (s.includes('```') ? '````' : '```');

mkdirSync(BOOK, { recursive: true });
for (const p of PARTS) {
  const code = unzipText(p.zip, p.gs);
  const lang = 'js';
  const src = p.article ? `無料で読めるZenn記事版（[こちら](${Z}${p.article})）の仕組みをベースに、実務で使うための機能を足した版です。\n\n` : '';
  let md = `---\ntitle: "${p.title}"\n${p.free ? 'free: true\n' : ''}---\n\n${src}## 記事版からの追加点\n\n\`\`\`text\n${additions(p.zip)}\n\`\`\`\n\n## 導入手順\n\n${guide(p.zip)}\n\n## コード全文（${p.gs}）\n\nファイル全体をコピーして、Apps Script エディタに貼り付けてください。\n\n${fence(code)}${lang}\n${code}\n${fence(code)}\n`;
  for (const [f, label, l] of p.extras) {
    const t = unzipText(p.zip, f);
    md += `\n## ${label}（${f}）\n\n${fence(t)}${l}\n${t}\n${fence(t)}\n`;
  }
  writeFileSync(join(BOOK, p.slug + '.md'), md);
}

const intro = `---
title: "はじめに：この本で手に入るもの"
free: true
---

> **この本について:** 「AI Revenue Experiment」という、AI自身が実収益を出せるか試している公開実験の一環で作った本です。中身は実際に使うための Google Apps Script（GAS）6本と導入手順で、実験を知らなくても単体で使えます。

## 収録している6本

| # | スクリプト | 何が片付くか |
|---|---|---|
| 1 | Gmail問い合わせ 自動仕分け＆下書き返信 | 問い合わせを分類し、FAQに書いた事実だけで返信の下書きを作る |
| 2 | 請求書PDF自動作成＋AI添え状 | シートから連番・税率区分・源泉徴収つきの請求書PDFと添え状の下書き |
| 3 | 議事録AI要約 | 長い文字起こしから要点・決定事項・TODO、TODO台帳と期限リマインド |
| 4 | Googleフォーム問い合わせ AI仕分け | 種別・緊急度を付けて担当者へ通知、放置のリマインド、日次まとめ |
| 5 | スプレッドシート =AI() 関数 | 分類・抽出・翻訳の関数と、予算上限つきの一括処理 |
| 6 | カレンダー → AI日報・週報 | 予定から日報・週報の下書き、顧客・案件ごとの稼働時間集計 |

1本目（Gmail問い合わせ）は**無料で全文**読めます。買う前に、コードの書き方や安全設計が自分に合うか確かめてください。

## 無料の記事・本との違い

Zennの無料記事では、それぞれの仕組みを「最小構成」で解説しています。この本に入っているのは、実務で使うときに必要になる部分（お試しモード、重複防止、個人情報の伏せ字、6分制限の続き処理、API混雑時の自動リトライ、税率区分や源泉徴収など）を足した**拡張版のコード全文**と、つまずきやすい点まで書いた導入手順です。

## 必要なもの

- Googleアカウント（Gmail／スプレッドシート／カレンダー）
- OpenAI の APIキー（従量課金。gpt-4o-mini なら1件あたり数円以下が目安）。ChatGPTの有料プランは不要です

## 安全設計（6本共通）

- お客様への返信や請求書メールを**自動送信することはありません**。作るのはGmailの下書きまでで、送るのはあなたです（担当者への通知・TODOリマインドなど社内向けのメールは送ります。議事録の共有は既定で下書き、設定で直接送信にも切り替え可能）
- データはあなたのGoogleアカウント内で処理され、AIに送るのはOpenAI APIだけです。著者がデータを預かることはありません
- 最初は必ず \`DRY_RUN: true\`（お試しモード）で、ログだけを見て挙動を確かめてから本番にしてください
- 時短効果などの成果を保証するものではありません
`;
writeFileSync(join(BOOK, 'introduction.md'), intro);

const next = `---
title: "おわりに"
---

6本はそれぞれ独立して動きます。1つのApps Scriptプロジェクトに複数入れる場合は、関数名・定数名（\`CONFIG\` など）が衝突するので、スクリプトごとに別プロジェクトにするのがいちばん安全です。

## 関連する無料の本

- [GAS×ChatGPT 事務自動化 入門](https://zenn.dev/kinoshita_ai/books/gas-chatgpt-jimu-automation-primer)：APIキーの保存、429リトライ、6分制限、JSON出力の検証、費用の見積もりなど、6本すべての土台になる考え方

## 不具合を見つけたら

本のコメント欄で教えてください。修正した場合はこの本のコードを更新します（購入後も更新版を読めます）。
`;
writeFileSync(join(BOOK, 'next-steps.md'), next);

const cfg = `title: "GAS×ChatGPT 事務自動化 実務版コード集 ── 問い合わせ・請求書・議事録・フォーム・=AI()関数・日報の6本"
summary: "Google Apps Script（GAS）とChatGPT APIで事務作業を自動化するスクリプト6本の拡張版コード全文と導入手順です。Gmail問い合わせの仕分けと下書き返信、請求書PDF（税率区分・源泉徴収・連番）とAI添え状、議事録のTODO台帳化と期限リマインド、フォーム問い合わせの担当者通知、=AI()関数、カレンダーからの日報・週報。自動送信はせず、お試しモード・個人情報の伏せ字・6分制限の続き処理つき。1本目は無料で全文読めます。"
topics: ["googleappsscript", "gas", "chatgpt", "openai", "自動化"]
published: false
price: 1500
chapters:
  - introduction
${PARTS.map(p => '  - ' + p.slug).join('\n')}
  - next-steps
`;
writeFileSync(join(BOOK, 'config.yaml'), cfg);
if (!existsSync(join(BOOK, 'cover.png'))) console.log('NOTE: cover.png missing');
console.log('built', BOOK);
