# H1 Proposal Kit — responding to buyer-posted requests (Coconala 公開依頼 first)

Hypothesis H1 (`status/2026-10/STATE.json`). Authority: Constitution Art. 10 (proposals to requests buyers posted publicly; no cold DMs).
Users: `mac-local` (browses, sends, handles talk room) and `founder` (selection review, builds deliverables).

> **WIDENED LANE in force (2026-10-07 redesign).** G1 FAILED; the narrow automation-only lane was supply-starved (~67 screened, 1 GO in 7 days). The GO lane is now **any digital task the AI can honestly complete end-to-end within the deadline**, price band **¥3,000–¥50,000**. The §2 filter below reflects this. For the CrowdWorks board use `CROWDWORKS_PLAYBOOK.md` (same widened lane, board-specific).

## 1. Where to look (Coconala)
- 公開依頼一覧 → categories: 「IT・プログラミング」内の 業務効率化・自動化 / GAS / Excel・スプレッドシート / データ入力・整理 / ChatGPT・AI活用, **plus** データ入力・リスト作成 / 文字起こし / 資料作成・フォーマット整形 / ライティング・記事作成 / リサーチ.
- Keywords: GAS, スプレッドシート, Googleフォーム, 自動化, Gmail, ChatGPT, API, Excel, マクロ移行, 集計, CSV, 請求書, データ入力, 文字起こし, データ整形, フォーマット変換, リスト作成, リサーチ, 記事, 校正.
- Only requests posted ≤ 7 days ago and still 募集中.

## 2. Go / no-go filter — WIDENED lane (all must be YES)
1. Deliverable is something the AI can build/produce and verify itself: code/sheets/docs (GAS, Sheets formulas, Apps Script triggers, Python/CSV transforms, prompt design, ChatGPT API via GAS) **OR** data entry/cleanup, CSV/format conversion, transcription from clean audio or text, document formatting, spreadsheet/report building, light web research, drafting/writing-assist, checking/cleaning AI- or OCR-generated text.
2. No mandatory calls/meetings, no on-site work, no access to the buyer's accounts that requires the owner's identity beyond the Coconala talk room (buyer can share a copy of a sheet).
3. Can deliver in ≤ 3 days (≤ 5 if the buyer's deadline allows) with a test on dummy data.
4. **No false track record or credentials** (PG-1 cond.4): if the request demands a multi-year human work history or a qualification we don't honestly hold, it's a NO — do not fabricate. If the buyer explicitly rejects AI-centered applicants, NO.
5. Budget ≥ ¥3,000 (below that only if it's a clear foot-in-the-door for a repeat buyer); profitable after Coconala's 22% fee.
6. Nothing illegal/ToS-grey (scraping behind login, spam tools, fake reviews, SNS automation against ToS, personal-data harvesting) → skip.

Record every screened request (url, title, budget, go/no-go, reason) in the task result so the Founder can see request volume and fit. Cap: ≤5 proposals/day across Coconala+CrowdWorks combined.

## 2.5 First-win tactics for a 0-review seller (operationalizes the 10/07 trust finding)
Our single biggest handicap is **0 reviews** — on equal offers a buyer picks the seller with a track record. Until the first review exists, among the GO requests **prioritize and win the ones where that handicap is smallest**, and reverse the buyer's risk honestly:
- **Prioritize (send first, within the ≤5/day cap):** requests with **few existing applicants** (you are 1st–3rd, not 50th), **small clear scope** with an objective done-condition (a buyer can verify the deliverable themselves — a formula works, a sheet matches, a transcript is accurate), and **budget ≤ ¥10,000**. These are where a new seller actually converts; a ¥3,000 first win that earns a review is worth more than a ¥30,000 bid lost to a reviewed competitor. (High-budget/crowded requests stay GO but are lower priority.)
- **Reverse the risk in the proposal (all honest, PG-1 cond.4 intact):** lead the 正直 paragraph with a concrete guarantee the buyer can hold us to — e.g. *"先に無料サンプル（ダミーデータ1件分）をお見せし、ご納得いただいてから着手します"* or *"確認後のお支払いで結構です / 修正無料"*. Never claim reviews, experience, or results we don't have; compete on **de-risked delivery**, not on a fake track record.
- Still cap at ≤5/day and log each `proposal_sent` with conditions 1–7 as usual.

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
