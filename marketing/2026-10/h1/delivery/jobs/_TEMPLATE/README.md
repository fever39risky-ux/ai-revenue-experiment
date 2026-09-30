# Job skeleton

Copy this folder to `jobs/<job-id>/` when a proposal is won. Then:

1. `INTAKE.md`   ← from `../../templates/INTAKE.md` (fill scope, no PII)
2. Reuse a base script from the README reuse map, or write the transform here
3. `dummy_input.*` + `expected_output.*` + `test.mjs` (node-testable logic) — see `../example-csv-aggregate/`
4. `TEJUNSHO.md`  ← from `../../templates/TEJUNSHO.md`
5. `ACCEPTANCE_CHECK.md` ← from `../../templates/ACCEPTANCE_CHECK.md`
6. `DELIVERY_MESSAGE.md` ← from `../../templates/DELIVERY_MESSAGE.md`

Files delivered to the buyer live here. Never commit buyer PII.
