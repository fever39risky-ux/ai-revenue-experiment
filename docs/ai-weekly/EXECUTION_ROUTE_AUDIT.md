# Article execution route audit — local/read-only investigation

Audited remote main: `224d53bcb2ad7bc10cb7e883e14dbbebbed325fe`.
Environment available; git fetch/read succeeded. No X calls, workflow dispatch,
workflow changes, Secrets inspection, auth settings, or push performed.

## Actual repository evidence

| Existing path | Trigger / permissions | What it actually does | Article reuse judgment |
|---|---|---|---|
| `.github/workflows/x-post-toplevel.yml` | dispatch only; contents:read | Hardcoded short-post script, four X Secrets; receipt/queue change only on runner | Cannot call article adapter unchanged; do not repurpose |
| `.github/workflows/x-verify-reply.yml` | dispatch(tweet_id); contents:read | Four X Secrets plus existing root-post variable; checks reply and 2–3 GETs including metrics | Does not verify full article body/cover; do not use as article verification |
| `.github/workflows/x-phase2.yml` | schedule + dispatch; contents:write | Short-post queue and metrics, commits social/2026-10; publish-main concurrency | Different business lane; must not piggyback or inherit its write authority |
| `.github/workflows/x-fetch-own-posts.yml` | dispatch; contents:write | Fetches timeline and commits voice corpus | Not targeted article verification; unnecessary reads/writes |
| `.github/workflows/verify-url.yml` | dispatch(url) | Unauthenticated curl, no X Secrets | No authenticated article API route; input must not be exploited as command injection |
| `.github/workflows/promote-branch.yml` | push claude/**; contents:write, issues:write | Branch promotion only | Not an X execution gateway; do not trigger for this task |

No workflow_call, repository_dispatch, or generic authenticated article runner is
present in main. Existing hardcoded workflows do not provide a safe unchanged
execution path for upload/draft/publish/verify.

Historical proof, NOT a currently executable route:
`898a79b23edc67cd49a317894e0d015e040f12aa:.github/workflows/media-upload-probe-once.yml`
uses the SAME four Secret names, OAuth1, POST https://api.x.com/2/media/upload,
JSON {media:<base64>,media_category:tweet_image}, contents:read, run_attempt=1,
main-only, hash/size/dimension checks and no retry. Parent previously observed its
successful run 36822095926. It is absent from current main and expired at
2026-10-01T06:30Z. Do not restore/run the probe or reuse its image/media ID.
It proves implementation precedent, not current price, account eligibility, or
approval for a new upload. It saved local intent only, so its durability design
must not be copied unchanged.

## Exact permission distinction

- Reusing X_API_KEY, X_API_KEY_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET in
  the same repository does not create a token, add OAuth scopes, modify Secret
  values, or change repository/org Secret access policies.
- It DOES add a new workflow/step/code path receiving those credentials. That is
  an expansion of credential exposure/use, even though the effective X token
  privileges remain unchanged. contents:read only restricts GITHUB_TOKEN, not
  the authority conveyed by the X Secrets.
- Repository workflow code + successful existing run establish the four names
  work there. Secret origin (repository vs inherited organization), current ACLs,
  rulesets, and workflow-file push capability were not independently inspected.
  Do not promise that workflow-file push will pass. A rejection must be reported;
  no automatic token/scope expansion or alternate bypass.
- Explicit session constraint forbids new Secret references. Therefore a new
  workflow binding requires a narrow exception approved by the user/parent, not
  a broad request to recreate or expand X authentication. No skill requires this
  approval; it comes from that session constraint and the requested publication hold.

GitHub references:
https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
https://docs.github.com/en/actions/tutorials/authenticate-with-github_token
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch

## Recommended minimal connection, pending approval

One NEW article-only workflow `x-ai-weekly-article.yml`:
- workflow_dispatch only; stage allowlist upload|draft|publish|verify; no schedules,
  push trigger, reusable automatic chain, arbitrary URL/script/path input, or rerun.
- permissions: contents:read; no actions:write, contents:write, id-token, or new
  repository environment. Keep all existing workflows/scripts unchanged.
- Article-only concurrency group (not publish-main), cancel-in-progress:false;
  main-only, github.run_attempt == 1, bounded timeout, one job. Concurrency alone
  is not deduplication; all later dispatches must check the durable stage claim.
- Pin reviewed code and material hashes; pass inputs through environment as data,
  never interpolate them into shell source. No dependency installation with X env.
- Four existing X Secrets only on the final network step. No new Secrets,
  inherit-all mechanism, credentials in files/logs/artifacts, or permission changes.
- Fail closed until matching stage/material/cost/run authorization is present in
  the dedicated ledger. Paid upload and URL surcharge uncertainty blocks that stage.

### Parent-owned durable handshake (runner remains read-only)

1. Parent commits final approved material, cost ceiling, and prepared stage to
   dedicated social/ai-weekly state. Fetch/verify remote before dispatch. Keep
   historical empty draft 2105232311969001472 unchanged.
2. Parent starts exactly ONE stage run. Its initial gate contains no X Secret
   bindings and no X requests. It reports run_id and waits a bounded interval.
3. Parent records a remote intent bound to week/body/image/payload hashes, exact
   run_id, run_attempt=1, stage and expiry. Intent consumes the stage permission.
   Commit with normal non-force push/CAS; on concurrent state change STOP.
4. Runner reads the latest remote state and verifies the exact claim/code/material
   hashes. Only this waiting run can continue; any new run ID or rerun fails.
   The lock is not reset on cancellation, timeout, or uncertain dispatch.
5. Runner makes the bounded stage request(s) once, emits a whitelisted non-secret
   receipt with IDs, HTTP status and timestamps to logs/summary and receipt artifact.
   Failure/timeout emits unknown; no retry. Parent captures receipt, commits it,
   freshly fetches and verifies it BEFORE authorizing the next stage.
6. If runner dies after intent and before receipt, the remote intent remains
   unknown and blocks future sends. Recover by read-only inspection and an explicit
   reconciliation decision, never by reset/requeue/rerun. Single-owner parent
   serialization is required; independent agents cannot both claim a stage.

This is a proposed bridge, NOT implemented by cc7f116. Its current mock durable
callback must be replaced by the audited parent/run handshake; merely enabling
LIVE_ENABLED or returning a fabricated Git acknowledgement is unsafe.

## Stage-specific work still needed

- upload: validate actual image bytes/hash/MIME/size; choose an approved endpoint
  and exact call ceiling after parent resolves price. Simple image upload is a
  historical precedent; no blind multipart/chunked/status fallback. Persist media
  ID, category, expiry and image-hash evidence. Unknown response forbids reupload.
- draft: compile/round-trip final body; validate uploaded media receipt and expiry;
  POST /2/articles/draft exactly once; persist article_id before publish stage.
- publish: use only that durable article_id; POST /2/articles/{id}/publish once;
  persist post_id. No creation of replacement draft and no short-post announcement.
- verify: implement article-aware targeted GET for returned post_id using confirmed
  official fields/expansions; compare author, actual created_at, article ID/title,
  body/link/cover evidence. Where API omits full content, leave that check unresolved
  for authorized human review; do not label existence-only as full verification.
  Current adapter has neither upload nor verify implementation and its OAuth signer
  supports only article POST; add upload and GET signing with explicit URL/query
  allowlists and mock tests. Price/count ceiling must cover requested expansions.

## Minimum approval language for parent to present after concrete bridge review

“Allow adding and pushing the reviewed article-only manual workflow, binding only
these existing four X Secrets in its one execution step, with GITHUB_TOKEN kept at
contents:read and no Secret/auth/OAuth/ACL changes. Allow the parent to commit
article-specific intent and receipts. Execution remains separately held until the
final material hashes, exact upload/draft/publish/verify endpoints, request counts,
all-in price ceilings, and one-run-per-stage authorization are confirmed.”

This approval is for the new execution path; it is not consent for an unresolved
paid upload, automatic publish, retries, replies, or other business actions.
No approval question has been sent directly to the user by this worker.


## Subsequent local connection update (2026-10-04)

The parent has supplied explicit approval for the weekly API/dedicated existing-credential
connection. Earlier approval-pending statements above are historical. See
[LOCAL_CONNECTION.md](LOCAL_CONNECTION.md) for the local manual-stage workflow,
parent Git intent/result handshake, readiness hold, and current validation limits.
No production push/API execution is included in that update.
