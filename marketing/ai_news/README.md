# AI-news awareness lane — production workspace

Canonical rules: `ops/LOOP_PROTOCOL_ADDENDUM.md` →
**"X role change — not retirement"** / **"AI-news awareness lane"**.
Owner voice: `marketing/X_VOICE_GUIDE.md` (news posts → **Register B**:
事実 → 実務への示唆 → 「ただし〜」の留保 → 本人の結論／問い、関西弁は薄め、
絵文字ほぼゼロ、ハッシュタグなし).

This lane is **awareness / trust / follower growth**, not direct product sales.
No product CTA unless it naturally fits and is positive-EV.

## Source of truth (read-only)

The owner's editorial sheet **AIコンテンツ編集部｜News Research × Daily SNS Editor**:
`https://docs.google.com/spreadsheets/d/1BSd9jv6B81Jxjndech9UgMyINA3peGFddLy8xTNs94w/edit`

Read tabs (never write): `GPT_ニュースDB`, `共通_編集方針`,
`共通_文体学習_固定` / `共通_ライティング辞典`, `CODEX_投稿DB`
(dedup), and `CODEX_KPI` / `CODEX_分析サマリー` only when performance
evidence is decision-relevant. The spreadsheet stays read-only unless the
owner separately authorizes writes.

## Per-post workflow

1. Read the sheet, pick the freshest high-quality candidate whose **primary
   source is confirmed**, that fits AI講師 / AI業務改善 positioning, and that
   is not a redundant repeat of a recent `CODEX_投稿DB` post.
2. Write the post text in the owner's voice (see guide). Go one level deeper
   than the headline: 何が変わったか → なぜ重要か → 仕事ではどう見るべきか.
   Use primary-source numbers; never state vendor/customer-reported figures as
   established general effects.
3. Fill a spec JSON from the story's real facts (see
   `_template/news_card.spec.example.json`) and render the image:
   `node scripts/render_news_card.mjs <spec.json> <out.png>`
4. Save everything under `marketing/ai_news/<YYYY-MM-DD>/`:
   `post.md` (final text), `selection.md` (why this NewsID, primary sources,
   caveats), `card.spec.json`, `card.png`.
5. Production only. Actual posting to X is a separate, gated step
   (`social/x_experiment_next_toplevel.json` + the mechanical poster) and is
   NOT performed here unless explicitly requested.

## Image renderer

`scripts/render_news_card.mjs` turns a spec JSON into a 1600×900 (16:9) PNG via
the pre-installed headless Chromium (no image-gen model needed, per the
addendum). Japanese via IPAGothic. `variant` rotates composition so the account
does not become visually repetitive. Proof renders (placeholder content, **not**
real posts) live in `_selftest/`.

## KNOWN BLOCKER (2026-09-15)

This execution environment **cannot read the editorial spreadsheet**:
- `docs.google.com` / `drive.google.com` are blocked by the org egress policy (403);
- the **Google Drive connector is connected at the org level but disabled for
  this chat** (`enabledInChat: false`), so its read tools are not loaded;
- `sheets.googleapis.com` is reachable but there is no API key / OAuth
  credential in this environment (Sheets API returns 403 without one).

Because the addendum requires inspecting the sheet before choosing a story
(rather than inventing a topic from memory), a real post cannot be finalized
until read access exists. Smallest unblock: **enable the Google Drive connector
for this chat** in the chat's connector settings (it is already authorized at
the org level). Alternatives: allowlist `docs.google.com` for this session, add
a Google API key as a repo/env secret, or export the needed tabs to CSV in the
repo. The renderer and scaffold above are ready so that production is immediate
once access is granted.
