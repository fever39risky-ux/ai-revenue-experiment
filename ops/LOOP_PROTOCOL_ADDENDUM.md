# Autonomous Loop Protocol — Canonical Addendum

Effective: **2026-09-13, Asia/Tokyo**

This file is a **canonical extension of `ops/LOOP_PROTOCOL.md`**. Read it together with the main protocol. If this addendum conflicts with older cadence/pivot/X-retirement language in `ops/LOOP_PROTOCOL.md`, `status/cadence.json`, `status/CURRENT_STATUS.json`, or `ops/AGENT_LOOP.md`, this addendum controls until the older wording is explicitly reconciled.

## Failed lane = pivot, not vacation

When one reach, distribution, product, or revenue lane is retired, falsified, or deprioritized, do **not** interpret that as a reason to reduce productive intensity by default.

A failed lane should release time, attention, and budget for the **next credible revenue lane**.

When real third-party revenue is still near ¥0, retiring one channel must trigger an explicit search for the next economically plausible path before cadence is reduced.

**A failed channel should create a pivot, not a vacation.**

The fact that one remaining lane is slow-maturing — for example, SEO indexing — is not sufficient justification for inactivity if other low-cost revenue hypotheses remain untested.

Before reducing cadence while revenue remains near ¥0, explicitly answer:

1. What revenue models remain untested?
2. What distribution channels remain untested?
3. What higher-ticket, service, direct-sale, or direct-response options remain untested?
4. What adjacent buyer segments remain untested?
5. What existing owned assets can still be packaged, positioned, distributed, or monetized differently?
6. What signal-independent, low-cost, reversible preparation can be completed now?
7. What human-only capability would unlock a high-EV lane, and can permission be requested narrowly while non-blocked work continues?

Do not assume that "X failed" means "SEO is the only option." Do not assume that "SEO is indexing" means "wait." Search the full feasible strategy space that remains inside the experiment rules.

## X role change — not retirement

The Day-11/12 tests only falsified **X as the primary short-term direct-response acquisition lever for immediate product sales** under the tested conditions. They do **not** justify treating the X account itself as worthless or permanently retired.

X remains an owned strategic asset with a different job:

- awareness / recognition growth;
- follower growth;
- trust and expertise accumulation;
- AI-news distribution;
- practical AI-work commentary;
- indirect discovery for note, free guides, owned pages, products, and future offers.

Therefore use the status **role_changed**, not `retired`, when describing X at the strategy level.

Do not demand that every X post produce an immediate sale or link click. Awareness/trust posts can be rational when they strengthen the owner's future distribution power at low marginal cost.

At the same time, X must not become a vanity-content sink. Every post should have a credible role in audience growth, expertise/trust, qualified attention, or downstream monetization. Measure reach/follower/engagement trends over a reasonable series rather than declaring the entire channel dead from two direct-response posts.

### AI-news awareness lane

The owner has an existing AI-news editorial system in this Google Sheet:

`https://docs.google.com/spreadsheets/d/1BSd9jv6B81Jxjndech9UgMyINA3peGFddLy8xTNs94w/edit`

Title: **AIコンテンツ編集部｜News Research × Daily SNS Editor**

This is an existing owned editorial asset and may be used as the source of truth for AI-news posting work.

The sheet's older `共通_編集方針` assigns final posting work to Codex and news collection to ChatGPT. **The owner has now explicitly authorized Claude, for the AI Revenue Experiment, to take over AI-news post-text and visual-asset production when useful because the prior Codex execution is not reliably delivering.** This is a narrow execution override, not permission to rewrite the editorial system's role tables or mutate `CODEX_*` / `共通_*` data automatically.

Claude may therefore **read** the editorial sheet and produce X-ready post text + a matching image asset outside the spreadsheet/repo as appropriate, while keeping the spreadsheet itself read-only unless the owner separately authorizes writes.

When creating an AI-news X post, inspect the spreadsheet first rather than inventing a topic from memory. Read only the minimum useful tabs, typically:

