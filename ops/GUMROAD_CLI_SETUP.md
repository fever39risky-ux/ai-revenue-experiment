# Gumroad publish setup — one-time access-token grant

## Why this exists

Your Gumroad account is already fully ready (confirmed 2026-09-01): account
open, Japan, bank account registered, identity verification done via
Stripe, prior account warnings resolved, $100 JP payout threshold. The only
remaining step is a one-time technical grant so the AI can actually publish
a listing — this is genuinely simpler than the Etsy grant (a single access
token, not a full OAuth app registration).

Listing content is already decided and prepared:
`marketing/gumroad_listing_config.json` ($9, reusing the same deliverable
ZIP and cover image already built for Etsy/Stripe).

## How this was verified

Unlike the Etsy integration (built from general knowledge of its API),
this was checked against LIVE documentation on 2026-09-01: Gumroad
publishes an official CLI at
[github.com/antiwork/gumroad-cli](https://github.com/antiwork/gumroad-cli),
explicitly designed for CI/agent use (`--no-input --json` flags
throughout). That's what `scripts/gumroad_publish.mjs` shells out to. The
exact JSON shape of a successful `products create` response wasn't
confirmed live, so the parser is defensive and will fail with the raw CLI
output if a field isn't where expected — an easy one-round fix, not a
sign the approach is wrong.

## Steps (a few minutes, needs your own machine)

1. **Install the CLI** on your own machine:
   - macOS: `brew install antiwork/cli/gumroad`
   - Linux/macOS/Git Bash: `curl -fsSL https://gumroad.com/install-cli.sh | bash`
   - Windows: download the executable from the
     [gumroad-cli releases page](https://github.com/antiwork/gumroad-cli/releases)
2. **Log in** (this opens a browser approval, not a password prompt):
   ```
   gumroad auth login --no-input
   ```
   It prints a URL — open it in a browser where you're logged into your
   Gumroad account, and approve. The CLI picks up the token automatically
   once approved.
3. **Verify**, then **print the token**:
   ```
   gumroad auth status --json --no-input
   gumroad auth token --no-input
   ```
4. **Add it as a GitHub repo secret** (never paste it into chat):
   **repo → Settings → Secrets and variables → Actions → New repository
   secret** — Name: `GUMROAD_ACCESS_TOKEN`, Value: the token printed above.
5. That's it — one secret, not four. The next Claude session (or you, via
   the Actions tab → "Gumroad publish" → Run workflow) triggers
   `.github/workflows/gumroad-publish.yml`, which runs
   `scripts/gumroad_publish.mjs` to create, publish, and record the
   listing automatically.

## Known limitation: untested against the live CLI/API

The command surface (`products create`, `products publish`, flag names)
comes from the CLI's own live-fetched documentation, so confidence is
higher than the Etsy build. What's still unverified is the exact response
JSON on a real run — if the parser can't find the product id/url where
expected, the job log will show the raw CLI output and
`scripts/gumroad_publish.mjs` needs a small adjustment, not a redesign.
The product is created as a draft first and only published after that
succeeds, so a mid-way failure never leaves anything publicly live by
accident (Gumroad's `products create` already defaults to draft).

## Currency check

`marketing/gumroad_listing_config.json` prices the listing at **9.00 USD**,
matching the Etsy first-sale strategy. If the account settles in a
different currency, adjust `price`/`currency` in that file before the
first publish run.
