# Autonomous public-ops pipeline (GitHub Actions)

All external writes run from **GitHub Actions** (open internet); the sandbox
egress is blocked. Workflows no-op gracefully until their one-time secret exists,
so nothing breaks before a grant.

## Workflows
- `.github/workflows/daily-report.yml` — 21:00 JST + manual. Runs leak_check → gen_report → commits. **No secret needed.**
- `.github/workflows/sales-monitor.yml` — every 4h + manual. `sales_monitor.mjs` polls Stripe, updates `status/revenue_ledger.json` + `EVENTS.jsonl` (prep vs official split), regenerates the report, queues an X post on new revenue. **Needs `STRIPE_RESTRICTED_KEY`.**
- `.github/workflows/social-x.yml` — every 30 min + manual. `post_x.mjs` drains `social/queue/*.json` to X (OAuth 1.0a). **Needs `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`.**
- `.github/workflows/etsy-publish.yml` — manual (`workflow_dispatch`) only; triggered by a Claude session (via the GitHub MCP `actions_run_trigger` tool) or the owner. `etsy_publish.mjs` creates/images/attaches-file/activates the listing defined in `marketing/etsy_listing_config.json` via Etsy API v3. Idempotent (`status/etsy_listing.json` guards against duplicate listings). **Needs `ETSY_API_KEYSTRING`, `ETSY_ACCESS_TOKEN`, `ETSY_REFRESH_TOKEN`, `ETSY_SHOP_ID`** — see `ops/ETSY_API_SETUP.md`.
- `.github/workflows/gumroad-publish.yml` — manual (`workflow_dispatch`) only; same trigger pattern as Etsy publish. Installs the official `gumroad` CLI, then `gumroad_publish.mjs` creates/publishes the listing defined in `marketing/gumroad_listing_config.json`. Idempotent (`status/gumroad_listing.json`). **Needs `GUMROAD_ACCESS_TOKEN`** — see `ops/GUMROAD_CLI_SETUP.md`. Lower friction than Etsy's OAuth (single access token via device-flow login, no app registration).

## Scripts (pure Node, no deps)
- `scripts/gen_report.mjs` — daily report + manifest + index.
- `scripts/leak_check.mjs` — secret/PII gate; blocks publish on FAIL.
- `scripts/sales_monitor.mjs` — Stripe revenue → ledger.
- `scripts/on_revenue_hook.mjs` — enqueue honest X post on new revenue.
- `scripts/post_x.mjs` — post queued items to X.
- `scripts/etsy_oauth_setup.mjs` — LOCAL-ONLY, run by the owner once to complete Etsy OAuth and print the four secrets above.
- `scripts/etsy_publish.mjs` — runs in Actions; creates/publishes the Etsy listing from `marketing/etsy_listing_config.json`.
- `scripts/gumroad_publish.mjs` — runs in Actions (after the `gumroad` CLI is installed); creates/publishes the Gumroad listing from `marketing/gumroad_listing_config.json`.

## One-time credentials to request from the owner (added as GitHub repo secrets, never in chat)
1. `STRIPE_RESTRICTED_KEY` — Stripe **restricted** key, read-only (Balance transactions + Charges). Optional: enables headless revenue detection between Routine sessions; Stripe checkout already works without it.
2. `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET` — X app + user tokens for autonomous live commentary. Optional, not revenue-gating.
3. `ETSY_API_KEYSTRING`, `ETSY_ACCESS_TOKEN`, `ETSY_REFRESH_TOKEN`, `ETSY_SHOP_ID` — Etsy API v3 OAuth (see `ops/ETSY_API_SETUP.md`). This one gates revenue — it's the primary remaining step before the AI can publish to the channel with the strongest validated cold-buyer traffic.
4. `GUMROAD_ACCESS_TOKEN` — single personal access token from the official Gumroad CLI (see `ops/GUMROAD_CLI_SETUP.md`). Account is already KYC'd/bank-linked; this is the only remaining step for a parallel, lower-friction listing.

Add at: repo → Settings → Secrets and variables → Actions → New repository secret.
