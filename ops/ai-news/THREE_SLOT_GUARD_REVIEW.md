# AI news slot guard — local proposal only

Base main: ca4cdd038d8ac4cf2a81c3811ae1bfd8c129f3e5.
Read-only audit on 2026-10-04 ~11:53 JST: dedicated queue absent;
Actions in_progress/queued/waiting/pending/requested each 0.

Current publisher checks every history.posts entry with date equal to today's JST
and post_type=top_level BEFORE reading queue identity. Morning receipt
C-20261004-001 / 2106524258906337476 therefore necessarily blocks noon (exit0,
no POST). Green workflow does not imply publication.

Local change introduces an explicit ai_news-only exception, not removal of cap.
Required extra noon queue fields:

    publication_lane: ai_news
    news_slot: "12"
    date: "2026-10-04"
    content_id: C-20261004-002
    scheduled_at: "2026-10-04T12:00:00+09:00"
    body_sha256: SHA256 of final exact UTF-8 text

Keep existing required editorial fields. No queue was staged here. IDs map to
08→001,12→002,20→003 on each JST date. Conservative implementation assumption:
a slot can execute only in its named hour (12:00:00–12:59:59.999 for noon), with no
catch-up during a later hour; this allows the observed 08:18 morning delay.
No schedule/automatic dispatch is introduced.

Successful news receipts and TOPLEVEL_RESULT retain lane, slot, content ID,
scheduled_at and body hash, so parent can persist the exact result. Every matching
content ID/body hash (including calculated historical text hash) blocks another
send. A consumed slot blocks regardless of receipt status, including unknown.
Morning's one legacy receipt without a lane is recognized only by its known
content ID + tweet ID + hash; historical data is not edited. Malformed same-day
news slot records fail closed. News self-reply/quote/media fields are refused.

Legacy queues retain their original all-top-level 1/day test, including AI news
receipts. This deliberately does not grant Founder any additional capacity.
Phase2 12:37 is independent: .github/workflows/x-phase2.yml runs
scripts/oct/x_phase2.mjs against social/2026-10/queue and posted.jsonl; MAX_PER_DAY=2.
It does not read x_experiment_history.json or this helper. No Phase2/workflow,
authentication, Secrets, state/history or other-business file was changed.
No guarantee that the other business will actually post at 12:37: its own due
queue/day cap applies. Account-wide total may exceed three because that separate
lane remains unchanged; this is not an account-wide cap redesign.

This narrow change does NOT solve existing runner-local history/queue durability
or ambiguous POST retry hazards. Parent must persist intent before dispatch,
record returned result and remove consumed queue durably, refuse any second run
when outcome is unknown, and recheck active runs immediately before execution.
Do not treat this mock test success as live authorization. No push/dispatch/X API
calls performed. Article-only workflow approval remains pending.

Verification: node --test tests/test_ai_news_slots.mjs (27 cases); real morning
fixture; full publisher with dummy OAuth env, overridden fetch/clock in isolated
temp cwd; noon 1 POST + 1 GET only, early/legacy/morning 0 calls. Leak check passed.

Timing/learning disclosure: the one-hour window is a NEW proposed conservative
execution rule, not a claim that the user specified a one-hour tolerance. A post
at 12:18 is recorded as planned_slot=12:00 / actual API created_at=12:18, with
18 minutes delay; never call it an exact noon publication or attribute its outcome
to a tested 12:00 posting effect. Keep scheduled_at separate from created_at and
posted_at. Compute 24h/72h/7d measurement windows from API created_at, not slot time.
Current script emits created_at in TOPLEVEL_RESULT; parent must persist that value.
This change does not implement causal analysis or automatic metrics collection.
