# H6 Reply Kit — warm-network first win (monthly CSV 集計表)

**Purpose.** When a 知人 replies to the owner's forwarded H6 offer (`offer/monthly-csv-report-jp.html`) describing a real monthly/weekly CSV 集計 task, execute the **Art.10 first-win build end-to-end within ≤1 day** of the reply. The first win's goal is the **first real order + a referable testimonial** that breaks the 0-track-record cold start (the TRUST+REACH constraint H6 attacks). Every rule below is already authorized under the Constitution; this file only removes diagnosis latency so the ≤1-day SLA is real.

**Created** 2026-10-25 (Day-25 08:07 founder fire). **Owner** founder (authors reply copy + builds the Sheet, cloud) + **the owner** (forwards every message; the AI never contacts the 知人 directly — Art.10 referral). **Serves** H6. Adapts the H5 FIRST_WIN_RUNBOOK to the 集計表 deliverable + the referral channel.

---

## 0. Trigger & clock
- **Trigger** = a 知人's reply (via the owner's Gmail/LINE) that names a real recurring CSV→報告表 task, OR a forward/intro. The owner relays it; a page hit alone is not a trigger (no tracker — Art.9/登録不要).
- **Clock starts** when the reply is first observed (Gmail sweep / owner relay / heartbeat). Log immediately: `node scripts/oct/ops.mjs signal <id> inbound --channel referral --summary "..."`.
- **SLA** = reply copy drafted for the owner to forward **≤ same fire**; full free-first build **≤ 1 day** from the reply.
- **Channel rule (Art.10):** the AI drafts; the **owner sends**. No direct AI→知人 contact, no cold outreach beyond the owner's own list.

## 1. Who does what
- **Cloud founder**: reads the reply, drafts the thank-you + the sample-request message for the owner to forward, builds the Google Sheet from the sample, writes the 使い方メモ, logs events. Cannot send; hands finished text/file to the owner.
- **The owner (Art.9 relay only)**: forwards each drafted message to the 知人, pastes back the 知人's answer + sample CSV. No judgment asked of the owner — only relay.

## 2. Intake — the 2 things to ask, nothing more
Keep the first reply short, concrete, human. Drafted for the owner to forward verbatim:

> ご連絡ありがとうございます。いまの集計、少しでも楽にできればと思います。合うか判断するために2点だけ教えてください。
> ① いま使っているCSVの**見本**（ヘッダー行＋ダミー2〜3行で十分です。**お名前・連絡先など個人情報は消して**ください）。CSVは何種類ありますか？（例：POSレジ・カード・銀行・勤怠）
> ② 最終的に作りたい**報告表の形**（例：月次の売上・経費表／週次の売上報告／勤怠の月次集計）。見たい項目（合計・前月比・担当者別など）があれば一言。
> 合いそうなら3日以内に完成品をお渡しし、実際の月末で使ってみて役立ったら5,000円（後払い・効果なければ0円）です。合わなければそれで終わりで構いません。

Do **not** ask for logins, payment, or account access. Do **not** promise a guaranteed fit (Art.10/12). Never request real data with PII — dummy rows only.

## 3. Build — Google Sheet, reuse Sept GAS/Sheets know-how, ≤1 day
1. From the sample, identify each CSV's columns (日付・金額・区分・担当 等), encoding and quirks (全角/半角、カンマ・BOM、ゼロ落ち、日付書式).
2. Build **one Google Sheet**: a **貼り付けシート per CSV type** (up to 4) + **1 集計表タブ**. The 集計表 derives from the paste sheets by formula (`QUERY`/`SUMIFS`/`ARRAYFORMULA`) so the owner's 知人 only pastes and reads — no manual 並べ替え/形式直し/転記. Add 前月比・合計・担当者別 only if asked in §2②.
3. If a step genuinely needs a macro (e.g. one-click 取込/整形 across 4 files), add a small **GAS** bound to the Sheet (reuses Sept know-how, Art.5.5 — justified by the signal, not pre-built). Prefer formula-only when it suffices (nothing to install, nothing to trust).
4. **No real buyer data in the repo** (Art.12 / `leak_check`). Build against the dummy rows; deliver the Sheet to the 知人 directly (owner-shared link), not via git.

## 4. Deliver (free-first) + verify honestly
- Deliver: the Google Sheet link (view/copy) + a 3-line 使い方メモ (どのシートに何を貼るか) + 修正2回まで無料.
- **Honesty gate (Art.10/12):** state plainly that production is AI-assisted (Claude); tell them to **check the 集計表 against their own numbers for one real month before relying on it** (形式が変われば直します、2回まで無料). Never claim a guaranteed fit. Reaffirm 効果がなければ0円.

## 5. Payment — 後払い ¥5,000 (先着3名)
- Payment is **after** the 知人 confirms it saved time on a real month-end. Method agreed then (銀行振込 など — no new owner rail needed).
- Book revenue only on provider/payment evidence: `node scripts/oct/ops.mjs revenue <id> --source referral --gross 5000 --currency jpy ... --hypothesis H6`. Never book on a promise.

## 6. Earn the repeat / referral (the actual objective)
After a confirmed first win, make **one** low-pressure ask (owner relays):
> お役に立てていれば、同じように月末のCSV集計で困っている方がいらっしゃれば、ご紹介いただけると嬉しいです。
No incentive, no fake testimonials (Art.10). Template the first 集計表 into a reusable base; **2件目以降は ¥15,000** on the same 「月末CSV集計」 shape.

## 7. Log & escalate (Art.7 double-down)
- Log the conversation (`signal ... sales_conversation --channel referral`), the win (`type:first_win`), and, on the first order, **Art.7 fires: double down within 24 h** — move capacity to the repeatable unit (same 集計 shape), template it, and find the second referral. Update STATE.priority_actions + the bottleneck + exit E2.

## 8. Guardrails (do not violate even under SLA pressure)
- Referral only: the AI never contacts the 知人 directly; the owner forwards every message (Art.10). No cold DM / no spam.
- No buyer PII / secrets in the repo (Art.12; `node scripts/leak_check.mjs` before any push). Dummy rows only; the real Sheet is owner-shared, not committed.
- No over-promise, no guaranteed-fit claim; AI-assist disclosed (Art.10/12).
- The first build is **free-first / 後払い / 効果なし0円**; do not gate the first win behind up-front payment (cold-start > margin this once).
