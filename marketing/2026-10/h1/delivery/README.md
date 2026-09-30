# H1 Delivery Pipeline — ship a won job in ≤3 days

Hypothesis **H1** (`status/2026-10/STATE.json`): done-for-you automation jobs answered from Coconala 公開依頼.
This folder is the **reusable delivery pipeline** so that when `mac-local` wins a job, `founder` can build,
test and hand back a working deliverable within 3 days without inventing the process each time.

Companion doc: `marketing/2026-10/h1/PROPOSAL_KIT.md` (how we find and bid). This is what happens **after** a bid turns into a job.

## The 5 steps (from "buyer said yes" to "done")

1. **Intake** — copy `jobs/_TEMPLATE/` to `jobs/<job-id>/` and fill `INTAKE.md`. Capture scope, deadline, price,
   and the buyer's sheet/data *structure* — **never buyer PII** (`node scripts/leak_check.mjs` must stay green).
   Ask the buyer for a **de-identified copy** or synthetic sample in the talk room; if they send real data with PII,
   reproduce the structure with dummy data here and keep their file out of the repo.
2. **Pick the base** — map the job to an existing September script (see *Reuse map* below). We almost never start
   from scratch (Constitution Art. 5.5: existing supply is reusable). Copy the `.gs`/logic into the job folder and adapt.
3. **Build + test on dummy data** — put synthetic input under the job folder, run the transform, and assert the
   output with a test you can actually run in this runtime (`node .../test.mjs`). Pure-logic parts (parsing,
   cleanup, aggregation, formatting, classification rules) are node-testable; GAS-only glue (triggers, Gmail,
   Drive) is verified by a checklist in `templates/ACCEPTANCE_CHECK.md`, not guessed.
4. **手順書 (setup guide)** — fill `templates/TEJUNSHO.md` → `jobs/<job-id>/TEJUNSHO.md`: exact steps the buyer
   follows to install and run it (拡張機能 → Apps Script, paste, API key in Script Properties, run once, authorize).
   Screenshots-in-text (describe the button/menu), because we deliver as files, not a live screen-share.
5. **Hand off** — write `jobs/<job-id>/DELIVERY_MESSAGE.md` from `templates/DELIVERY_MESSAGE.md`, hand the job to
   `mac-local` for talk-room delivery (`ops.mjs handoff` / a delivery task), then `ops.mjs event ... done`.
   Book revenue only on the Coconala order id when payment is confirmed; fee as `coconala_fees` (Constitution Art. 11).

## Reuse map — job type → existing base script

| Buyer asks for… | Base (reuse) | Notes |
|---|---|---|
| Spreadsheet cell that calls ChatGPT (要約/分類/抽出/翻訳) | `marketing/jp_deliverable/single_sheets_ai_src/sheets_ai_plus.gs` | `=AI()`, `=AI_CLASSIFY()`, `=AI_EXTRACT()`, `=AI_TRANSLATE()`; budget cap + PII mask built in |
| Google Form → auto-triage/route replies | `marketing/jp_deliverable/single_form_src/form_ai_triage_plus.gs` | on-submit trigger |
| Gmail auto-reply / inquiry routing | `marketing/jp_deliverable/single_gmail_src/gmail_inquiry_autoreply_plus.gs` | label + draft/send |
| Invoice PDF from a sheet + email | `marketing/jp_deliverable/single_invoice_src/invoice_pdf_ai_email_plus.gs` | PDF + Gmail |
| Meeting minutes summarization | `marketing/jp_deliverable/single_minutes_src/minutes_ai_plus.gs` | paste transcript → summary |
| Calendar → activity report | `marketing/jp_deliverable/single_calendar_src/calendar_ai_report_plus.gs` | weekly/monthly rollup |
| Multi-function pack (Gmail+Invoice+Minutes) | `marketing/jp_deliverable/pro_src/*.gs` | bundle for larger budgets |
| **CSV / Excel データ整理・集計** (no API needed) | `jobs/example-csv-aggregate/transform.mjs` (this kit) | pure transform; node-testable; cheapest, fastest turn |

If a job needs the ChatGPT API, the buyer supplies **their own** OpenAI key (stored in *their* Script Properties);
we never put an API key in the repo. Pricing per `PROPOSAL_KIT.md` §3.

## Worked example (proof this pipeline runs end-to-end)

`jobs/example-csv-aggregate/` — a representative "CSV データ整理・集計" job:
messy sales CSV → cleaned + monthly aggregation by category. Fully synthetic data, no PII.

```
node marketing/2026-10/h1/delivery/jobs/example-csv-aggregate/test.mjs
```

The test builds the output from `dummy_input.csv`, compares it to `expected_output.csv`, and exits non-zero on any
mismatch. This is the template for "tested end-to-end on dummy data" that every node-testable job should carry.

## Guardrails (Constitution)

- **No buyer PII in the repo** (Art. 12). Reproduce structure with dummy data. `leak_check.mjs` before every push.
- **Honesty** (Art. 10/12): the 手順書 and delivery message state that production is AI-assisted; never over-promise.
- **Deliver only what we tested.** If a part can't be tested here, say so in `ACCEPTANCE_CHECK.md` and verify it
  in the talk room before booking revenue.
- **Revenue only from provider evidence** (Art. 11): Coconala order id / payment confirmation.
