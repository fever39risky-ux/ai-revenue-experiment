# Founder decision report (required at the end of every Founder fire)

A Founder fire report is a **management decision report**, not an observation log. "We looked at the numbers" is never a complete entry.

## Format

One file per fire: `status/2026-10/decisions/<YYYY-MM-DDTHHMM>.json` (JST), validated by `node scripts/oct/decision_check.mjs` (also run by `promotion_check.mjs`, so a malformed report blocks promotion). The daily report shows the latest one.

```json
{
  "fire": "2026-10-05T20:07+09:00",
  "author": "founder",
  "lanes": {
    "<lane>": {
      "fact": "what happened — numbers with their source",
      "interpretation": "what the numbers mean; which hypothesis got stronger/weaker and why",
      "decision": "continue | improve | shrink | stop | expand",
      "next_action": "the concrete next step (who, what, where); a task id if one was created",
      "deadline_trigger": "when (a date) and on what condition the next decision is made"
    }
  }
}
```

## Rules
- **Required lanes, every fire:** `company` (revenue / net profit / goal ladder), `x`, `coconala_proposals` (H1), `coconala_listing` (H3), `booth`, `stripe_gumroad`, `note`, `zenn`, `etsy`. A lane with nothing new still gets a decision ("continue" or "shrink"), never a blank.
- `decision` must be one of: continue (継続), improve (改善), shrink (縮小), stop (停止), expand (拡大).
- `deadline_trigger` must contain a date (`10/08` or `2026-10-08`) **and** a condition. "Keep watching" is not a trigger.
- `interpretation` must name the hypothesis effect (strengthened / weakened / unchanged, and which H).
- The decision is executed in the same fire where possible (tasks created, queue edited, STATE updated); the report states what was executed.
- When a trigger fires, the next report must apply it (no silent extension of deadlines).
