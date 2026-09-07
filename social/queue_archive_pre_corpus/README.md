# Archived pre-voice-corpus queue items

These 2 items were written before `marketing/X_VOICE_CORPUS.md` /
`X_VOICE_GUIDE.md` existed, as standalone tweets via `scripts/post_x.mjs`'s
generic queue (`social/queue/`). They were never posted -- `social-x.yml`'s
cron was paused before it could drain them (see `ops/AGENT_LOOP.md`'s
2026-09-07 iteration-log entries).

Moved here (not posted, not deleted) on 2026-09-07 when the owner approved
resuming automatic X posting under the new judgment-gated,
`X_ROOT_POST_ID`-reply system (`scripts/x_post_experiment_commentary.mjs`).
Posting these now, unreviewed against the real voice corpus and without a
Voice-fingerprint self-check, would be exactly the "AI-sounding, not the
owner's voice" outcome the corpus work was built to prevent -- so they were
pulled out of the live queue rather than auto-drained on the cron's first
resumed tick.
