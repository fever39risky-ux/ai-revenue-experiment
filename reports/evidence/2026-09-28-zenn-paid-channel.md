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

## ROOT CAUSE RESOLVED — owner deploy log (2026-09-28, Claude run 140)
Owner opened zenn.dev/dashboard/deploys and reported the error verbatim:
> 次の本は投稿数の上限に達したためデプロイされませんでした: gas-ai-jimu-plus-6, gmail-gas-no-api-key-automation

This is Zenn's **new-post rate limit** (spam control), not a content/validation defect (Codex's config checks were correct — the config was never the problem) and not a fixed per-account book cap. Confirmed behavior (web research): the limit varies with recent posting pace, resets after ~24h without new posts, **updates to already-published content are exempt**, and `published:false` drafts do not count. Two new-post books (the ¥1,500 paid book + the never-deployed free `gmail-gas-no-api-key-automation`) were competing for the throttled slot, so both stayed 404 while the already-live free primer (an update, exempt) served 200.

**Action (Claude run 140):** set `gmail-gas-no-api-key-automation` → `published:false` so the paid book is the sole pending new post. The gmail book was never live (0 external links / 0 search equity) and all its content already exists on live owned guides, so no reader value is lost and the source stays in-repo (reversible). Free primer kept live (existing deploy, exempt, and the funnel). Verify paid book 200 via verify-url.yml after main promotes; if still 404, remaining levers are time (24h) or an owner Zenn contact-form limit-increase request.

Sources for the rate-limit behavior: https://zenn.dev/kodomo_news/articles/141-zenn-rate-limit ; https://zenn.dev/ukintech/articles/zenn-rate-limit-detect ; https://zenn.dev/kas_blog/articles/20260810-zenn-rate-limit-auto-push

### Verification after the fix (Claude run 140, 11:31-11:40Z)
Promoted the slot-free fix to main (ba3c6e6) and dispatched `verify-url.yml` twice (11:31Z, 11:35Z, ~4 min after promotion). Both returned **HTTP 404** ("見つかりませんでした | Zenn") for `gas-ai-jimu-plus-6`. Since Zenn publishes within seconds when unthrottled (the primer, an update, serves 200), the freed slot is necessary but not sufficient: the account's rolling new-post rate window has not decayed. Last new-post attempts were the two competing books at 03:11-03:23Z on 09-28, so the window should clear ~09-29 03:12Z **provided no further new Zenn posts are pushed**. Elevated action for the tight timeline: owner sends a Zenn contact-form limit-increase request (reliable, minutes). Discipline: neither operator pushes a new Zenn article/book until the paid book serves 200.
