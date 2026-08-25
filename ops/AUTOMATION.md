# Autonomous public-ops pipeline (GitHub Actions)

All external writes run from **GitHub Actions** (open internet); the sandbox
egress is blocked. Workflows no-op gracefully until their one-time secret exists,
so nothing breaks before a grant.

## Workflows
- `.github/workflows/daily-report.yml` — 21:00 JST + manual. Runs leak_check → gen_report → commits. **No secret needed.**
- `.github/workflows/sales-monitor.yml` — every 4h + manual. `sales_monitor.mjs` polls Stripe, updates `status/revenue_ledger.json` + `EVENTS.jsonl` (prep vs official split), regenerates the report, queues an X post on new revenue. **Needs `STRIPE_RESTRICTED_KEY`.**
- `.github/workflows/social-x.yml` — every 30 min + manual. `post_x.mjs` drains `social/queue/*.json` to X (OAuth 1.0a). **Needs `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`.**

## Scripts (pure Node, no deps)
- `scripts/gen_report.mjs` — daily report + manifest + index.
- `scripts/leak_check.mjs` — secret/PII gate; blocks publish on FAIL.
- `scripts/sales_monitor.mjs` — Stripe revenue → ledger.
- `scripts/on_revenue_hook.mjs` — enqueue honest X post on new revenue.
- `scripts/post_x.mjs` — post queued items to X.

## One-time credentials to request from the owner (added as GitHub repo secrets, never in chat)
1. `STRIPE_RESTRICTED_KEY` — Stripe **restricted** key, read-only (Balance transactions + Charges). Enables autonomous revenue detection/recording.
2. `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` — X app + user tokens for autonomous live commentary.

Add at: repo → Settings → Secrets and variables → Actions → New repository secret.
