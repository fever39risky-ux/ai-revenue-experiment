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

### Exact operations
1. Open **https://claude.ai/code** and sign in.
2. Open the **`fever39risky-ux/ai-revenue-experiment`** repository/environment (so the Routine is bound to THIS repo, not ai-company-system).
3. Open **Routines / Scheduled tasks** (the clock/schedule icon or "Automations" menu) → **New / Create routine**.
4. Fill in:
   - **Name:** `AI Revenue Experiment — autonomous loop (Sep 2026)`
   - **Repository / source:** `ai-revenue-experiment` (write access).
   - **Runs in:** a **new session each time** (not "this session").
   - **Schedule:** once per day. If it accepts cron, use UTC **`7 11 * 9 *`** (= **20:07 JST daily, Sep 1–30**). If it only offers a time picker, choose **daily at 20:07 (Asia/Tokyo)** and, if it asks for a date range, Sep 1–30.
   - **Model:** leave default (Sonnet-class is fine and cheaper than Opus).
   - **Prompt:** paste the entire contents of **`ops/LOOP_PROMPT.txt`**.
5. Save. Then use **"Run now"** once to smoke-test.
6. **Verify it persisted:** within a few minutes, `ops/AGENT_LOOP.md` on `main` should gain a new "Loop self-test log" line and there should be a fresh commit. If yes → Path A works; the loop is live for September. If it still can't push → tell me and I'll build Path B.

### Cadence = 1×/day (economic decision, not fixed by the human)
The smoke-test measured **$3.30 / run**. 3×/day × 30d ≈ **$297** in Claude compute — almost the entire ¥50,000 target, so it fails the experiment's own economic-rationality test. **1×/day** (≈$99, and less once bound to this small repo with a lean prompt + early-stop) is the ROI-optimized default. I will keep re-evaluating this from real cost data and may lower it further.

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
