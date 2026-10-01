import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { SHEET, validateState, sha } from './core.mjs';
// Logical record IDs, never assumed cell addresses/column names. Parent maps to existing schema.
export function exportRecords(state) {
  validateState(state);
  const records = [];
  for (const p of Object.values(state.posts)) {
    const fields = { news_id: p.id, status: p.status, tweet_id: p.tweet_id ?? null, scheduled_at: p.scheduled_at, published_at: p.published_at ?? null, received_at: p.received_at ?? null, delay_seconds: p.delay_seconds ?? null, fallback_reason: p.fallback_reason ?? null, approval_sha256: p.approval_sha256 };
    for (const kind of ['post', 'queue']) records.push({ key: `${p.id}:${kind}`, kind, record_ref: p.source_refs[kind], fields });
    records.push({ key: `${p.id}:media`, kind: 'media', record_ref: p.source_refs.media, fields: { media_id: p.media_id ?? null, media_key: p.media_key ?? null, sha256: p.image?.sha256 ?? null, fallback_reason: p.fallback_reason } });
  }
  for (const o of state.observations) for (const kind of ['kpi', 'learning']) records.push({ key: `${o.post_id}:${kind}:${o.hours}:${sha(o.observed_at).slice(0, 12)}`, kind, record_ref: o.source_refs[kind], fields: { ...o, interpretation: null } });
  return { schema: 1, sheet_id: SHEET, mode: 'parent_review_upsert_proposal', halt: state.halt, records };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('usage: export.mjs state.json output.json');
  writeFileSync(output, JSON.stringify(exportRecords(JSON.parse(readFileSync(input, 'utf8'))), null, 2) + '\n');
}
