# Intake — example-csv-aggregate  (WORKED EXAMPLE — synthetic, not a real buyer)

> This is a filled-in example so operators see the target quality. All data is fake.

- **Job id:** example-csv-aggregate
- **Coconala request / order url:** (example — none)
- **Won on:** 2026-10-01
- **Agreed price (税込):** ¥6,000
- **Agreed deadline (buyer's):** 2026-10-04  → **our target ship:** 2026-10-03 (≤3 days)
- **Base script reused:** new (cheapest test artifact) — pure transform, no API needed

## What the buyer wants (their words)
「経費のCSVが日付や金額の書き方がバラバラで、月ごと・カテゴリごとの合計が出せない。集計したい。」

## Deliverable, concretely
- Input: a CSV with columns 日付 / 品目 / カテゴリ / 金額 (formats inconsistent)
- Processing: normalize dates to month, clean 金額 (¥ and commas), drop blank/incomplete rows, sum 金額 by 月 × カテゴリ with a count
- Output: a 集計 CSV (月, カテゴリ, 合計金額, 件数) + the script + 手順書

## Data structure (dummy only)
`dummy_input.csv` — 12 rows incl. one blank line, one blank-品目 row, one `¥6,800`, dates as `-` and `/` and `2026-9-15`.

## Scope boundary (say NO to)
- Connecting to the buyer's bank/accounting SaaS accounts, or anything needing their login/identity.

## Needs the buyer's own credentials?
- OpenAI API key: no (pure transform, no AI call needed)

## Go/no-go re-confirmed (PROPOSAL_KIT §2): YES — deliverable code, no calls, ≤3 days, budget ≥¥3,000, ToS-clean
