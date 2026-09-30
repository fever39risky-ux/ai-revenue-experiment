# Acceptance check — <job-id>

Run before handing to `mac-local`. Every box must be ticked or explained. We deliver only what we verified.

## Correctness
- [ ] Tested on dummy data that matches the buyer's structure
- [ ] Node-testable logic: `node .../test.mjs` exits 0 (attach output)
- [ ] Edge cases handled: empty rows, blank cells, unexpected characters, duplicate keys, wrong types
- [ ] Output matches what the intake promised (columns, order, totals)

## GAS-only parts (cannot run in this repo's runtime — verify by reasoning + checklist, not guessing)
- [ ] Triggers: correct event type (onOpen / onFormSubmit / time-driven) and installed by an init function
- [ ] Auth scopes are minimal and match what the script touches (Sheets only, or + Gmail, etc.)
- [ ] 6-minute execution limit respected (batching / resume) for large inputs
- [ ] API-key read from Script Properties, never hard-coded; missing-key path returns a clear message
- [ ] Budget cap / PII mask behave as the CONFIG says

## Safety & honesty
- [ ] No buyer PII in any delivered file or in the repo
- [ ] No secrets (`node scripts/leak_check.mjs` green)
- [ ] 手順書 states AI-assisted production; nothing over-promised
- [ ] Scope matches the agreement; anything out of scope is noted, not silently added

## Handoff
- [ ] `DELIVERY_MESSAGE.md` filled
- [ ] Files packaged (script + 手順書)
- [ ] Handoff task created for `mac-local`
