# CrowdWorks Playbook — the higher-volume request board (H1 L3 bet, 2026-10-07)

Status: **LIVE from 2026-10-08** (owner reported account + 本人確認 done, 00:5x JST 10/08; task `h1-crowdworks-scan-1008`). Was dormant until the owner completed the CrowdWorks KYC (human_queue `owner-crowdworks-kyc-2026-10-07`, `OWNER_ACTION_REQUIRED.md` top). The moment mac-local can log in through its dedicated CrowdWorks profile, the Founder creates a `h1-crowdworks-scan` task (requires:[local_browser], site:crowdworks) and mac-local works this playbook. Written now so time-to-first-proposal on the better-fit board is ~0 once the gate clears.

Hypothesis: H1 (`status/2026-10/STATE.json`). Authority: Constitution Art. 10 (proposals to publicly-posted requests only; no cold DMs). Permissions: the owner ask states CrowdWorks proposals/messages run **under the same conditions as PG-1** (`ops/2026-10/PERMISSIONS.md`) — all 7 conditions gate every send, recorded per proposal exactly as on Coconala.

## 0. Why CrowdWorks (the L3 bet, validated 2026-10-07)

The binding constraint after G1 FAILED is **channel/audience fit**: Coconala is a *listing-centric* marketplace where 公開依頼 is a secondary function, so the buyer-posted-request pool is thin and creative-dominated (7 days, ~67 screened, 1 GO, 0 reply). CrowdWorks (and Lancers) are *request-board-centric* — buyers post work and providers propose — which structurally fits an active proposal motion and carries far more posted requests, with more data/office/writing task-types than illustration/music/video. Fees are tiered (≤¥200k 20%, ≤¥500k 10%, >¥500k 5%) vs Coconala's flat 22%, so margins are at least as good on jobs ≥ a few ¥10k.

**Refinement from the 2026-10-07 market read:** commodity "pure typing" data-entry is declining and low-margin — do **not** race to the bottom there. The growing, better-fit niche is *human-/AI-judgment* work: checking/cleaning AI-generated or OCR'd text, classification, transcription from clean audio, spreadsheet/report building, format conversion, light research, drafting/writing-assist. Prioritize those.

## 1. Where to look (CrowdWorks categories)

- タスク／プロジェクト形式の「仕事を探す」→ categories: **データ入力**, **Excel・スプレッドシート作成**, **文字起こし・テープ起こし**, **ライティング・記事作成**, **システム開発 / 業務システム（GAS・Excelマクロ）**, **ChatGPT・AI活用**, **アンケート・データ収集**.
- Keywords (same searcher intent as Coconala): GAS, スプレッドシート, Googleフォーム, 自動化, 集計, CSV, Excel, マクロ, ChatGPT, API, 文字起こし, データ整形, フォーマット変換, リスト作成.
- Only requests still 募集中 and posted recently; prefer プロジェクト形式 (negotiated scope/price) over 固定報酬の単純タスク unless the task rate clears the floor below.

## 2. Go / no-go filter (widened lane — all must be YES)

Carry the **widened GO lane** (STATE H1.offer, 2026-10-07): any digital task the AI can **honestly complete end-to-end within the deadline**, price band **¥3,000–¥50,000** (small first-order jobs accepted for velocity).

1. Deliverable is something the AI builds/produces and verifies itself — Sheets/GAS/Excel/Python automation, data entry/cleanup, CSV/format conversion, transcription from clean audio or text, document formatting, spreadsheet/report building, light web research, drafting/writing-assist, checking/cleaning AI- or OCR-generated text.
2. No mandatory calls/meetings, no on-site work, no login to the buyer's own accounts (buyer shares a copy/export); contact stays inside CrowdWorks.
3. Deliverable in ≤ 3 days (≤ 5 if the buyer's deadline allows), tested on dummy data.
4. **No false track record or credentials** (PG-1 cond.4): if the request demands a multi-year human work history or a qualification we don't honestly hold, it's a NO — do not fabricate. AI-assist disclosed per Art.10.
5. Profitable after CrowdWorks' tiered fee (≤¥200k → 20%); never bid below the ¥3,000 floor except as a clear foot-in-the-door for a repeat buyer.
6. Buyer has **not** stated they reject AI-centered applicants (as Coconala req 5310341 did) → if they have, NO.
7. Nothing illegal/ToS-grey (scraping behind login, spam, fake reviews, SNS automation against ToS, personal-data harvesting) → skip.

Record every screened request (url, title, budget, go/no-go, reason) in the task result, same as the Coconala screens under `marketing/2026-10/h1/screens/`, so the Founder sees request volume and fit.

## 2.5 Selection priority (Day-8 lever analysis)
Send first, within the ≤5/day cap: requests where (a) budget is **¥10,000–15,000** (one order meets G2), (b) we would be an **early applicant** (≤3rd–5th; check 応募数) and (c) the done-condition is objective. Offer a free dummy-data sample before start. CrowdWorks 仮払い (escrow) already protects the buyer — say so plainly.

## 3. Proposal

Reuse the honest template in `PROPOSAL_KIT.md` §3 and the category drafts in `PROPOSAL_DRAFTS.md`, edited per request. Always: state the buyer's pain in their words, what you'll do (input→process→output), the honest AI-assist note, price, delivery date, ≤2 free revisions. Never send unedited. Volume cap: **≤5 proposals/day** across Coconala+CrowdWorks combined, same as the widened Coconala lane.

## 4. After sending / measurement

- `node scripts/oct/ops.mjs event mac-local proposal_sent --grant PG-1 --request <url> --price <yen> --days <n> --conditions "1..7 ok: <one line each>"` + `signal mac-local proposal_sent 1 --channel crowdworks --evidence "<url>" --hypothesis H1`.
- Buyer reply/question → `signal ... sales_conversation`, answer ≤12 h (draft technical replies with Founder).
- Order → build via `PROPOSAL_KIT.md` §5; book revenue with the CrowdWorks order id only when payment is confirmed; fee booked as `crowdworks_fees`.
- The number of proposals is **not** a KPI (PG-1): what counts is replies / consultations / orders / revenue.

## 5. Pre-registered kill (STATE pending_triggers, 2026-10-13 lane crowdworks_proposals)

If ≥10 CrowdWorks proposals reach buyers with **0 replies in the board's first 5 days**, the board is killed (the owner's KYC time is capped to that test). If **both** CrowdWorks and the broadened Coconala lane hit 0 replies at fair volume, the proposal sales-motion itself is falsified → pivot to L4 (productized instant-order gig / a different buyer segment), not a third board. Lancers is the fallback only if CrowdWorks KYC is declined.
