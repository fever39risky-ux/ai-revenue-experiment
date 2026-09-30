# X (Twitter) — Phase 2 lane: ACTIVE from 2026-10-01

Account: **@KinoshitaTsks** (owner's account; top-level posting grant of 2026-09-11 still applies). Voice: `marketing/X_VOICE_GUIDE.md` **Register C** (一人称「僕」, light Kansai, facts → implication → honest caveat).

September's "X retired" decision is **not inherited**. September measured only 6 API posts, mostly link-bearing direct-response pitches (reply posts 0 imp; top-level 4 / 5 / 2 / 10 imp vs the owner's manual posts 46–143). That shows "X is weak as a direct sales link lever for a kit", nothing more. October tests a different job.

## 1. Job of X in October

Hypothesis **H2 (content-led audience)**: *the experiment itself* — an AI running a company, failing, redesigning itself in public — is interesting to Japanese AI-curious workers, side-hustlers and small business owners. X builds that audience, which then (a) raises trust for our Coconala/BOOTH offers, (b) feeds note/Zenn long-form, (c) can become its own paid content (note paid article / magazine) if demand shows.

Not the job: pasting store links into every post.

## 2. Series design

| Series | Frequency | Content | CTA |
|---|---|---|---|
| **「AIに会社を任せる実験 第2弾 Day N」** | 1/day (morning slot) | the day's real numbers (売上/コスト/人間介入) + one decision the AI made and why | none, or "続きは明日" |
| **「AIの経営判断」** | 2–3/week (evening slot) | a pivot / kill / org change with the evidence (e.g. "Etsyを凍結した理由") | occasionally note/Zenn long-form link in a self-reply |
| **「9月の失敗から」** | Days 1–5 only | one structural failure per post from `SEPTEMBER_RETROSPECTIVE.md` | none |
| **週次まとめ** | Sundays | week KPI + what changed in the organization | note article link in self-reply |
| AI news (optional) | ≤ 1/day | only from the owner's editorial sheet (Drive connector) per the Sept addendum; skip if unavailable | none |

Rules: every number comes from the ledgers / board; no fake drama; no engagement bait; no replies/DMs to strangers; links only in a self-reply (field `reply_text`), never in the main post; ≤ 2 posts/day via the pipeline.

## 3. Pipeline (no human)

- Author writes a queue item `social/2026-10/queue/<YYYY-MM-DD>-<slot>.json`:
  `{ "not_before": "<ISO>", "text": "...", "reply_text": "optional", "series": "...", "hypothesis": "H2", "register_targeted": "C", "voice_self_check": ["一人称は僕", "..."], "facts_source": "ledger/board/..." }`
- `.github/workflows/x-phase2.yml` runs at 08:37, 12:37, 20:37 JST: `scripts/oct/x_phase2.mjs post` posts the earliest due item (cap 2/day), verifies it via GET, appends to `social/2026-10/posted.jsonl`, deletes the queue file; then `metrics` refreshes public + non-public metrics (impressions, likes, replies, reposts, bookmarks, profile clicks, link clicks) for posts < 7 days old into `social/2026-10/metrics.json` and commits.
- Manual run: dispatch `x-phase2.yml` (GitHub MCP `actions_run_trigger`).
- Credentials: repo secrets `X_API_KEY`, `X_API_KEY_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` (already present). Cost: book any X API credit purchase in the October cost ledger.

## 4. Measurement & decision thresholds (pre-registered)

Founder books X results as signals weekly (`ops.mjs signal founder profile_visit|link_click|follower_delta|inquiry ... --channel x`).

| Checkpoint | Condition | Decision |
|---|---|---|
| Day 4 (after ≥ 4 posts) | median impressions < 20 **and** 0 profile clicks | L1→L2 change: posting time, format (image card vs text), thread vs single; test one owner-voice long post |
| Day 8 review | median impressions ≥ 100 **or** ≥ 1 inquiry/order attributable **or** followers +10/wk | keep / scale (add evening series) |
| Day 8 review | median 20–100, 0 attributable signals | change content angle (L3: different audience — e.g. small-business owners vs AI enthusiasts) |
| Day 15 review | after ≥ 12 posts: median < 30, profile clicks ≈ 0, 0 attributable signals, followers flat | **reduce to 2/week or stop**, with this evidence table in the review. "September failed" is not an admissible reason; only October data is |
| Any time | a post gets > 5× median | analyze why, repeat the pattern within 48 h |

Production cost per post (compute minutes, X credits) is recorded in the weekly review so the lane's EV is explicit.

## 5. Day 1 state

Two launch posts are pre-queued for 2026-10-01 (08:37 and 20:37 JST slots). The Founder's Day-1 run verifies they posted (or fixes the pipeline) and writes the Day-2 post from real Day-1 data.
