# C3 single catch-up — connected, price-held

C-20261004-003 is fixed to the received body/image bytes. Creation is allowed only on 2026-10-04 from 21:00 through 23:59:59 JST. Readback may finish later. Original scheduled_at stays 20:00; actual created_at comes from the API. Normal 08/12/20 guards are unchanged.

## Materials verified

C3: 220 characters, 264 weighted (existing 270 limit), body SHA `26c5f32e27af3e78e6ccef7e5787975d87bc52125064100ed1ffd04663e0cacc`; image SHA `725e6f43e8646d9cde1854ebb7f7fa56a019754065f1fbedf8b8c57406e2efcd`, 1,763,042 bytes, 1122×1402. Both actual bytes received and independently verified; image inspected visually.

Weekly: corrected 3666-character body SHA `53f78684e77085b507f4560f27ba99494b93f6284cff5f6337fc77ad9bb77bf7`; header SHA `942e01723fb38a040ad5f2cb449469599b5e22430f4c4a3051af62566357220a`, 1,651,875 bytes, 1983×793. Material adapter preserves all text/newlines and makes all six source URLs clickable (five principal sources plus GitHub Docs). Parent reports J8 saved and fully read back. Weekly state reserves these materials; budget remains null until real fee review. The existing empty draft is not reused.

## Connected execution

- `scripts/ai-news/c3-bridge.mjs`: fixed material and cost validation; upload/post/verify each issues exactly one request. `LIVE_READY=false` is the sole production hold for this runner; no env/input override. The earlier standalone `ai_news_c3_catchup.mjs` remains a helper and is not a second live gate.
- `c3-git.mjs` and `c3-parent.mjs`: parent commits/pushes claim or result to a dedicated clean checkout at fresh main, then fetches and verifies it. Ordinary non-force push provides optimistic concurrency; failure is not retried/rebased. Only C3 state and top-level history are written. Competing changes are preserved.
- `c3-run.mjs` and `x-ai-news-c3-catchup.yml`: gate before X Secrets; bind one stage to actual run ID, attempt 1 and code SHA; wait for parent Git claim, then re-fetch/revalidate state/history immediately before HTTP. Workflow retains existing four OAuth1 Secrets and contents:read. No schedule or new credentials/scopes.
- Local fsynced exclusive intent protects repeated invocation within a runner. Git stage claims cannot be reassigned to another run, including expired, failed or unknown stages. Rerun attempt 2 is rejected. A crash burns the claim even if no HTTP happened; no automatic release exists.
- Parent applies upload receipt before post becomes eligible; applies POST receipt before GET becomes eligible. Unknown POST gets a durable history tombstone; returned IDs are retained even in ambiguous errors. Neither a new clone nor new run can resend it.
- GET verifies exact post/author, standalone status, expected attachment, text (including evidence-backed t.co normalization), and plausible API created_at. Only then history becomes published_verified. Wrong or incomplete readback stays unknown and never triggers another POST. 24h/72h/7d due times derive from created_at, never scheduled_at. Due timestamps are planning records, not fabricated measurements or scheduled paid requests.
- Fees are maximum reservations per stage, never actual cash charges. Unknown outcome retains the reservation. Parent must account for shared-app usage before issuing each claim; no root/Founder cash ledger is modified or prepaid acquisition double-booked.

## Operation after final fee verification

This package has not been pushed or dispatched. Deploying the reviewed commits remains a parent operation under the existing authorization; this document grants no new authorization. Until real all-in prices are known, keep LIVE_READY false and do not call any X endpoint.

After prices are resolved and the local package is promoted, enable the source gate in a reviewed commit, then for each stage upload → post → verify:

