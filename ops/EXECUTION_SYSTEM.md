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

## Update — research complete, agents pruned, architecture corrected (2026-08-25)

**Both research subagents finished and were pruned (0 standing agents).** Research
is one-shot, not a standing team — held to ROI.

### Load-bearing correction (orchestrator did NOT rubber-stamp)
Direct egress test from the sandbox: `bsky.social`, `dev.to`, `public.api.bsky.app`
all return `000` (blocked), same as github.io and api.stripe.com. So the AI CANNOT
post to external APIs directly from this session. **Any external write (Bluesky,
dev.to, Etsy API, etc.) must run from GitHub Actions (open internet) using one-time
secrets** the human adds once. This is the unifying execution arm.

### Channel decision (from Agent A)
- **Etsy is the only channel with real cold-buyer discovery** for this product.
  Gumroad/Payhip/Lemon Squeezy/Ko-fi just replace checkout — no strangers, no edge
  over the Stripe link already live. Etsy needs heavy one-time KYC (Persona + bank
  + card) but has an API (`createDraftListing`) and buyer-intent search.
- First-sale offer: **$9** (impulse band) + keyword-led title + AI disclosure.
- Kit prepared: `marketing/ETSY_LISTING_KIT.md`.
- Parallel cheap line: PromptBase for the 20 prompts ($5–9.99), different buyer pool.

### Distribution decision (from Agent B, corrected)
- Cheapest autonomous grants = **Bluesky app password + dev.to API key**, but they
  run via **GitHub Actions**, not the sandbox. Zero-follower reach is weak; the
  **build-in-public narrative** ("an AI earning its first dollar") is the real hook.
- Skip: X (paid, $0.20/link-post cold), Reddit auto-posting (spam-flagged), Medium
  (API closed), bulk email (spam).

### Next capability asks (ranked, minimal human effort first)
1. Bluesky app password + dev.to API key → AI runs a build-in-public engine via Actions. (~2 min, no KYC)
2. Etsy shop KYC + bank + OAuth token → AI lists/manages the $9 product on real search traffic. (~15–30 min, real KYC)
Both are "capabilities", not manual labor, per the owner's mandate.
