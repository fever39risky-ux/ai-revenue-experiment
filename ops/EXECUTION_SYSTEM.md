# Execution System — how the AI runs this experiment

The AI (Claude Code) acts as **CEO + strategist + orchestrator + executor** for
this revenue experiment. This file records the *execution capabilities* it
builds/uses — subagents, skills, tools, connectors — with ROI rationale, so the
system is legible and prunable. Rule: **nothing here exists for its own sake; it
must increase revenue speed or quality, or it gets deleted.**

Single KPI: **real verified revenue from a third party.** First target: ¥1/$1.

## Current constraint model (why the system is shaped this way)
- Payments: **SOLVED.** Stripe live rail is built and the store is live.
- Binding constraint: **DISTRIBUTION / DEMAND.** A no-audience GitHub Pages store
  gets ~0 traffic. Getting the offer in front of buyers is the whole game now.
- Capability boundary: the AI can research the web (WebSearch/WebFetch), edit &
  push this repo (→ GitHub Pages, GitHub Actions), and use connectors: Stripe,
  Gmail, Google Drive, Notion, GitHub. It CANNOT post to social or operate
  logged-in external sites. So distribution must come from (a) marketplaces that
  bring their own buyers, (b) APIs the AI can drive, or (c) a ONE-TIME human
  capability grant (connect account / restricted API key) after which the AI
  operates it autonomously.

## Roster (active)
| # | Unit | Type | Job | Revenue lane | ROI status |
|---|------|------|-----|--------------|-----------|
| A | Market & Channel analyst | subagent (bg) | Rank fastest no-audience channels to a first sale; validate/adjust the $19 offer | digital_product | running |
| B | Automation/Capability recon | subagent (bg) | Find API/connector paths the AI can drive itself, and the single best one-time capability to request | distribution | running |

## Decisions log
- 2026-08-25: Payment rail built & store went live (Stripe). Focus shifted to demand.
- 2026-08-25: Spun up 2 parallel research subagents (A, B) instead of serial
  self-research — the platform landscape is a large fan-out and splits cleanly
  into "which channel" vs "what to automate". Will prune to 0 standing agents
  once the channel decision is made (research is one-shot, not a standing team).

## Principles (from the owner's mandate)
1. Prefer reuse (existing skills/MCP/APIs) over building.
2. Build a skill/subagent/script only if it raises future revenue speed/quality.
3. Brief every subagent with the *top-level revenue goal*, not just a sub-task.
4. Orchestrator (this AI) makes the final call; never rubber-stamp an agent's output.
5. Ask the human for **capabilities/access**, not manual labor. Only fall back to
   human labor for identity/KYC/bank/OAuth/consent that only a person can grant.
6. Prune ruthlessly: unused agent/skill/tool → stop/merge/delete.

## Skills built
- (none yet — will create only when a repeatable, revenue-relevant procedure is
  proven, e.g. "list a digital product on marketplace X via API".)