- `GPT_ニュースDB` — current collected news, primary-source status, scores, practical impact, posting angle;
- `共通_編集方針` — editorial policy;
- `共通_文体学習_固定` and/or `共通_ライティング辞典` — owner voice/style when needed;
- `CODEX_投稿DB` — avoid unnecessary duplication and inspect prior output when relevant;
- `CODEX_KPI` / `CODEX_分析サマリー` — only when performance evidence is decision-relevant.

Prefer the freshest high-quality candidate whose primary source is confirmed, whose practical implication fits the owner's AI-training / AI-work-improvement positioning, and which is not a redundant repeat of a recent post.

The post should normally do more than repeat the headline. Explain **what changed and why it matters for actual work**. Favor concrete numbers, caveats, and the owner's practical interpretation where the source supports them.

For the image, create a post-specific visual asset rather than reusing a generic template blindly. The visual should:

- reflect the selected story's real facts/numbers;
- be immediately understandable on X;
- avoid fabricated screenshots, unsupported claims, or misleading logos/endorsements;
- vary layout/composition over time so the account does not become visually repetitive;
- prioritize readable Japanese text and one clear message over decorative complexity.

If an image-generation model is unavailable in the execution environment, create a clean shareable graphic through code/SVG/HTML-to-image or another available deterministic method rather than blocking the editorial work. Store the generated asset durably when practical.

AI-news content is primarily an **awareness / trust / follower-growth lane**, not a requirement to pitch the current product in every post. Add a product/note/free-guide CTA only when it naturally fits the topic and has positive expected value.

The AI Revenue Experiment may reuse this editorial asset because growing the owner's relevant audience can improve future distribution and monetization, but do not overwrite the separate editorial system's data or rules merely to serve the experiment.

## No-supply does not mean no experimentation

Do not interpret "avoid premature supply" or "stop polishing products" as a blanket ban on creating new revenue or reach experiments.

Avoid:
- polishing the same product without evidence;
- creating duplicate products merely to look busy;
- building inventory that has no credible route to a buyer.

But continue testing economically plausible **new reach, monetization, audience, offer, or distribution hypotheses** when evidence and cost justify them.

In particular, while revenue remains near ¥0, do not let an unpublished note article, slow SEO indexing, or a weak direct-response X test freeze independent work on awareness, alternate reach, higher-ticket/direct-sale options, affiliate/referral, micro-products, demos/proof, or other credible revenue paths.

## Cadence reduction gate while revenue is near zero

Cadence may be reduced only after the AI has considered the reasonable remaining revenue space, not merely the currently active lane.

While revenue remains near ¥0, a recommendation to reduce cadence must include a concise comparison showing that there is **genuinely no positive-EV revenue work available now** across reasonable alternatives — including adjacent channels, alternate revenue models, higher-ticket possibilities, direct distribution, owned-asset reuse, awareness growth, and signal-independent preparation.

If low-cost useful work still exists and would otherwise sit idle until the next scheduled fire, that is evidence **against** reducing cadence.

A slow feedback clock on one experiment does not set the work clock for the whole business.

## Waiting and preparation

Continue to distinguish:

- **signal-dependent decisions** that truly need evidence; and
- **signal-independent preparation** that can proceed safely and reversibly.

Do not publish, spend, or irreversibly commit to an evidence-dependent strategy prematurely. But preparation that remains useful across plausible outcomes should normally continue when it has positive expected value.

Examples include offer architecture, Japanese paid-core packaging, pricing options, demos/proof, SEO/LP assets, higher-ticket offer design, affiliate/revenue-model research, alternate buyer segments, AI-news audience growth, and other distribution/revenue lanes. These are examples, not directives; choose by expected Net Profit.

## Human permission boundary

If the highest-EV next action requires a capability outside existing owner authorization, do not silently broaden permissions. Ask for the **smallest specific permission** needed, explain why it matters, and continue with non-blocked revenue work in parallel.

The AI still owns strategy. The owner supplies only genuinely human-bound permission, identity, account, or settlement actions.
