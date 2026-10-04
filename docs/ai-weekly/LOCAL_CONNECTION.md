# Native Articles: local connection handoff (2026-10-04)

**Current authorization:** Parent supplied the user's 12:20:16 approval for native
weekly Articles API and a dedicated process using the four existing X credentials.
That connection approval is no longer pending. No new keys, OAuth grants, billing
settings or new services are authorized. This task authorizes local files and mock
verification only, not push/dispatch/API use. Daily C2 cleanup remains a separate
blocked task; none of its files/state has been touched here.

## Deliverables

- `.github/workflows/x-ai-weekly-article.yml`: manual stage choice only;
  contents:read; main/run_attempt=1; article-specific concurrency; four existing
  X Secrets only on the execution step; non-secret intent/result artifacts.
- `scripts/ai-weekly/bridge.mjs`: immutable material reservation, parent claim,
  upload/draft/publish/verify request builders, OAuth1 JSON POST and GET query
  signing, consumed local intent, receipt filtering, parent receipt reconciliation.
- `scripts/ai-weekly/run.mjs`: gate → parent run-bound Git intent → one request.
  Fresh remote Git state is checked immediately before the request. No Git push.
- `scripts/ai-weekly/parent-state.mjs`: creates NEW local proposal files for
  reserve/claim/apply. Never overwrites input ledger, pushes, or calls an API.
- `tests/ai-weekly/bridge.test.mjs`: fixtures in code only; no real material/images.
  Original article tests retained. 66 total tests pass offline.

`bridge.LIVE_READY=false` is a hard source-code hold. CLI refuses before Git,
material or credential access; workflow gate fails before the X-Secret step.
There is no environment/input switch to bypass it. A future reviewed change to
this flag is required after upload/URL/expanded verification read all-in prices
are established and the real input set is validated. This is a price/readiness
hold, NOT another request to approve use of existing credentials.
`article.mjs` remains the original offline compiler/mock harness; bridge reuses
its compiler, image hash check and digest functions, not its mock durable callback.

## Input paths and formats

At a reviewed code/material commit:

    social/ai-weekly/materials/AI-WEEKLY-2026-10-04/material.json
    social/ai-weekly/materials/AI-WEEKLY-2026-10-04/cover.bin
    social/ai-weekly/state.json

No such production files are created by this change. Material JSON is the original
ARTICLE_ADAPTER.md format: week_id/title/blocks/body_text/source_links(5)/image_sha256,
optional body_sha256. Here omit cover_media/media_receipt: media ID is derived ONLY
from the durable upload result. Exact Japanese block text and two-LF paragraph
joins must match body_text. The binary must match image_sha256; only PNG/JPEG
signatures and internal 5MiB ceiling are allowed. This is a hash/signature gate,
not an image decoder or visual QA; actual dimensions/quality must be reviewed first.
Do not commit confidential material to a public repository.

New parent-reviewed ledger shape:

    {"version":2,"budget_month":"2026-10","monthly_remaining_jpy":0,"articles":[]}

Zero is deliberately non-spending. Parent fills remaining JPY from the user's
monthly 3000 JPY budget after existing shared/prepaid reservations, avoiding double
counting. The adapter rejects >3000, wrong month, insufficient or absent amount.
Each claim reserves its max_jpy; unknown/rejected calls never automatically free it.
The reservation is a ceiling, not an actual charge/invoice.

Each entry binds week_id/body_sha256/image_sha256/material_sha256 and attempts[];
reserve rejects ANY duplicate week/body/image. Do not create a fresh empty ledger
because remote state was lost. Do not delete/edit an old claim to retry it.

## Parent-owned steps (all local proposals first)

1. Make an isolated copy of freshly fetched remote state, then:

       node scripts/ai-weekly/parent-state.mjs reserve state.json material.json cover.bin proposed-state.json

   Review proposal, normal non-force commit/push under dedicated social/ai-weekly
   paths, fetch and compare. Those remote writes are NOT performed by this tool.
2. Only after the readiness hold is legitimately resolved, dispatch ONE stage on
   reviewed main. Gate prints week/stage/run_id/code_sha without X credentials,
   then polls read-only Git every 5 seconds for at most 5 minutes. No X call yet.
