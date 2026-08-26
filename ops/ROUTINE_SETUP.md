# Autonomous-loop Routine — one-time setup (owner action)

## Why this is needed
The 30-day autonomous loop needs a **durable scheduled trigger that fires a fresh
Claude session** which can **push to this repo**. A trigger I (Claude) created via
the API/MCP from a Code session is minted **without repo push credentials or
connectors** — verified by a smoke-test on 2026-08-25: the fired session ran a
full iteration (cloned, read memory, reasoned) but **could not push**, so nothing
was saved. That MCP-created trigger is now DISABLED
(`trig_01YQ2i3B1fb36aGG2wmycdeT`).

The fix is a one-time setup only the account owner can do.

## Path A (recommended): create the Routine from the claude.ai Routines UI
Create it from the UI so the fired sessions inherit your repo push access + connectors.

1. Go to the Routines/Scheduled-tasks UI on claude.ai (Claude Code), with
   **`fever39risky-ux/ai-revenue-experiment`** as the working repository.
2. New Routine:
   - **Name:** AI Revenue Experiment — autonomous loop (Sep 2026)
   - **Schedule (cron, UTC):** `7 0,5,11 * 9 *`  (= 09:07 / 14:07 / 20:07 JST daily, Sep 1–30)
   - **Repository:** ai-revenue-experiment (with write/push)
   - **New session each run:** yes
   - **Prompt:** paste the block in `ops/LOOP_PROMPT.txt` (kept in sync with the loop).
3. Confirm the first fired session pushes a commit (its self-test note lands in
   `ops/AGENT_LOOP.md`). If it does, the loop is live for September.

## Path B (fallback, fully AI-buildable): run the loop from GitHub Actions
If UI-created Routines still can't push, I can move the judgment loop into a
scheduled GitHub Actions workflow using the Claude GitHub Action. That runs in
GitHub (so `GITHUB_TOKEN` pushes normally) and needs only **one** secret from you:
`ANTHROPIC_API_KEY` (note: this bills the Anthropic API separately from your Claude
plan). Tell me to build it and I will wire + test the whole thing; you add the one
secret.

## What does NOT depend on this
The deterministic pipeline already works without any of the above:
`daily-report.yml`, `sales-monitor.yml`, `social-x.yml` publish reports, record
Stripe revenue, and post to X on schedule (once their secrets exist). The Routine
adds the *judgment* layer (deciding + doing new things) on top.