1. Dispatch that stage once. Read its actual run ID and code SHA from the gate log. Do not rerun a previous run.
2. In a separate clean checkout at current main, create claim JSON: stage, run_id, code_sha, expires_at (within 15 minutes), cost. Cost must contain all_in_known, upload_price_confirmed, tax_fx_shared_allocation_confirmed, overshoot_bound_confirmed, shared_app_reservation_confirmed (all true); evidence; checked_at (within 15 minutes); budget_month; positive max_jpy/max_usd; and current month_remaining_jpy, credit_remaining_usd, cycle_remaining_usd covering the maximum. Mock values are forbidden. Month remaining must be ≤3000 JPY. Unknown quantitative overshoot/shared-app exposure is a blocker, not zero cost.
3. Run `node scripts/ai-news/c3-parent.mjs claim CLAIM_JSON CLEAN_CHECKOUT`. Success means the claim was committed, pushed and read back. The waiting runner consumes only its exact claim.
4. Read the non-secret result artifact (or intent artifact if it crashed before result), and run `node scripts/ai-news/c3-parent.mjs apply RECEIPT_JSON CLEAN_CHECKOUT`. It checks the receipt against the actual committed intent, atomically commits state/history, pushes, and verifies. A crash intent is persisted as unknown. Never synthesize a confirmed response.
5. Continue only after confirmed result persistence. On unknown, stop and reconcile; no automatic retry/reset. Once verify is persisted, synchronize actual publication ID/time and measurement due times to SOT through the parent workflow. This package does not write the Sheet or change its columns.

API schema references: [media upload](https://docs.x.com/x-api/media/upload-media), [create post](https://docs.x.com/x-api/posts/create-post). [Automation rules](https://help.x.com/en/rules-and-policies/x-automation) and [developer guidelines](https://docs.x.com/developer-guidelines) rechecked. No likes, replies, quotes, non-API browser automation, or new OAuth flow is implemented.

## Validation

Real local bare Git remote + parent/runner clones: claim/readback, actual material validation, mocked upload/post/GET, durable result/history, and exact 24h/72h/7d dates pass. Unknown POST persists across fresh clones and blocks resend. Stale parent checkout stops without overwriting remote work. Cost unknown, price mock/stale, over-budget, duplicate, expired claim, run mismatch, material drift, wrong body/author/image/time/reply, and live gate cases are covered.

Real images exposed the default 1MiB child-process output limit; C3, existing daily media loader and weekly runner now allow 8MiB while existing image size limits remain unchanged.

No real API call, workflow dispatch, live claim, real result/history mutation, push, merge, credential readout, billing change, or other-business/Founder change was performed during implementation. Mock Git pushes target only disposable local bare repositories. Only final all-in fee evidence remains an external readiness input for C3; ordinary deployment/run/claim/result steps are implemented above.

## Owner-approved one-image price measurement (supersedes price hold for upload only)

Owner Slack message `1791120054.652269`, channel `C0C698PFHPG`, thread `1791083855.285109`, explicitly directs uploading one image before calculating its fee. Parent scoped this to the exact C3 image, one request, existing authentication and billing settings. `UPLOAD_PROBE_ENABLED` admits only the upload stage with that exact grant, unknown price retained, and a fresh parent-provided pre-cost snapshot. `LIVE_READY` remains false; post, verify and Weekly are not enabled.

The approved baseline is $3.59 credits, $1.41 cycle usage, $5 cycle cap, auto-charge OFF. These are account snapshot values, not an upload unit-price quote. A change invalidates this specific baseline. The parent must signal that the before-cost snapshot is complete before dispatch/claim. Claim validation requires the snapshot to be at most five minutes old. The remaining monthly budget is reserved during the experiment, not represented as an estimated or actual charge. Actual USD/JPY remain null until the parent's billing reconciliation. No monthly budget increase, auto-charge change, new key or OAuth scope is permitted.

Unknown response consumes the upload attempt permanently; no second upload, post or automatic retry. Persist the result/intent through the same parent Git command. A safe response summary includes returned media ID/key, TTL, dimensions/size when present and HTTP status; raw transport exceptions, authorization headers and arbitrary remote error text are excluded. This summary and the receipt preserve evidence without exposing credentials. The parent checks before/after billing; no billable pricing GET is added by the runner.

Implementation validation: 205 offline tests pass, including exact one-upload exception, required pre-cost snapshot, unchanged normal post/verify hold, zero-price/changed-cap/auto-charge rejection and consumed-upload replay prevention. No actual upload had been attempted when this addendum was written.
