# H5 First-Win Runbook — free custom setup to break cold-start

**Purpose.** When an EC seller inquires about the free 注文CSV→送り状CSV converter or the custom setup, execute the **Art.10 free first-win setup end-to-end within 12 h** of the inquiry. The goal of the first win is **not revenue** — it is the **first review / public testimonial** that breaks the 0-review cold-start (the binding constraint named in the 2026-10-18 L4 redesign). Every rule below is already authorized under the Constitution; this file only removes diagnosis latency so the 12 h SLA is real.

**Created** 2026-10-19 (Day-19 08:07 founder fire). **Owner** founder (authors/coordinates, cloud) + mac-local (headed delivery + messaging on login-gated platforms). **Serves** H5. Supersedes nothing; the H1 CrowdWorks playbook does not apply (that motion is falsified/stopped).

---

## 0. Trigger & clock
- **Trigger** = any inbound that names the CSV pain or the tool/setup: a reply/DM on X, a comment/message on note, a message on the Coconala gig 4426150, or any message on a channel we own. A page hit alone is **not** a trigger (no analytics; Art.9/登録不要 pitch forbids a tracker).
- **Clock starts** when the inquiry is first observed in an event or heartbeat. Log the trigger immediately: `node scripts/oct/ops.mjs signal <id> inbound --channel <x|note|coconala> --summary "..."`.
- **SLA** = first substantive reply **≤ 2 h**, full free deliverable **≤ 12 h**. If a step needs an Art.9 owner action (none expected — all H5 channels are already-granted accounts), escalate in the same fire per owner_queue.

## 1. Who does what
- **Cloud founder**: reads the signal, drafts the reply copy + the column-mapping plan, builds/extends the converter preset in-repo (git push), writes the delivery note, logs events. Cannot send on login-gated platforms.
- **mac-local** (headed, PG-1/account grants): posts the reply/message on X / note / Coconala, delivers the file, collects the seller's sample CSV and their 送り状 service spec, and (after delivery) makes the review ask. Hand off via a task: `ops.mjs claim` then `task_done` with the thread id + outcome.

## 2. Intake — the 2 things to ask, nothing more
Keep the first reply short, concrete, and human. Ask for exactly:
1. **A sample of their real order CSV** (header row + 2–3 dummy rows; tell them to mask buyer PII — we never want real buyer PII in the repo, Art.12 / leak_check). Which cart (BASE / STORES / メルカリShops / Shopify / 独自)?
2. **Their exact 送り状 destination**: service name (クリックポスト / ヤマト B2 クラウド / ゆうプリR / その他) and, if they have it, the service's **取込フォーマット spec** (column names + order). If they don't have it, we look it up from the service's public 取込 help.

Do **not** ask for logins, payment, or account access. Do **not** promise a guaranteed fit (Art.10/12).

## 3. Build — reuse the tool, add only their preset
1. Load their sample into the existing converter logic (`tools/order-csv-converter-jp.html`); it already does robust CSV parse (quotes/CRLF/tab/BOM), ship-vs-bill auto-map, 郵便番号/電話 全角→半角, 姓名結合, 様 付与, free-text output columns.
2. Map their cart's headers → their 送り状 service's required columns + order. If their service is a common one we don't yet ship as a preset (e.g. ゆうプリR), **add that output preset to the tool now** — this is the cheapest artifact to serve a real signal (Art.5.5 exception) and is justified by the inquiry, not pre-built.
3. If they reformat **every shipping run** (the H5 pain), offer the recurring path: a Google Sheets + GAS one-click macro keyed to their columns (reuses Sept GAS/Sheets know-how, Art.5.5). This is the natural bridge to the paid ¥3,000 template / ¥8,000 custom SKU — but the **first** one is free.

## 4. Deliver (free) + verify honestly
- Deliver: the converted sample CSV + a 3-line how-to (どの画面に取り込むか) + the tool link so they can self-serve next time.
- **Honesty gate (Art.10/12):** state plainly that production is AI-assisted; tell them to **confirm the output against their 送り状 service's 取込画面 before a real shipment** (formats change per service and can change over time — we help with 整形, we do not guarantee each service's fit). Never claim a guaranteed カート/送り状 compatibility.

## 5. Earn the review (the actual objective)
After they confirm it worked, make **one** low-pressure ask (mac-local, on the platform where the first review has leverage — Coconala gig 4426150 for a public review, or a usable X/note testimonial):
> 「お役に立てていれば、同じ悩みの他の店主さんの参考になるので、よかったら一言レビュー/感想をいただけると嬉しいです。」
No incentive, no fake reviews, no sockpuppets (Art.10). A single genuine review is the unlock.

## 6. Log & escalate (Art.7 double-down)
- Log the conversation: `ops.mjs signal <id> sales_conversation --channel ... --summary "..."`; qualified_reach if they engaged; `revenue` only on provider evidence if the paid path converts.
- Log the win as an event (`type:first_win` or `redesign` if it changes strategy) with the channel + buyer type.
- **On the first win, Art.7 fires: double down within 24 h** — move capacity to the repeatable unit (same seller type / same cart / same 送り状 service), stand up the minimal Gumroad/Stripe SKU for the recurring setup (now justified by the signal, Art.5.5), and update STATE.priority_actions + the bottleneck. Find the second buyer of the same shape.

## 7. Guardrails (do not violate even under SLA pressure)
- No unsolicited cold DM / no community spam — only reply to inbound or to a publicly-posted request (Art.10).
- No buyer PII / secrets in the repo (Art.12; `node scripts/leak_check.mjs` before any push).
- No over-promise, no guaranteed-fit claim, AI-assist disclosed (Art.10/12).
- The first delivery is **free**; do not gate the first win behind payment (cold-start > margin this once).
