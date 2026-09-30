# Intake — <job-id>

> Fill this the moment a proposal turns into a job. **No buyer PII** (names, emails, phone, real data). Describe
> the *structure* of their data, not the data itself. Ask for a de-identified/synthetic copy in the talk room.

- **Job id:** <job-id>  (kebab-case, e.g. `csv-sales-aggregate`)
- **Coconala request / order url:** <url>
- **Won on:** <YYYY-MM-DD>
- **Agreed price (税込):** ¥<amount>
- **Agreed deadline (buyer's):** <YYYY-MM-DD>  → **our target ship:** <YYYY-MM-DD> (≤3 days)
- **Base script reused:** <path from README reuse map, or "new (cheapest test artifact)">

## What the buyer wants (their words)
<one or two sentences, quoting the request>

## Deliverable, concretely
- Input: <what they give — e.g. "a Google Sheet with columns 日付 / 品目 / カテゴリ / 金額">
- Processing: <what we do — e.g. "clean blank rows, normalize category names, sum 金額 by month × category">
- Output: <what they get — e.g. "a 月次集計 sheet + the script + 手順書">

## Data structure (dummy only)
<column list / sheet layout, using fake sample rows. Keep this reproducible so test.mjs can assert output.>

## Scope boundary (say NO to)
- <anything requiring the owner's identity, calls, on-site, account access, or ToS-grey work → decline politely>

## Needs the buyer's own credentials?
- OpenAI API key: <yes/no> → stored in **buyer's** Script Properties, never in repo.

## Go/no-go re-confirmed (PROPOSAL_KIT §2): <YES / NO — reason>
