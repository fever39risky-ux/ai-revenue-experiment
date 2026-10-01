import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SHEET, sha, approvalHash, validatePackage, validateState } from './core.mjs';

export const TABS = { post: 'CODEX_投稿DB', queue: 'CODEX_予約投稿キュー', media: 'CODEX_メディアDB', news: 'GPT_ニュースDB', kpi: 'CODEX_KPI', learning: 'CODEX_学習DB' };
const KEY = { post: 'ContentID', queue: 'QueueID', media: 'ImageID', news: 'NewsID', kpi: 'KPIEventID', learning: 'LearningID' };
const check = (v, msg) => { if (!v) throw new Error(msg); };
const cell = (t, r, name) => { const i = t.headers.indexOf(name); check(i >= 0, `missing_header:${name}`); return r?.values[i] ?? ''; };
function table(s, kind) {
  check(s?.sheet_id === SHEET && s.tables && Number.isFinite(Date.parse(s.captured_at)), 'invalid_sheet_snapshot');
  const t = s.tables[TABS[kind]];
  check(t && Array.isArray(t.headers) && new Set(t.headers).size === t.headers.length && Array.isArray(t.rows), `invalid_table:${kind}`);
  check(t.headers.includes(KEY[kind]), `missing_key_header:${kind}`);
  check(t.rows.every(r => Number.isSafeInteger(r.row_number) && r.row_number > 1 && Array.isArray(r.values)), `invalid_rows:${kind}`);
  const ids = t.rows.map(r => cell(t, r, KEY[kind])).filter(Boolean);
  check(new Set(ids).size === ids.length, `duplicate_sheet_ids:${kind}`);
  return t;
}
function row(s, kind, id, required = true) {
  const t = table(s, kind), r = t.rows.find(r => cell(t, r, KEY[kind]) === id);
  check(r || !required, `missing_sheet_record:${kind}:${id}`); return { t, r, get: name => cell(t, r, name) };
}
const ref = (kind, id) => `${TABS[kind]}:${KEY[kind]}=${id}`;
function refId(p, kind) {
  const prefix = ref(kind, ''); const r = p.source_refs?.[kind];
  check(typeof r === 'string' && r.startsWith(prefix) && r.length > prefix.length, `unmapped_source_ref:${kind}`); return r.slice(prefix.length);
}
function linked(s, kind, column, id) {
  const t = table(s, kind), rows = t.rows.filter(r => cell(t, r, column) === id);
  check(rows.length === 1, `ambiguous_sheet_join:${kind}`); return cell(t, rows[0], KEY[kind]);
}
/** Prepare only: no publication approval is manufactured from a sheet status. */
export function preparePackage(snapshot, manifest) {
  const { content_id, image, text_fallback, handoff } = manifest;
  const p = row(snapshot, 'post', content_id);
  check(p.get('投稿媒体') === 'X', 'not_x_record');
  check(['draft', 'ready'].includes(p.get('投稿ステータス')), 'post_not_importable');
  check(!['投稿URL', 'XPostID', 'PlatformPostID', 'PublishedAt'].some(k => p.get(k)), 'already_published_record');
  const queueId = linked(snapshot, 'queue', 'ContentID', content_id), q = row(snapshot, 'queue', queueId);
  check(q.get('Platform') === 'X' && ['planned', 'ready'].includes(q.get('Status')) && !q.get('PostURL'), 'queue_not_importable');
  check(handoff?.confirmed === true && typeof handoff.evidence === 'string' && handoff.evidence.trim(), 'browser_handoff_unconfirmed');
  const text = p.get('投稿文_最終版'), digest = sha(text);
  check(text === q.get('PostText') && digest === p.get('BodyHash') && digest === q.get('BodyHash'), 'canonical_body_mismatch');
  check(p.get('予約日時') === q.get('ScheduledAt'), 'canonical_schedule_mismatch');
  const newsId = p.get('元NewsID'); check(newsId === q.get('NewsID'), 'canonical_news_mismatch');
  const n = row(snapshot, 'news', newsId);
  const urls = text.match(/https:\/\/\S+/g) || [];
  const primary = n.get('一次情報URL') || n.get('URL'); check(primary && urls.includes(primary), 'canonical_source_missing');
  const mediaId = linked(snapshot, 'media', '紐づくContentID', content_id), m = row(snapshot, 'media', mediaId);
  if (image) {
    check(q.get('MediaType') === 'Image' && m.get('RenderStatus') === 'success' && m.get('QAStatus') === 'pass', 'image_not_approved');
    check(image.sha256 === m.get('MediaHash'), 'canonical_media_hash_mismatch');
  } else check(text_fallback?.allowed && text_fallback.evidence && ['technical', 'approval'].includes(text_fallback.reason), 'fallback_evidence_required');
  const revision = manifest.attempt_revision ?? 1;
  check(Number.isSafeInteger(revision) && revision >= 1, 'invalid_attempt_revision');
  const id = content_id.toLowerCase() + (revision === 1 ? '' : `-r${revision}`);
  check(revision === 1 ? !manifest.previous_attempt_id : typeof manifest.previous_attempt_id === 'string' && manifest.previous_attempt_id !== id, 'previous_attempt_required');
  const pkg = { schema: 1, id, account: 'KinoshitaTsks', sheet_id: SHEET,
    topic_key: n.get('重複キー') || newsId.toLowerCase(), text, source_urls: urls,
    scheduled_at: q.get('ScheduledAt'), image: image || null, text_fallback,
    source_refs: { post: ref('post', content_id), queue: ref('queue', queueId), media: ref('media', mediaId), news: ref('news', newsId),
      ...(manifest.previous_attempt_id ? { previous_attempt: manifest.previous_attempt_id } : {}),
      kpi: `future-event:KPI-NEWS:${id}`, learning: `future-event:L-NEWS:${id}`, handoff_evidence: handoff.evidence }
  };
  // Validate structure with an explicitly temporary, non-publishable approval, then discard it.
  validatePackage({ ...pkg, approval: { by: 'structure-check-only', at: snapshot.captured_at, sha256: approvalHash(pkg) } });
  return { package: pkg, required_approval_sha256: approvalHash(pkg), source_body_sha256: digest };
}
export function acceptPrepared(prepared, approval) {
  check(approval?.sha256 === prepared.required_approval_sha256, 'parent_approval_missing');
  return validatePackage({ ...prepared.package, approval });
}
function ownNote(existing, id, payload) {
  const prefix = `[ai-news:${id}] `;
  const lines = String(existing || '').split('\n').filter(l => !l.startsWith(prefix));
  if (lines.length === 1 && lines[0] === '') lines.pop();
  return [...lines, prefix + JSON.stringify(payload)].join('\n');
}
const metric = (obj, key) => Number.isFinite(obj?.[key]) && obj[key] >= 0 ? obj[key] : '';
/** Produces CAS/upsert proposals only. It has no connector or network dependency. */
export function receiptPlan(snapshot, state, { run_id }) {
  validateState(state); check(typeof run_id === 'string' && /^[a-zA-Z0-9_.:-]+$/.test(run_id), 'invalid_run_id');
  const changes = [], seen = new Set();
  function update(kind, id, fields, canInsert = false) {
    check(!seen.has(`${kind}:${id}`), 'duplicate_projection_record'); seen.add(`${kind}:${id}`);
    const { t, r } = row(snapshot, kind, id, !canInsert);
    const cells = Object.entries(fields).map(([header, value]) => {
      const column = t.headers.indexOf(header); check(column >= 0, `missing_header:${header}`);
      return { header, column: column + 1, expected: cell(t, r, header), value: value ?? '' };
    }).filter(c => c.expected !== c.value);
    if (cells.length) changes.push({ sheet: TABS[kind], kind, key_header: KEY[kind], id, expect_exists: Boolean(r), row_hint: r?.row_number ?? null, headers_sha256: sha(JSON.stringify(t.headers)), cells });
  }
  const groups = new Map();
  for (const p of Object.values(state.posts)) {
    const id = refId(p, 'post'); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(p);
  }
  for (const attempts of groups.values()) {
    // Explicit successor links, not timestamps/order, determine the current attempt.
    const incoming = new Set(attempts.map(p => p.resolution?.replacement_id).filter(Boolean));
    const roots = attempts.filter(p => !incoming.has(p.id));
    check(roots.length === 1, 'ambiguous_attempt_history');
    const history = []; let p = roots[0];
    while (p) {
      check(!history.includes(p), 'cyclic_attempt_history'); history.push(p);
      const nextId = p.resolution?.replacement_id;
      if (!nextId) break;
      check(p.status === 'aborted_before_post' && !p.tweet_id && p.resolution.action === 'rescheduled', 'unsafe_attempt_successor');
      const next = attempts.find(x => x.id === nextId);
      if (!next) break; // Replacement approved/queued but has not started yet.
      check(next.source_refs.previous_attempt === p.id && ['post', 'queue', 'media', 'news'].every(k => next.source_refs[k] === p.source_refs[k]), 'attempt_source_mismatch');
      p = next;
    }
    check(history.length === attempts.length, 'disconnected_attempt_history');
    const historyOnly = p.status === 'aborted_before_post' && p.resolution?.action === 'rescheduled';
    const contentId = refId(p, 'post'), queueId = refId(p, 'queue'), mediaId = refId(p, 'media');
    const post = row(snapshot, 'post', contentId), q = row(snapshot, 'queue', queueId), m = row(snapshot, 'media', mediaId);
    check(q.get('ContentID') === contentId && m.get('紐づくContentID') === contentId, 'receipt_join_mismatch');
    if (!historyOnly) {
    check(sha(p.text) === post.get('BodyHash') && sha(p.text) === q.get('BodyHash') && post.get('投稿文_最終版') === p.text && q.get('PostText') === p.text, 'receipt_canonical_changed');
    check(post.get('予約日時') === p.scheduled_at && q.get('ScheduledAt') === p.scheduled_at, 'receipt_schedule_changed');
    if (post.get('XPostID')) check(post.get('XPostID') === p.tweet_id, 'receipt_existing_id_conflict');
    if (post.get('PlatformPostID')) check(post.get('PlatformPostID') === p.tweet_id, 'receipt_existing_id_conflict');
    }
    const url = p.tweet_id ? `https://x.com/KinoshitaTsks/status/${p.tweet_id}` : '';
    for (const oldUrl of [post.get('投稿URL'), q.get('PostURL')]) check(!oldUrl || oldUrl === url, 'receipt_existing_url_conflict');
    const verified = p.status === 'verified';
    check(!verified || (p.tweet_id && Number.isFinite(Date.parse(p.published_at))), 'verified_receipt_incomplete');
    const blocked = !verified && (state.halt || ['post_intent', 'upload_intent', 'posted_unverified'].includes(p.status));
    const status = p.status === 'aborted_before_post' ? (p.resolution ? 'cancelled' : 'blocked') : verified ? 'posted' : blocked ? 'blocked' : 'ready';
    let postNote = post.get('備考'), mediaNote = m.get('備考');
    for (const attempt of history) {
      postNote = ownNote(postNote, attempt.id, { status: attempt.status, tweet_id: attempt.tweet_id || null,
        scheduled_at: attempt.scheduled_at, published_at: attempt.published_at || null, delay_seconds: attempt.delay_seconds ?? null,
        fallback_reason: attempt.fallback_reason || null, abort_reason: attempt.abort_reason || null, resolution: attempt.resolution || null });
      mediaNote = ownNote(mediaNote, attempt.id, { media_id: attempt.media_id || null, media_key: attempt.media_key || null, fallback_reason: attempt.fallback_reason || null });
    }
    update('post', contentId, { '備考': postNote, ...(!historyOnly ? {
      '投稿ステータス': status === 'cancelled' ? 'blocked' : status, ...(url ? { '投稿URL': url, XPostID: p.tweet_id, PlatformPostID: p.tweet_id } : {}),
      ...(p.published_at ? { PublishedAt: p.published_at } : {}), AnalyticsState: verified ? 'verified' : 'pending' } : {}) });
    if (!historyOnly) update('queue', queueId, { Status: status, ...(url ? { PostURL: url } : {}), LastError: blocked ? state.halt?.reason || p.status : '',
      UpdatedAt: state.halt?.at || p.received_at || p.started_at });
    update('media', mediaId, { '備考': mediaNote, ...(!historyOnly ? {
      AttachState: verified && p.media_key ? 'attached' : p.fallback_reason ? 'not_attached_fallback' : 'prepared_not_attached',
      ...(verified && p.media_key ? { '使用状況': '使用済み（X API全文・画像確認済み）' } : {}) } : {}) });
  }
  for (const o of state.observations) {
    const p = state.posts[o.post_id]; check(p && p.tweet_id === o.tweet_id, 'observation_receipt_mismatch');
    const contentId = refId(p, 'post'), newsId = refId(p, 'news');
    const window = ({ 0: 'immediate', 24: '24h', 72: '72h', 168: '7d' })[o.hours]; check(window, 'invalid_observation_window');
    const suffix = sha(`${contentId}:${o.tweet_id}:${window}`).slice(0, 24), kpiId = `KPI-NEWS-${suffix}`, learningId = `L-NEWS-${suffix}`;
    const pm = o.public_metrics, impressions = metric(pm, 'impression_count');
    const evidence = { tweet_id: o.tweet_id, due_at: o.scheduled_observation_at, observed_at: o.observed_at, public_metrics: pm, interpretation: null };
    update('kpi', kpiId, { KPIEventID: kpiId, NewsID: newsId, RunID: row(snapshot, 'kpi', kpiId, false).get('RunID') || run_id, ObservedAt: o.observed_at, ContentID: contentId,
      PostURL: `https://x.com/KinoshitaTsks/status/${o.tweet_id}`, PublishedAt: o.published_at, Source: 'X API v2 public_metrics', EvidenceID: `${p.id}:${window}`,
      Impressions: impressions, Likes: metric(pm, 'like_count'), Replies: metric(pm, 'reply_count'), Reposts: metric(pm, 'retweet_count'), Bookmarks: metric(pm, 'bookmark_count'),
      ObservationWindow: window, Platform: 'X', PrimaryMetricName: 'Impressions', PrimaryMetricValue: impressions }, true);
    // Evidence for analysis, not an invented hypothesis or an applied optimization.
    update('learning', learningId, { LearningID: learningId, EvidenceWindow: `${window}|${o.observed_at}`, ObservedChange: JSON.stringify(evidence),
      ...(row(snapshot, 'learning', learningId, false).r ? {} : { ApplyStatus: 'proposed' }), LearningType: 'observation_only', Segment: `X|${contentId}`, SampleSize: 1, Metric: 'Impressions' }, true);
  }
  const plan = { schema: 1, sheet_id: SHEET, mode: 'read_only_projection', changes };
  return { ...plan, plan_sha256: sha(JSON.stringify(plan)) };
}
/** Offline apply/verification helper. Does not call Google; validates ALL preconditions first. */
export function applyPlanToSnapshot(snapshot, plan) {
  const { plan_sha256, ...unsigned } = plan;
  check(plan.mode === 'read_only_projection' && plan.sheet_id === SHEET && sha(JSON.stringify(unsigned)) === plan_sha256, 'invalid_projection');
  for (const change of plan.changes) {
    check(TABS[change.kind] === change.sheet && change.kind !== 'news', 'forbidden_sheet_write');
    const { t, r } = row(snapshot, change.kind, change.id, false);
    check(sha(JSON.stringify(t.headers)) === change.headers_sha256, 'sheet_headers_changed');
    check(Boolean(r) === change.expect_exists, 'sheet_record_changed');
    for (const c of change.cells) check(t.headers[c.column - 1] === c.header && cell(t, r, c.header) === c.expected, 'sheet_cell_changed');
  }
  const copy = structuredClone(snapshot);
  for (const change of plan.changes) {
    const { t, r } = row(copy, change.kind, change.id, false);
    const target = r || { row_number: Math.max(1, ...t.rows.map(x => x.row_number)) + 1, values: Array(t.headers.length).fill('') };
    if (!r) t.rows.push(target);
    for (const c of change.cells) target.values[c.column - 1] = c.value;
  }
  return copy;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, snapshotFile, inputFile, outputFile] = process.argv.slice(2);
  check(['prepare', 'project'].includes(mode) && outputFile, 'usage_prepare_or_project_snapshot_input_output');
  const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8')), input = JSON.parse(readFileSync(inputFile, 'utf8'));
  const output = mode === 'prepare' ? preparePackage(snapshot, input) : receiptPlan(snapshot, input.state, { run_id: input.run_id });
  writeFileSync(outputFile, JSON.stringify(output, null, 2) + '\n');
}
