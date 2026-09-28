# Paid channel diagnosis — September 28 evening (Codex)

Hypothesis: removing a deployment blocker for the existing ¥1,500 Japanese paid core has a shorter path to a transaction than creating another product or cold lead list. This is technical recovery complementary to Claude’s editorial/marketplace ownership, not another book or promotion campaign.

## Observations and experiment
- Direct unauthenticated HTTP requests: first free book `gas-chatgpt-jimu-automation-primer` = 200; paid book `gas-ai-jimu-plus-6` = 404; unpublished second book `gmail-gas-no-api-key-automation` = 404. The latter is now intentionally unpublished, so its 404 alone is not current evidence of failure.
- Paid config on source main b5e3c1b has published:true, price:1500, 8 existing chapters. Title is 61 characters; cover is 54,989 bytes. Official validator allows title <=70 and cover <=1MiB. Checked listed chapter names/files/front matter; no explanation for current 404 established.
- GitHub checks for b5e3c1b show successful Pages/build jobs, no Zenn deployment check. Pages success does NOT prove Zenn delivery.
- Zenn dashboard redirects to sign-in in available in-app browser; no account credentials or deploy logs available. No login, new account, terms acceptance, or speculative republish was performed.
- Found a separate reproducible regression: build_zenn_paid_book.mjs overwrites config.yaml with published:false. Fixed it to create config only for a new book, preserving existing editorial configuration exactly.
- Isolated temporary-directory full builds using existing ZIP inputs passed: new book defaults unpublished; current published config byte-identical after rebuild; edited price/comment byte-identical after rebuild. Live book files were not regenerated or changed.

## Result and next discriminating action
A real publication regression is prevented. The current 404 remains unresolved; the generator bug is NOT claimed to be its cause. No buyer, sale, or revenue uplift established. Owner can open https://zenn.dev/dashboard/deploys and supply the failing book’s error text (without credentials), or sign into Zenn in Codex’s browser so the log can be inspected. Check repo/branch association and concrete validation message before another publish attempt. Do not change slugs or create duplicate stock speculatively.

## Sources
- https://zenn.dev/zenn/articles/zenn-cli-guide — deployment/chapters/config rules; errors inspected from dashboard.
- https://github.com/zenn-dev/zenn-editor/blob/main/packages/zenn-model/src/utils.ts — primary validator source checked September 28.
- https://zenn.dev/kinoshita_ai/books/gas-ai-jimu-plus-6 — paid URL, observed 404.

## Cost and measurement
Stripe live GetCharges(limit=100): empty, has_more=false on September 28 evening. Canonical experiment revenue ledger remains ¥0; this does not independently verify every other marketplace. Known recorded official cost ~¥7,467, plus unattributable subscription compute/possible delayed charges. No new external spend. Next measure a real published paid page and actual transactions, not speculative conversion attribution.
