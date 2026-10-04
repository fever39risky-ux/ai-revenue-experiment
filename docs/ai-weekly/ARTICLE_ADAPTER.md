# AI Weekly article adapter — OFFLINE ONLY

Local branch `codex/ai-weekly-article-offline`. No existing scripts, workflows,
Secrets, auth configuration or other business state changed. No API execution,
media upload, new draft, publish, push, or deletion of empty draft
`2105232311969001472` is authorized by this implementation task.

## Verified API contract

- https://docs.x.com/x-api/articles/introduction : OAuth1 user context supported;
  separate draft and publish operations.
- https://docs.x.com/x-api/articles/create-draft-article : draft returns 201/data.id.
- https://docs.x.com/x-api/articles/publish-article : publish returns 200/data.post_id.
- Official generated SDK schema reviewed at
  https://github.com/xdevplatform/xdk-typescript/blob/9b312949e7edf4da32bfbaffda575f0eb7bc1525/src/schemas.ts
  and its articles/client.ts: header-one/two/three; entities array; snake_case wire
  entity_ranges; link/mutable (lowercase); cover_media media_category/media_id.
- Actual X rendering, account eligibility, cover category acceptance, and API-side
  validation have NOT been tested. Standard DraftJS UTF-16 offsets are tested
  offline including emoji/supplementary Japanese characters.
- Parent reports draft/publish base prices $0.010 each. This is not an all-in price:
  upload, link surcharges, FX/tax/shared app allocation still require parent evidence.
  The adapter has no default price authorization and never books mock costs as actual.

## Required material input

Provide UTF-8 JSON (LF; no trimming/normalization) plus the actual image file:

```json
{
  "week_id": "AI-WEEKLY-2026-10-04",
  "title": "AI Weekly — final approved title",
  "blocks": [
    {"kind":"heading1","text":"見出し"},
    {"kind":"paragraph","text":"段落。\n段落内の改行。"},
    {"kind":"heading2","text":"出典"},
    {"kind":"paragraph","text":"https://example.com/source/1"}
  ],
  "body_text": "見出し\n\n段落。\n段落内の改行。\n\n出典\n\nhttps://example.com/source/1",
  "source_links": ["https://example.com/source/1", "...exactly five distinct HTTPS URLs..."],
  "image_sha256": "64 lowercase hex digits of actual image bytes"
}
```

The abbreviated example is intentionally not executable: supply all five links,
all blocks, and the real hash. Allowed kinds: paragraph, heading1, heading2,
heading3. `body_text` MUST equal every block's text joined with two LF characters;
empty blocks and internal LF are retained. Each of the five URLs must appear
literally in text. Optional `body_sha256` is checked against that exact UTF-8 body.
Title and heading types are bound by a separate generated payload_sha256.
No automatic Markdown conversion, truncation, or unsupported styling fallback.

`compile(input)` builds the exact wire JSON without requiring upload.
`reserve(ledger,input,imageBytes)` verifies the image bytes and writes a local
prepared record. Do not reserve the final ledger until the final media binding is
known: no automated revision/replacement transition is implemented.

Before a draft attempt, add:

```json
{
  "cover_media": {"media_category":"tweet_image", "media_id":"RETURNED_NUMERIC_ID"},
  "media_receipt": {
    "media_id":"SAME_ID", "image_sha256":"SAME_IMAGE_HASH",
    "expires_at":"ACTUAL_EXPIRY_ISO8601", "evidence":"verified upload receipt/run reference"
  }
}
```

Parent must verify that receipt actually binds the supplied image to that media ID,
owner, category and expiry. Fields alone do not prove the remote image. No uploader
is supplied; do not invent a media ID, expiry, price, or receipt. Draft stage refuses
missing/expired media. Reusing the same week, body, OR image in another reservation
is conservatively blocked and requires review; no automatic override.

## Safe staged execution design (not connected to production)

1. Parent prepares dedicated `social/ai-weekly/state.json` with version 1 and articles
   array, then reviews final material/payload/cost and establishes a single owner.
   It must retain all earlier reservations; never initialize an empty replacement
   because the file was lost. Parent keeps the pre-existing empty draft untouched.
2. Persist the prepared record with a normal non-force Git push; fetch and verify
   remote exact state. Settle conflicts by rereading, not by overwriting state.
3. A draft stage first requires remote proof of prepared state. It writes
   `draft_unknown` intent locally with fsync, then waits for the parent to persist
   that exact intent to Git before the sole POST. The running process continues
   only after durable acknowledgement. Crash/restart at intent means STOP, even if
   the network call might not have begun. No queued intent may be executed again.
4. Save returned draft ID immediately; publish is NOT automatic. Parent obtains
   the non-secret receipt, persists draft_created and ID, then fetch-verifies it.
   If receipt persistence fails, retain the ID locally and recover via that receipt;
   never create another draft. Do not publish while the draft receipt is not durable.
5. A separately authorized publish stage repeats the proof/intent barrier for the
   saved article ID. Persist publish_unknown before POST. An error, timeout,
   malformed response, or partial response remains unknown and cannot be resent.
   A response with post_id is preserved even when other response fields are errors.
6. After success persist post_id/HTTP evidence before any follow-up. Publish response
   alone does not prove final text, created_at, cover rendering or links; independently
   approved verification would still be needed. No extra GET is included here.

`stage()` is ONLY a mock protocol harness: production transport is absent and
mode=live fails before credentials/network. Its injected `durable(state,hash)` is
an integration contract, not proof by itself. `gitAcknowledgement()` provides
read-only hash comparison against origin/main, but the caller must first freshly
fetch; cached remote refs are not live verification. No Git writes are automated.
A production bridge still needs authenticated remote compare-and-swap/serialized
ownership, fresh-read checks, and non-replayable run ownership. Local file locking
is insufficient across independent runners. A fake acknowledgement callback must
never be used for real requests.

The existing x-post-toplevel workflow cannot execute this adapter unchanged: it
hardcodes the short-post script and has runner-local writes only. Reusing its four
OAuth1 environment names is implemented as a pure signer, but wiring any real
runner would require a separately reviewed execution mechanism; no existing
workflow or Secrets references were changed. This is a concrete integration
blocker, not a need for new X credentials or OAuth scopes.

## Verification

Run `node --test tests/ai-weekly/article.test.mjs`. Tests use temporary files and
mock requests; global fetch fails. Covers round-trip text/links/headings, UTF-16,
image checks, duplicates, separate stages, ambiguous results, saved draft ID,
Git acknowledgement failures, file concurrency, restart, missing state, tampering,
live/cost holds, expired cover and read-only Git proof. No paid APIs are called.


## Subsequent local connection update (2026-10-04)

The parent has supplied explicit approval for the weekly API/dedicated existing-credential
connection. Earlier approval-pending statements above are historical. See
[LOCAL_CONNECTION.md](LOCAL_CONNECTION.md) for the local manual-stage workflow,
parent Git intent/result handshake, readiness hold, and current validation limits.
No production push/API execution is included in that update.
