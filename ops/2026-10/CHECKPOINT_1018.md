# 10/18 falsification checkpoint — Sales Motion redesign (owner rule 2026-10-15)

Runs in the **first Founder fire dated 2026-10-18 JST** (task `checkpoint-1018`). Its decision report must carry a `checkpoint_1018` block; `decision_check.mjs` rejects the earliest 10/18 report without it.

## Rule
- If buyer replies across CrowdWorks + Coconala (+ any channel) are still **0** → the current Sales Motion (applying to public jobs/requests) is falsified for October. **Redesign at L4 or higher is mandatory.**
- **Forbidden conclusion:** "continue because the proposal count is low / under-volume / not enough data". Low volume is itself evidence that the motion cannot be fed — it is a reason to redesign, not to wait. (decision_check rejects that wording when replies are 0.)
- If ≥ 1 reply exists → work it end-to-end first (Art.10); the block still records the comparison and why the motion stays.

## Required comparison (`checkpoint_1018.options`, all six)
| key | question |
|---|---|
| `buyer_segment` | a different buyer (e.g. small agencies / tax-accountant offices / EC sellers / existing September buyers) |
| `offer` | a different proposal / offer (productized fixed-scope deliverable, audit, template + setup …) |
| `price` | a different price / ticket (¥3k entry, ¥15–30k package, monthly) |
| `job_selection` | a different job-selection rule (category, size, buyer quality, timing) |
| `channel` | a different channel (Lancers, ココナラ出品の作り直し, X, note, direct site …) |
| `other_sales_motion` | a motion other than applying to public jobs (instant-buy productized gig, inbound listing, content-led, referral …) |

Each option: `{ "option": "...", "expected_effect": "...", "cost": "...", "evidence": "...", "score": <number> }`. Then `chosen` (one or more keys), `level` (`L4`/`L5`), `why`, `rejected` (reason per unchosen key).

## Execution in the same fire (`checkpoint_1018.executed`)
- `stopped_tasks`: task ids stopped / marked done-cancelled now (≥ 1 when replies are 0: the motion being replaced)
- `new_tasks`: task ids created now for the chosen redesign (must exist in `status/2026-10/tasks/`)
- `reallocation`: which operator's capacity moves where (mac-local / founder), effective now
- plus `redesign` event (`--level L4|L5 --from ... --to ...`) and STATE hypotheses/priority_actions updated.
