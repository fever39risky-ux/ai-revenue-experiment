# AI Revenue Experiment — entry point for every Claude session

**From 2026-10-01 00:00 JST this repo runs Phase 2 (October).** Read `ops/2026-10/BOOTSTRAP.md` now and follow it — it tells you your role (Founder or a named operator), what to load, and how to act. No owner explanation is needed.

- Day 0 = 2026-09-30 (preparation, not counted). Phase 2 = 2026-10-01 … 10-31 JST.
- Live picture: `node scripts/oct/ops.mjs board`
- Constitution (mission, results, pivot/stop rules, human boundary): `ops/2026-10/CONSTITUTION.md`
- September (Phase 1) logs/ledgers are read-only history (September *assets* are reusable supply, Constitution Art. 5.5): never write October data into `status/revenue_ledger.json`, `status/cost_ledger.json`, `status/EVENTS.jsonl`, `status/CURRENT_STATUS.json`.
- Before pushing: `node scripts/leak_check.mjs && node scripts/promotion_check.mjs`. Push to your `claude/**` branch or main; `claude/**` is auto-promoted by `.github/workflows/promote-branch.yml`.
