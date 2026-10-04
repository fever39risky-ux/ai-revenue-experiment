# C3 single catch-up: offline implementation review

Scope: C-20261004-003 only, 2026-10-04 21:00–23:59:59 JST. The original scheduled_at remains 20:00 JST. Other dates and posts receive no exception. This module is deliberately not connected to the publisher or workflow. Existing 08/12/20 guards are unchanged. `executeLive()` always throws before credentials/network; there is no environment override.

Pinned hashes:
- Body: `26c5f32e27af3e78e6ccef7e5787975d87bc52125064100ed1ffd04663e0cacc`
- Image: `725e6f43e8646d9cde1854ebb7f7fa56a019754065f1fbedf8b8c57406e2efcd`

`validateIntent` checks fixed identity, exact run ID, attempt 1, code SHA, history digest, maximum 15-minute claim, duplicates including unknown outcomes, known all-in costs and remaining JPY/USD limits. This is metadata validation, not proof that supplied Git data is current or cost evidence is authoritative. No returned object is an authorization to publish. Mock fee numbers are synthetic arithmetic fixtures, not actual tariffs.

`verifyMaterials` requires the actual body and image bytes to match the fixed hashes; declared hashes alone cannot pass. The real materials have not been received, so the successful material-verification path cannot yet be demonstrated. Existing media receipt/QA/expiry, 270-weighted-character and attachment checks must also run before any future connection.

`reserveMockAttempt` writes an exclusive fsynced local crash marker. Unknown POST results leave it consumed. This tests local no-retry behavior only; it does not claim to prevent duplicates across fresh CI runners. There is intentionally no live POST transport or retry/release function.

Remaining integration conditions:
1. Receive the exact C3 text/image bytes and approved upload receipt; verify against the pinned hashes and existing editorial/media checks.
2. Establish actual image upload cost, taxes/FX/shared-app attribution, and a quantitative worst-case bound for cap/credit overshoot. Recheck available budget; unknown costs block live APIs. Nominal credit balance is not a worst-case quote.
3. Implement and test parent-persisted Git claim for one actual run, fresh remote history revalidation immediately before POST, and durable unknown/success result reconciliation. A local crash marker alone is insufficient. Review the production wiring only after these conditions are met.

No queue, production history, workflow, credentials, billing configuration, Founder state, or remote branch was changed. No upload, POST, paid GET, dispatch, push or merge was performed for this package.

Weekly corrected body hash was received as `53f78684e77085b507f4560f27ba99494b93f6284cff5f6337fc77ad9bb77bf7` (reported 3666 characters). Its actual body and SOT confirmation remain outstanding; this package does not publish or synthesize it.

Validation: 30 new offline tests, 154 total passing with daily slots/media and weekly suites. The test fixture's successful metadata check is not a successful publication or full integration test.
