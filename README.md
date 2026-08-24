# AI Revenue Experiment

AI自身が戦略・実行・計測・改善を行い、第三者から実収益を発生させられるかを検証する30日間の実験リポジトリです。

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
