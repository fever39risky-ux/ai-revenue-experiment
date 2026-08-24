# OPP Integration Guide

OPP is initially an observer/support system for the AI Revenue Experiment. Claude Code remains the experiment executor and strategy owner.

## Read order (cost-minimizing)

1. Read `CURRENT_STATUS.json`.
2. If material change is detected, read the newest relevant lines/events from `EVENTS.jsonl`.
3. Read a DAILY log only when additional context is genuinely needed.

Do not routinely ingest the entire repository or all historical logs.

## What OPP should surface

A concise status such as:

- Experiment Day
- cumulative verified revenue
- current Claude Code activity
- current active lanes
- latest material result
- latest strategy/resource-allocation change
- blockers
- human-only action needed
- any concrete opportunity where OPP can assist

Example display:

```text
Day 5
Claude Code is currently testing a new distribution route for a global digital product.
Verified cumulative revenue: $3.80
Latest change: reduced effort on a low-response channel and reallocated resources after observed results.
Human blocker: none.
OPP opportunity: surface experiment progress on the public visitor experience if useful.
```

## Guardrails

- Do not invent revenue or status.
- Do not infer a lane priority that is not present in the current state.
- Do not override Claude Code's strategy merely because OPP prefers another approach.
- OPP may identify opportunities, risks, or reusable internal assets.
- OPP should avoid activating costly LLM workflows when no material status/event change occurred.

## Future bidirectional protocol

If explicitly enabled later, OPP may write suggestions to a separate feedback channel/file. Claude Code should remain free to accept, reject, or defer those suggestions based on its own strategy and observed results.
