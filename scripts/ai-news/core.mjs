import { createHash } from 'node:crypto';

export const SHEET = '1BSd9jv6B81Jxjndech9UgMyINA3peGFddLy8xTNs94w';
export const sha = x => createHash('sha256').update(x).digest('hex');
export const jst = ms => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const month = ms => jst(ms).slice(0, 7);
const iso = ms => new Date(ms).toISOString();
const check = (ok, reason) => { if (!ok) throw new Error(reason); };
export const approvalHash = p => sha(JSON.stringify([p.id, p.topic_key, p.scheduled_at, p.text, p.source_urls, p.source_refs, p.image, p.text_fallback]));
export function validatePackage(p) {
  check(p?.schema === 1 && /^[a-z0-9][a-z0-9_-]{2,100}$/.test(p.id), 'invalid_package');
  check(p.account === 'KinoshitaTsks' && p.sheet_id === SHEET, 'wrong_canonical_source');
  check(typeof p.topic_key === 'string' && p.topic_key.length > 2, 'missing_topic');
  check(typeof p.text === 'string' && [...p.text].length <= 25000, 'invalid_text');
  const body = p.text.replace(/https?:\/\/\S+/g, '').trim();
  check([...body].length >= 575 && [...body].length <= 600, 'body_must_be_575_to_600_codepoints');
  check(Array.isArray(p.source_urls) && p.source_urls.length > 0 && p.source_urls.every(u => /^https:\/\//.test(u) && p.text.includes(u)), 'missing_source_url');
  check(p.source_refs && ['post', 'queue', 'media', 'kpi', 'learning'].every(k => typeof p.source_refs[k] === 'string' && p.source_refs[k]), 'missing_sheet_record_refs');
  check(/^\d{4}-\d{2}-\d{2}T(08|12|20):00:00\+09:00$/.test(p.scheduled_at) && Number.isFinite(Date.parse(p.scheduled_at)), 'invalid_jst_slot');
  check(p.approval?.sha256 === approvalHash(p) && p.approval.by && Number.isFinite(Date.parse(p.approval.at)), 'approval_digest_mismatch');
  check(typeof p.text_fallback?.allowed === 'boolean', 'missing_fallback_decision');
  if (p.image) check(/^media\/[a-zA-Z0-9_-]+\.(png|jpg|jpeg)$/.test(p.image.path) && /^[a-f0-9]{64}$/.test(p.image.sha256) && ['image/png', 'image/jpeg'].includes(p.image.mime), 'invalid_image');
  else check(p.text_fallback.allowed && ['technical', 'approval'].includes(p.text_fallback.reason), 'image_required');
  return p;
}
export function initialState() {
  return { schema: 1, account: 'KinoshitaTsks', initialized: true, posts: {}, operations: [], observations: [],
    blocked_topics: ['gpt6.1', 'gemini4'], external_posts: [
      { lane: 'news', tweet_id: '2105481450862641444', topic_key: 'gpt6.1', published_at: '2026-10-01T11:14:30+09:00' },
      { lane: 'news', tweet_id: '2105506748412940411', topic_key: 'gemini4', published_at: '2026-10-01T12:55:01+09:00' }
    ], halt: null };
}
export function validateState(s) {
  check(s?.initialized === true && s.schema === 1 && s.account === 'KinoshitaTsks' && s.posts && Array.isArray(s.operations) && Array.isArray(s.observations), 'missing_or_invalid_durable_state');
  check(['gpt6.1', 'gemini4'].every(t => s.blocked_topics?.includes(t)), 'missing_repost_blocklist');
  check(Array.isArray(s.external_posts) && new Set(s.operations.map(o => o.id)).size === s.operations.length && s.operations.every(o => typeof o.id === 'string' && /^\d{4}-\d{2}$/.test(o.month) && Number.isSafeInteger(o.minor_jpy) && o.minor_jpy >= 0 && ['reserved', 'attempted_unreconciled'].includes(o.status)), 'invalid_cost_ledger');
  return s;
}
export function validateConfig(c, now) {
  check(c.account === 'KinoshitaTsks' && c.enabled === true, 'news_disabled');
  check(c.capabilities?.longform === true && c.capabilities?.oauth1_write === true && c.capabilities?.account_id && c.capabilities?.evidence, 'account_eligibility_unconfirmed');
  check(Date.parse(c.valid_until) > now && Date.parse(c.reviewed_at) <= now, 'configuration_expired');
  check(Number.isFinite(c.jpy_per_usd_ceiling) && c.jpy_per_usd_ceiling > 0 && Number.isFinite(c.tax_rate) && c.tax_rate >= 0 && Number.isFinite(c.margin_rate) && c.margin_rate >= 0.1, 'unknown_fx_tax_margin');
  check(Number.isFinite(c.prices?.create_usd) && c.prices.create_usd >= 0.2 && Number.isFinite(c.prices?.read_usd) && c.prices.read_usd >= 0.005 && c.pricing_evidence, 'unknown_price');
  check(c.account_inventory?.complete === true && Date.parse(c.account_inventory.valid_until) > now && c.account_inventory.evidence && c.account_inventory.uncoordinated_writers === false, 'account_inventory_unconfirmed');
  check(c.billing?.news_only === true && Date.parse(c.billing.valid_until) > now && c.billing.evidence, 'billing_attribution_unconfirmed');
}
function amount(c, kind) {
  const price = c.prices[`${kind}_usd`];
  check(Number.isFinite(price) && price >= 0, `unknown_${kind}_price`);
  return Math.ceil(price * c.jpy_per_usd_ceiling * (1 + c.tax_rate) * (1 + c.margin_rate) * 100);
}
export function budget(s, c, m) {
  const b = c.billing?.months?.[m];
  check(b && Number.isInteger(b.actual_minor_jpy) && b.actual_minor_jpy >= 0 && Number.isSafeInteger(b.non_api_reserve_minor_jpy) && b.non_api_reserve_minor_jpy >= 0 && Array.isArray(b.reconciled_operation_ids), `billing_month_unconfirmed:${m}`);
  check(b.reconciled_operation_ids.every(id => s.operations.some(o => o.id === id && o.month === m && o.status === 'attempted_unreconciled')), 'invalid_billing_reconciliation');
  const reconciled = new Set(b.reconciled_operation_ids);
  const pending = s.operations.filter(o => o.month === m && !reconciled.has(o.id));
  // Provider-confirmed actual + ALL unreconciled reservations, including failed/unknown requests.
  return { month: m, actual_minor_jpy: b.actual_minor_jpy, non_api_reserve_minor_jpy: b.non_api_reserve_minor_jpy, reserved_minor_jpy: b.non_api_reserve_minor_jpy + pending.reduce((n, o) => n + o.minor_jpy, 0), cap_minor_jpy: 300000 };
}
function reserve(s, c, specs) {
  const changes = specs.map(x => {
    const previous = s.operations.find(o => o.id === x.id);
    const minor_jpy = Math.max(previous?.minor_jpy || 0, amount(c, x.kind));
    return { ...x, minor_jpy, status: previous?.status || 'reserved', delta: minor_jpy - (previous?.minor_jpy || 0) };
  });
  for (const m of new Set(changes.map(o => o.month))) {
    const b = budget(s, c, m);
    check(b.actual_minor_jpy + b.reserved_minor_jpy + changes.filter(o => o.month === m).reduce((n, o) => n + o.delta, 0) <= b.cap_minor_jpy, `budget_limit:${m}`);
  }
  for (const { delta, ...op } of changes) {
    const previous = s.operations.find(o => o.id === op.id);
    if (previous) previous.minor_jpy = op.minor_jpy;
    else s.operations.push(op);
  }
}
export function report(s, c, queue, now) {
  const months = [...new Set([month(now), ...s.operations.map(o => o.month)])];
  return { at: iso(now), halt: s.halt, budgets: months.map(m => { try { return budget(s, c, m); } catch { return { month: m, actual_minor_jpy: null, reason: 'unconfirmed' }; } }),
    pending: queue.filter(p => !s.posts[p.id]?.tweet_id).map(p => ({ id: p.id, scheduled_at: p.scheduled_at, status: s.posts[p.id]?.status || 'queued' })),
    pending_observations: Object.values(s.posts).flatMap(p => (p.observation_jobs || []).filter(j => !j.done).map(j => ({ post_id: p.id, ...j }))) };
}
function fullText(t) {
  let text = t.note_tweet?.text ?? t.text;
  // X replaces source URLs with t.co. Expand only documented entity URL mappings.
  for (const u of (t.note_tweet?.entities?.urls ?? t.entities?.urls ?? [])) if (u.url && u.expanded_url) text = text?.split(u.url).join(u.expanded_url);
  return text;
}
export function verify(j, p, c) {
  const t = j.data;
  check(t?.id === p.tweet_id && t.author_id === c.capabilities.account_id && Number.isFinite(Date.parse(t.created_at)) && !t.referenced_tweets?.length, 'wrong_post_identity');
  check(t.note_tweet?.text && fullText(t) === p.text, 'full_text_mismatch');
  const keys = t.attachments?.media_keys || [];
  if (p.media_key) check(keys.length === 1 && keys[0] === p.media_key && j.includes?.media?.some(m => m.media_key === p.media_key && m.type === 'photo'), 'media_mismatch');
  else check(keys.length === 0, 'unexpected_media');
  return t;
}
function collision(p, s, inventory, now) {
  const others = [...s.external_posts, ...inventory, ...Object.values(s.posts).filter(x => x.id !== p.id)];
  check(!s.blocked_topics.includes(p.topic_key.toLowerCase()), 'already_published_topic');
  check(!others.some(x => x.topic_key?.toLowerCase() === p.topic_key.toLowerCase() || (x.text && sha(x.text) === sha(p.text))), 'duplicate_account_content');
  check(!others.some(x => {
    const time = Date.parse(x.published_at || x.posted_at || x.not_before || x.scheduled_at);
    return Number.isFinite(time) && Math.min(Math.abs(time - now), Math.abs(time - Date.parse(p.scheduled_at))) < 30 * 60000;
  }), 'account_schedule_conflict');
  check(!inventory.some(x => x.unresolved === true), 'account_writer_unresolved');
}

/** Persist must resolve only AFTER the remote durable commit is acknowledged.
 * A failed persist rejects out of the runner; no later paid operation may run. */
export async function run({ state: s, config: c, queue, inventory = [], api, persist, loadImage, now = () => Date.now() }) {
  validateState(s);
  const stop = async reason => { s.halt = { reason, at: iso(now()) }; await persist(s); return report(s, c, queue, now()); };
  if (s.halt) return report(s, c, queue, now());
  try { validateConfig(c, now()); queue.forEach(validatePackage); check(new Set(queue.map(p => p.id)).size === queue.length, 'duplicate_queue_id'); }
  catch (e) { return stop(e.message); }
  // Intent survives worker cancellation / missing response / failed receipt push. Never retry writes.
  if (Object.values(s.posts).some(p => !['posted_unverified', 'verified'].includes(p.status))) return stop('unresolved_write_intent');
  for (const p of Object.values(s.posts)) {
    const q = queue.find(q => q.id === p.id);
    if (q && q.approval.sha256 !== p.approval_sha256) return stop('immutable_package_changed');
  }
  async function read(p, job) {
    const attempt = (job.attempts || 0) + 1;
    if (attempt > 3) return 'read_retry_limit';
    const opId = `${p.id}:read:${job.hours}:${attempt}:${month(now())}`;
    // Initial observation reservation is usable only in its booked month; late runs reserve again.
    const baseId = `${p.id}:read:${job.hours}:1:${month(now())}`;
    try { reserve(s, c, [{ id: attempt === 1 ? baseId : opId, kind: 'read', month: month(now()) }]); }
    catch (e) { return e.message; }
    const op = s.operations.find(o => o.id === opId);
    try { validateConfig(c, now()); const b = budget(s, c, month(now())); check(b.actual_minor_jpy + b.reserved_minor_jpy <= b.cap_minor_jpy, 'budget_changed'); } catch (e) { return e.message; }
    job.attempts = attempt; op.status = 'attempted_unreconciled'; op.attempted_at = iso(now());
    await persist(s);
    let result;
    try { check(op.month === month(now()), 'month_changed'); result = await api.get(p.tweet_id); }
    catch { job.last_error = 'read_failed'; job.next_attempt_at = iso(now() + 3600000); await persist(s); return attempt === 3 ? 'read_retry_limit' : null; }
    let t;
    try { t = verify(result, p, c); }
    catch (e) { return e.message; }
    p.published_at = t.created_at;
    p.delay_seconds = (Date.parse(t.created_at) - Date.parse(p.scheduled_at)) / 1000;
    p.status = 'verified';
    for (const later of p.observation_jobs) if (later.hours > 0 && !later.done) later.due_at = iso(Date.parse(t.created_at) + later.hours * 3600000);
    job.done = true; job.observed_at = iso(now());
    s.observations.push({ post_id: p.id, tweet_id: p.tweet_id, hours: job.hours, scheduled_observation_at: job.due_at, observed_at: job.observed_at, published_at: t.created_at, public_metrics: t.public_metrics ?? null, source_refs: p.source_refs });
    await persist(s);
    return null;
  }
  // Metrics precede new posts; retries are bounded, separately reserved, and never recreate posts.
  for (const p of Object.values(s.posts)) for (const job of p.observation_jobs || []) {
    if (p.tweet_id && !job.done && Date.parse(job.due_at) <= now() && (!job.next_attempt_at || Date.parse(job.next_attempt_at) <= now())) {
      const error = await read(p, job); if (error) return stop(error);
    }
  }
  const candidates = queue.filter(p => !s.posts[p.id] && Date.parse(p.scheduled_at) <= now()).sort((a, b) => Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at));
  for (const q of candidates) {
    if (now() - Date.parse(q.scheduled_at) > 15 * 60000) return stop(`missed_slot:${q.id}`);
    try {
      collision(q, s, inventory, now());
      check(!Object.values(s.posts).some(p => p.scheduled_at === q.scheduled_at), 'slot_already_consumed');
      check([...Object.values(s.posts), ...s.external_posts.filter(p => p.lane === 'news')].filter(p => jst(Date.parse(p.published_at || p.started_at)) === jst(now())).length < 3, 'news_daily_cap');
    } catch (e) { return stop(e.message); }
    let image = null, fallback = q.image ? null : q.text_fallback.reason;
    if (q.image) {
      try { image = await loadImage(q.image); check(sha(image) === q.image.sha256 && image.length <= 5 * 1024 * 1024, 'image_integrity'); }
      catch { image = null; if (q.text_fallback.allowed) fallback = 'technical'; else return stop('image_unavailable'); }
      if (image && c.capabilities.media_upload !== true) { if (q.text_fallback.allowed) { image = null; fallback = 'approval'; } else return stop('media_permission_unconfirmed'); }
    }
    const jobs = [0, 24, 72, 168].map(hours => ({ hours, due_at: iso(now() + hours * 3600000), done: false }));
    try { reserve(s, c, [
      { id: `${q.id}:create`, kind: 'create', month: month(now()) },
      ...(image ? [{ id: `${q.id}:upload`, kind: 'upload', month: month(now()) }] : []),
      ...jobs.map(j => ({ id: `${q.id}:read:${j.hours}:1:${month(Date.parse(j.due_at))}`, kind: 'read', month: month(Date.parse(j.due_at)) }))
    ]); } catch (e) { return stop(e.message); }
    const p = s.posts[q.id] = { ...q, approval_sha256: q.approval.sha256, started_at: iso(now()), status: 'reserved', observation_jobs: jobs, fallback_reason: fallback };
    await persist(s);
    if (image) {
      p.status = 'upload_intent'; s.operations.find(o => o.id === `${q.id}:upload`).status = 'attempted_unreconciled'; await persist(s);
      let media;
      try { validateConfig(c, now()); check(s.operations.find(o => o.id === `${q.id}:upload`).month === month(now()), 'month_changed'); media = await api.upload(image, q.image.mime); }
      catch (e) {
        // A definitive rejected image request may fall back; timeout/5xx stays unknown.
        if (e.definitive && q.text_fallback.allowed) { p.fallback_reason = 'technical'; p.status = 'reserved'; await persist(s); }
        else return stop('upload_result_unknown_or_rejected');
      }
      if (!media && !p.fallback_reason) return stop('invalid_media_response');
      if (media) {
        if (!/^\d+$/.test(media.id || '') || !media.media_key || (media.processing_info && media.processing_info.state !== 'succeeded')) return stop('media_not_ready');
        p.media_id = media.id; p.media_key = media.media_key; p.status = 'media_ready'; await persist(s);
      }
    }
    // Recheck time and account conflict after upload; don't publish into another writer's window.
    try { check(now() - Date.parse(q.scheduled_at) <= 15 * 60000, 'missed_slot_after_upload'); collision(q, s, inventory, now()); }
    catch (e) { return stop(e.message); }
    p.status = 'post_intent'; s.operations.find(o => o.id === `${q.id}:create`).status = 'attempted_unreconciled'; await persist(s);
    let id;
    try { validateConfig(c, now()); check(s.operations.find(o => o.id === `${q.id}:create`).month === month(now()), 'month_changed'); id = await api.create({ text: q.text, ...(p.media_id ? { media: { media_ids: [p.media_id] } } : {}) }); }
    catch { return stop('post_result_unknown_or_rejected'); }
    if (!/^\d+$/.test(id || '')) return stop('post_result_unknown');
    // FIRST operation after successful POST: durably store id, before ANY GET.
    p.tweet_id = id; p.received_at = iso(now()); p.status = 'posted_unverified';
    await persist(s);
    const error = await read(p, jobs[0]); if (error) return stop(error);
    break; // At most one new post per wake-up, never burst catch-up.
  }
  return report(s, c, queue, now());
}