3. Create claim JSON for that waiting run:

       {"week_id":"AI-WEEKLY-2026-10-04","stage":"upload",
        "run_id":"<actual numeric run id>","code_sha":"<actual 40hex workflow SHA>",
        "expires_at":"<within 15 minutes>",
        "cost":{"all_in_known":true,"max_usd":0.01,"max_jpy":2,
                "evidence":"<actual all-in pricing evidence; example numbers are NOT prices>"}}

   Then `parent-state.mjs claim state.json claim.json proposed-state.json`.
   Commit/push with single-parent ownership and fresh-state conflict checks.
   All-in evidence must include the selected endpoint, URL/expansion additions,
   FX/tax allocation and call count. Never copy the illustrative cost numbers.
4. That exact run/attempt/code may execute once. Gate rejects a different run or
   used stage; local exclusive fsynced intent is never removed. Rerun attempt>1
   fails at both workflow and code. Single job + concurrency serializes this lane;
   no main-wide concurrency block is added to other business workflows.
5. Parent retrieves `ARTICLE_RECEIPT=` / non-secret artifact and runs:

       node scripts/ai-weekly/parent-state.mjs apply state.json receipt.json proposed-state.json

   Matching full intent snapshot/owner/material is required; repeated application
   fails. Parent persists and read-verifies receipt before the next stage.
   A concurrent ledger update causes snapshot mismatch: stop and reconcile, never
   overwrite remote state. New stage cannot proceed before previous confirmed
   result is present IN GIT. No automatic stage chain/automatic push exists.

If the runner vanishes after Git intent or response but before a receipt is saved,
the durable intent stays unknown and consumed. Do not reissue/upload/recreate draft/
republish. A result-file failure still leaves local intent; artifacts may contain
only intent. If artifact upload also fails, remote consumed intent still blocks.
Keep earlier empty draft 2105232311969001472 untouched.

## Exact request ceiling / API evidence

Each stage makes at most ONE X request. No retries, redirects, fallback endpoints,
media processing polls, timeline reads, comments, likes or announcements.

| Stage | Request | Required result |
|---|---|---|
| upload | POST https://api.x.com/2/media/upload; JSON base64 + tweet_image | HTTP200 + media ID + expiry; pending processing remains unknown |
| draft | POST https://api.x.com/2/articles/draft; exact compiled content + persisted media ID | HTTP201 + article ID + matching title; retain ID even on partial error |
| publish | POST https://api.x.com/2/articles/{saved article ID}/publish | HTTP200 + post_id; never create another draft |
| verify | GET https://api.x.com/2/tweets/{saved post_id} | HTTP200 + exact post ID + author1982353950843256832 + actual created_at + nonempty article |

Verify parameters: post.fields=article,created_at,public_metrics;
expansions=article.cover_media,author_id; media.fields=media_key,type,url.
Expansion-related costs must be included in the separate verify ceiling. API source:
https://docs.x.com/x-api/posts/get-post-by-id and official SDK schemas (see audit).
The documented article object is opaque. Therefore verify reports
`verified_existence_only`, ALWAYS `body_links_cover_verified:false`. Full body,
five-link targets, and cover/rendered image matching remain a parent review task;
this implementation does not claim them from an existence GET. It deliberately
does not launch more reads to fill those gaps. Actual created_at is never replaced
by scheduled time or HTTP response time.
Upload source: https://docs.x.com/x-api/media/upload-media.
Draft/publish sources: https://docs.x.com/x-api/articles/introduction.

## Validation and outstanding work

`node --test tests/ai-weekly/*.test.mjs`: 66/66. Includes Japanese/UTF16 links,
week/body/image duplicates, complete mock four-stage chain, no durable result/no
next stage, timeout/500/malformed/partial results, saved draft ID, local replay,
different run/code/branch/rerun, expired intents/media, absent fresh proof,
monthly budget/month, cost hold, result-write failure, fixed endpoint signing,
workflow Secret/permission allowlist, and CLI live hold. Global fetch is blocked
in mock tests; actual X credentials are never read by tests.

Remaining: real material/cover and QA; all-in media and expanded-read price evidence;
review of readiness enablement; approved production push and actual staged run;
real API shape/rendered content verification. No workflow integration test on
GitHub has run. No new service, secret, account or OAuth grant is needed by design.
GitHub policies may still reject a future workflow push; report that rejection
rather than changing authentication or using a bypass.
