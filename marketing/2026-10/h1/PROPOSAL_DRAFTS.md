# H1 Proposal Drafts — category-ready, edit-only-the-specifics

Purpose: cut proposal send-time so `mac-local` can hit the H1 leading metric (**10 proposals by 10/03**).
Each draft below is a filled version of the `PROPOSAL_KIT.md` §3 template for a common 公開依頼 category.
**Pick the closest, then edit the `{...}` and the 1-line 相手の課題 to the actual request. Never send unedited**
(Constitution Art. 10: honest, no over-promise, AI-assisted disclosed). Go/no-go filter (PROPOSAL_KIT §2) first.

After sending each: `node scripts/oct/ops.mjs signal mac-local proposal_sent 1 --channel coconala --evidence "<request url>" --hypothesis H1`.

Delivery is READY: `marketing/2026-10/h1/delivery/` (kit + reuse map). Quote the deadline you can actually hit (≤3 days).

---

## A. スプレッドシートでChatGPTを使いたい（要約 / 分類 / 抽出 / 翻訳）
Base to deliver: `marketing/jp_deliverable/single_sheets_ai_src/sheets_ai_plus.gs`. Buyer supplies their own OpenAI key.

```
〇〇様

ご依頼を拝見しました。「{例: 問い合わせ内容を要望／不満／質問に自動で仕分けたい}」を、Googleスプレッドシート上でChatGPTを呼び出す関数（GAS）で自動化するご提案です。

■ ご提案内容
・セルに =AI("30文字で要約", A2) のように書くだけで処理できる関数を導入
・=AI_CLASSIFY（選択肢から1つに分類）／=AI_EXTRACT（項目を横に抽出）/ =AI_TRANSLATE（翻訳）も同梱
・月の予算上限を設定でき、超えたらAPIを呼ばない安全設計。個人情報（メール/電話/郵便番号）を伏せてから送るオプション付き

■ 進め方
1. 対象シートの列構成をトークルームで共有いただく（サンプルはダミーで結構です）
2. {2}日以内に動くスクリプト＋手順書（画像つき）を納品 → ご確認
3. 修正は{2}回まで無料

■ 金額・納期
{10,000}円（税込）／{2}日

■ 補足（正直にお伝えします）
・制作にはAIを活用しており、その分お見積りを抑えています。動作確認・説明は責任を持って行います。
・ChatGPTのAPIキーはお客様ご自身のものをご登録いただきます（当方はお預かりしません／API利用料は別途お客様負担・上限設定可）。

ご不明点があればお気軽にご質問ください。
```

## B. CSV / Excel のデータ整理・集計（AI不要・追加費用なし）
Base to deliver: `marketing/2026-10/h1/delivery/jobs/example-csv-aggregate/` (transform tested 7/7 on dummy data).

```
〇〇様

ご依頼を拝見しました。「{例: 書式がバラバラな経費CSVを月ごと・カテゴリごとに集計したい}」を自動化するご提案です。

■ ご提案内容
・日付や金額の表記ゆれ（¥や空白、2026/09/03 と 2026-9-15 の混在など）を吸収して集計
・空行・不完全な行は自動で除外し、除外件数もお知らせ
・スプレッドシートのメニューから1クリックで「月×カテゴリの合計・件数」を出力

■ 進め方
1. 実際の列構成をトークルームで共有（個人情報を除いたコピーで結構です）
2. {2}日以内に動くスクリプト＋手順書を納品 → ご確認
3. 修正は{2}回まで無料

■ 金額・納期
{6,000}円（税込）／{2}日

■ 補足（正直にお伝えします）
・制作にはAIを活用しており、その分お見積りを抑えています。
・外部APIを使わないため、追加の月額費用はかかりません。ダミーデータで動作確認のうえ納品します。

ご不明点があればお気軽にご質問ください。
```

## C. Gmail / Googleフォーム の自動化（自動返信・仕分け・通知）
Base to deliver: `single_gmail_src/gmail_inquiry_autoreply_plus.gs` or `single_form_src/form_ai_triage_plus.gs`.

```
〇〇様

ご依頼を拝見しました。「{例: 問い合わせフォームの回答を内容ごとに自動で仕分けて担当に通知したい}」を、Google Apps Scriptで自動化するご提案です。

■ ご提案内容
・{フォーム送信時／受信メール}をトリガーに、内容を判定して {ラベル付け／自動返信の下書き／通知} を実行
・{ChatGPTで内容を分類する場合はその旨}。誤判定を避けるため、確定送信の前に下書き段階を挟む設計も可能
・設定手順書（画像つき）をお渡しします

■ 進め方
1. 現在の運用（フォーム項目／メールの種類）をトークルームで共有
2. {3}日以内に動くものを納品 → ご確認
3. 修正は{2}回まで無料

■ 金額・納期
{12,000}円（税込）／{3}日

■ 補足（正直にお伝えします）
・制作にはAIを活用しており、その分お見積りを抑えています。動作確認・説明は責任を持って行います。
・お客様のGoogleアカウントでの承認が一度必要です（お客様のデータのみにアクセスします）。{AI利用時: APIキーはお客様のものをご登録}

ご不明点があればお気軽にご質問ください。
```

---

### Pricing quick reference (PROPOSAL_KIT §3)
- simple single-function script: ¥5,000–8,000
- form / Gmail / Sheets flow with triggers: ¥10,000–15,000
- ChatGPT API integration or multi-sheet aggregation: ¥15,000–30,000
- Stay at or slightly under the buyer's stated budget; never below ¥3,000.

### Do-not-bid (skip, per PROPOSAL_KIT §2)
Mandatory calls/meetings, on-site, access needing the owner's identity beyond the talk room, scraping behind login,
spam/SNS-automation against ToS, fake reviews, personal-data harvesting, or anything we cannot fully deliver+test.
