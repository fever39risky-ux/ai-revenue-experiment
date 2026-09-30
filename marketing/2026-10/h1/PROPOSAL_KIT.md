# H1 Proposal Kit — responding to buyer-posted requests (Coconala 公開依頼 first)

Hypothesis H1 (`status/2026-10/STATE.json`). Authority: Constitution Art. 10 (proposals to requests buyers posted publicly; no cold DMs).
Users: `mac-local` (browses, sends, handles talk room) and `founder` (selection review, builds deliverables).

## 1. Where to look (Coconala)
- 公開依頼一覧 → categories: 「IT・プログラミング」内の 業務効率化・自動化 / GAS / Excel・スプレッドシート / データ入力・整理 / ChatGPT・AI活用.
- Keywords: GAS, スプレッドシート, Googleフォーム, 自動化, Gmail, ChatGPT, API, Excel, マクロ移行, 集計, CSV, 請求書.
- Only requests posted ≤ 7 days ago and still 募集中.

## 2. Go / no-go filter (all must be YES)
1. Deliverable is code/sheets/docs the AI can build and test itself (GAS, Sheets formulas, Apps Script triggers, Python/CSV transforms, prompt design, ChatGPT API via GAS).
2. No mandatory calls/meetings, no on-site work, no access to the buyer's accounts that requires the owner's identity beyond the Coconala talk room (buyer can share a copy of a sheet).
3. Can deliver in ≤ 3 days (≤ 5 if the buyer's deadline allows) with a test on dummy data.
4. Budget ≥ ¥3,000 (below that only if it's a clear foot-in-the-door for a repeat buyer).
5. Nothing illegal/ToS-grey (scraping behind login, spam tools, fake reviews, SNS automation against ToS, personal-data harvesting) → skip.

Record every screened request (url, title, budget, go/no-go, reason) in the task result so the Founder can see request volume and fit.

## 3. Proposal template (edit per request — never send it unedited)

> Faster path: `marketing/2026-10/h1/PROPOSAL_DRAFTS.md` has category-ready drafts (Sheets-AI / CSV集計 / Gmail・Form) — pick the closest and edit only the `{...}` specifics.


```
〇〇様

ご依頼内容を拝見しました。「{相手の課題を相手の言葉で1文}」を、{GAS/スプレッドシート関数 等}で自動化するご提案です。

■ ご提案内容
・{やること1（入力→処理→出力）}
・{やること2}
・動作確認済みのスクリプト／シートと、設定手順書（画像付き）をお渡しします

■ 進め方
1. サンプルデータ（個人情報を除いたコピーで結構です）をいただく
2. {N}日以内に動くものを納品 → ご確認
3. 修正は{2}回まで無料

■ 金額・納期
{金額}円（税込）／{N}日

■ 補足（正直にお伝えします）
・制作にはAIを活用しており、その分お見積りを抑えています。動作確認・説明は責任を持って行います。
・{できないこと／前提条件があれば1行}

ご不明点があれば、お気軽にご質問ください。
```

Pricing guide: simple single-function script ¥5,000–8,000; form/Gmail/Sheets flow with triggers ¥10,000–15,000; ChatGPT API integration or multi-sheet aggregation ¥15,000–30,000. Stay at or slightly under the buyer's stated budget; never bid ¥0/loss-leader below ¥3,000.

## 4. After sending
- `node scripts/oct/ops.mjs signal mac-local proposal_sent 1 --channel coconala --evidence "<request url>" --hypothesis H1`
- Replies/questions from the buyer → `signal ... sales_conversation` and answer within 12 h (draft with Founder if technical).
- Order → build via §5, book revenue with the Coconala order id when payment is confirmed, fee as `coconala_fees`.

## 5. Delivery pipeline (Founder)
1. Reproduce the buyer's sheet structure with dummy data (in repo under `marketing/2026-10/h1/jobs/<job-id>/`, **no buyer PII**).
2. Build the script from `downloads/ai-automation-toolkit-v2-*.zip` patterns (API-key storage in Script Properties, 429 retry, 6-minute limit batching).
3. Test with node/GAS-emulation where possible; write 手順書 with screenshots-in-text.
4. Hand off to `mac-local` for delivery in the talk room; log `done`.
