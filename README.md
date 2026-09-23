# AI Revenue Experiment

AI自身が戦略・実行・計測・改善を行い、第三者から実収益を発生させられるかを検証する30日間の実験リポジトリです。

## Free tools & guides (public site)

- **Free book (JP):** [GAS×ChatGPT 事務自動化 入門](https://zenn.dev/kinoshita_ai/books/gas-chatgpt-jimu-automation-primer) — API key storage, 429 retry, 6-minute limit, JSON output, cost estimates.
- **GAS × ChatGPT guides (JP):** [Gmail inquiry AI draft reply](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gmail-inquiry-ai-draft-reply.html) · [Google Form AI triage](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/google-form-ai-triage-notify.html) · [Invoice PDF + AI cover email](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gas-invoice-pdf-ai-cover-email.html) · [Meeting minutes AI summary](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/gas-meeting-minutes-ai-summary.html)
- **Free calculators (EN):** [50/30/20 budget](https://fever39risky-ux.github.io/ai-revenue-experiment/tools/budget-503020-calculator.html) · [Debt payoff](https://fever39risky-ux.github.io/ai-revenue-experiment/tools/debt-payoff-calculator.html) · [Savings goal](https://fever39risky-ux.github.io/ai-revenue-experiment/tools/savings-goal-calculator.html) · [Freelance rate](https://fever39risky-ux.github.io/ai-revenue-experiment/tools/freelance-rate-calculator.html) · [Etsy fees](https://fever39risky-ux.github.io/ai-revenue-experiment/tools/etsy-fee-calculator.html) · [Rental cash flow](https://fever39risky-ux.github.io/ai-revenue-experiment/tools/rental-property-cash-flow-calculator.html) · [Reorder point](https://fever39risky-ux.github.io/ai-revenue-experiment/tools/reorder-point-calculator.html) · [Wedding budget](https://fever39risky-ux.github.io/ai-revenue-experiment/tools/wedding-budget-calculator.html) · [Free budget spreadsheet](https://fever39risky-ux.github.io/ai-revenue-experiment/tools/free-budget-spreadsheet.html)
- **Paid, ready-to-use versions:** [Google Sheets templates](https://fever39risky-ux.github.io/ai-revenue-experiment/store/spreadsheets.html) · [GAS×ChatGPT toolkit (JP)](https://fever39risky-ux.github.io/ai-revenue-experiment/store/jp.html) · [PRO: 5 working GAS scripts](https://feverish50.gumroad.com/l/jqxenl)

## Core principle

This experiment tests **AI earns**, not merely **earning with AI**.

Human involvement is limited to identity-, legal-, banking-, account-, consent-, and permission-gated actions that the AI cannot lawfully or technically perform itself.

## Source of truth

- `status/CURRENT_STATUS.json` — machine-readable current state for Claude Code / OPP
- `status/EVENTS.jsonl` — append-only key events
- `status/RESULTS_LEDGER.md` — verified revenue / cost / human-labor ledger
- `status/DAILY/` — detailed daily logs
- `status/SCHEMA.md` — logging contract

Claude Code decides strategy, priority, resource allocation, pivots, and lane shutdowns autonomously from observed results.

## Revenue milestones

1. First external reaction
2. First real ¥1 / $1 equivalent
3. ¥1,000 equivalent
4. ¥10,000 equivalent
5. ¥50,000/month equivalent

Intermediate metrics such as impressions, clicks, followers, and inquiries are tracked, but do not count as revenue.
