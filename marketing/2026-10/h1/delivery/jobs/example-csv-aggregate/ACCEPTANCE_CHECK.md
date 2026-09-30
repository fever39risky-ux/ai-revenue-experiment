# Acceptance check — example-csv-aggregate  (WORKED EXAMPLE)

## Correctness
- [x] Tested on dummy data matching the buyer's structure (`dummy_input.csv`)
- [x] `node marketing/2026-10/h1/delivery/jobs/example-csv-aggregate/test.mjs` exits 0 (7/7 checks pass, 2026-10-01)
- [x] Edge cases: blank line, blank 品目, `¥6,800`, mixed date formats, category whitespace — all covered by asserts
- [x] Output matches intake (月, カテゴリ, 合計金額, 件数)

## GAS-only parts (verified by reasoning + mirroring the tested logic)
- [x] `集計.gs` logic is line-for-line the same as the tested `transform.mjs` (normalizeMonth/toInt/sort/aggregate)
- [x] Trigger: `onOpen` adds the menu; `集計する` is the action — no time/form trigger needed
- [x] Scopes: Sheets only (getActiveSpreadsheet / insertSheet) — no Gmail/Drive/API scopes
- [x] No API key, no external calls → nothing to store, no budget concerns
- [x] Reads `Date` cells and string dates both (GAS returns Date objects for date-typed cells) — handled in normalizeMonth_
- [ ] Live authorize + run once in a real sheet — done by mac-local at delivery time (we don't have the buyer's sheet)

## Safety & honesty
- [x] No buyer PII (all data synthetic)
- [x] `node scripts/leak_check.mjs` green (run before push)
- [x] 手順書 + delivery message state AI-assisted production; no over-promise
- [x] Scope matched; bank/SaaS-account integration explicitly declined in intake
