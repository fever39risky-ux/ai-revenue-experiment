# Etsy Listing Kit — The No-Code AI Automation Toolkit

Everything needed to list on Etsy (the only channel with real cold-buyer search
traffic for this product). The AI prepared all of this; the human's only step is
the identity/bank/OAuth setup Etsy legally requires. On Etsy, **Etsy handles
payment + digital delivery + is merchant of record** — so Etsy sales do NOT use
our Stripe rail; we upload the ZIP to the listing and Etsy delivers it.

## Pricing (first-sale strategy)
- **List price: $9.00 USD.** Rationale: KPI is the FIRST verified sale, not
  margin. Digital bundles from unknown sellers convert best in the $5–$15 impulse
  band; $19 sits above the frictionless zone with zero reviews. Raise to $19
  after the first reviews land. Etsy fees ≈ 12–13% → net ≈ $7.8 on a $9 sale.

## Title (Etsy search-optimized, ≤140 chars, lead with searched terms)
ChatGPT Prompts + AI Automation Toolkit — 20 Business Prompts, No-Code Guide & Google Sheets Scripts (Instant Download)

## Tags (13 — all Etsy search phrases buyers actually type)
1. chatgpt prompts
2. ai automation
3. business prompts
4. ai toolkit
5. no code automation
6. productivity template
7. small business ai
8. google sheets script
9. ai workflow
10. prompt pack
11. digital download
12. solopreneur tools
13. work automation

## Category / attributes
- Category: Craft Supplies & Tools → Digital → (Templates / Guides)
- Type: Digital download (auto-delivery)
- Files: `ai-automation-toolkit-8f3a2c.zip` (already built; upload to listing)

## Description
Stop reading about AI — start automating today. This no-code toolkit gives you
10 copy-paste AI workflows, 2 ready-to-run Google Apps Script tools, 20 business
prompts (CSV), and templates that cut 20+ hours/month of repetitive work. Built
for solopreneurs, freelancers, and small teams. No coding required.

What's inside:
• 10 workflows — email replies, meeting notes → minutes + tasks, spreadsheet
  cleanup, batch copy, invoices, prompt library, AI compliance check, bulk
  processing, auto reports, and building your own tools.
• 2 working Google Apps Script tools — bulk-process a sheet column with AI; send
  an automated daily summary email.
• 20 business prompts (CSV) — import straight into Sheets or Notion.
• Invoice template + a safety checklist + free updates.

You'll need: ChatGPT or Claude (free tier works) + Google Sheets. Some scripts
use a cheap pay-as-you-go OpenAI API key.

Instant download — you get the ZIP immediately after purchase. Digital product,
so no refunds after download. Questions? Message me any time.

**AI disclosure (required by Etsy policy — keep this line):**
Note: This toolkit's contents were created with the help of AI. It is an original
compiled product, not resold or drop-shipped.

## Listing images (needed — AI will generate)
Etsy needs at least 1 image (ideally 5+). AI to generate simple branded mockups:
a cover tile ("No-Code AI Automation Toolkit"), a "what's inside" checklist tile,
a prompts-preview tile. (Placeholder task — generate before publish.)

## Status (2026-09-01): shop is open, publishing capability is built
The shop-opening grant (Persona identity KYC + bank/card) is **done**. The
content below is now machine-readable in `marketing/etsy_listing_config.json`,
consumed by `scripts/etsy_publish.mjs`, which creates/images/attaches/
activates the listing via Etsy API v3 from GitHub Actions. The one remaining
one-time grant is the Etsy OAuth token — see `ops/ETSY_API_SETUP.md` for the
exact steps. Once granted, publishing (and any future price/content change)
runs from GitHub Actions with no manual listing paste.
