# Standing permissions (owner grants) — Phase 2

Operators act on these without asking the owner again, as long as **every** condition holds. A grant is revoked or changed only by the owner editing this file. Each use is logged as an event that cites the grant id.

## PG-1 — Coconala sales motion for mac-local (granted 2026-10-04 by the owner, standing)

**Who:** operator `mac-local` (and any Phase-2 operator acting on Coconala through the dedicated Coconala profile), on the owner's existing Coconala account.

**Allowed without owner confirmation:**
- applying to public requests (公開依頼への応募)
- writing proposal text (提案文作成)
- stating a price (価格提示)
- stating a delivery date (納期提示)
- pre-order messages inside Coconala (ココナラ内の受注前メッセージ対応)
- replying to quote consultations (見積り相談への返信)

**Conditions (all must hold; check and record them per proposal):**
1. Deliverable with current capabilities and existing assets (現在の能力・既存資産で納品可能)
2. Expected to be profitable after Coconala fees (利益が見込める)
3. Delivery risk not excessive (納期リスクが過大でない)
4. No false track record or credentials (虚偽の実績・経歴を使わない)
5. Complies with Coconala terms (ココナラ規約を守る)
6. No steering to external contact details (外部連絡先へ誘導しない)
7. No spending, purchases, legal consents or identity verification (支出・購入・法的同意・本人確認は行わない)

**Not covered:** accepting an order that changes these terms, refunds/cancellations, disputes, anything outside Coconala. These go back to the owner as a single Coconala-only request.

**Measurement:** the number of proposals is **not** a KPI. What counts is the market response: replies, consultations (`sales_conversation`, `inquiry`), orders and revenue (ops/2026-10/KPI.md). `proposal_sent` is logged only as activity, to compute conversion.

**Per-proposal record:** `node scripts/oct/ops.mjs event mac-local proposal_sent --grant PG-1 --request <url> --price <yen> --days <n> --conditions "1..7 ok: <one line each>"` plus `signal ... proposal_sent`. If any condition fails, do not send; record which one.

## PG-2 — CrowdWorks sales motion for mac-local (granted 2026-10-11 00:0x JST by the owner, standing)

**Who:** operator `mac-local` (and any Phase-2 operator acting on CrowdWorks through the dedicated `crowdworks-profile`), on the owner's CrowdWorks account.

**Allowed without owner confirmation:**
- applying to public jobs (公開案件への応募)
- writing and sending proposal text (提案文作成・送信)
- stating a price (価格提示)
- stating a delivery date (納期提示)
- pre-order messages inside CrowdWorks (受注前メッセージ対応)
- replying to quote / condition questions (見積り・条件確認への返信)

**Conditions (all must hold; check and record them per proposal):**
1. Deliverable with current capabilities and existing assets (現在の能力・既存資産で納品可能)
2. Expected to be profitable after CrowdWorks fees (手数料を考慮して利益が見込める)
3. Delivery risk not excessive (納期リスクが過大でない)
4. No false track record, history or credentials (虚偽の実績・経歴・資格を使わない)
5. Complies with CrowdWorks terms (CrowdWorksの規約を守る)
6. No steering to external contact details (外部連絡先へ誘導しない)
7. No spending, purchases, legal consents or identity verification (支出・購入・法的同意・本人確認を伴わない)
8. No more personal or confidential information than the job needs (個人情報・機密情報を必要以上に取得しない)

**Owner instruction:** for jobs that meet the conditions, send without returning to the owner each time.

**Not covered:** accepting a contract (契約締結) that changes these terms, refunds/cancellations, disputes, anything outside CrowdWorks. These go back to the owner as a single CrowdWorks-only request.

**Per-proposal record:** `node scripts/oct/ops.mjs event mac-local proposal_sent --grant PG-2 --request <url> --price <yen> --days <n> --conditions "1..8 ok: <one line each>"` plus `signal mac-local proposal_sent 1 --channel crowdworks ...`. If any condition fails, do not send; record which one. As with PG-1, the proposal count is not a KPI.
