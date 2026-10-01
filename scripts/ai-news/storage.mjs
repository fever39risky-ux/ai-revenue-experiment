import { readFileSync, writeFileSync, renameSync, openSync, fsyncSync, closeSync, realpathSync, readdirSync, existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
export const json = file => JSON.parse(readFileSync(file, 'utf8'));
export function safeFile(root, relative) {
  const base = realpathSync(root), target = realpathSync(resolve(root, relative));
  if (!target.startsWith(base + sep)) throw new Error('file_outside_input_root');
  return target;
}
export function inventory(root) {
  // Only actual writer inputs/receipts: archives/draft copy and nested note_tweet text aren't queues.
  const out = [];
  const visit = (obj, pending = false) => {
    if (!obj || typeof obj !== 'object') return;
    if (typeof obj.text === 'string') {
      out.push({ text: obj.note_tweet?.text || obj.text, posted_at: obj.posted_at || obj.created_at,
        not_before: obj.not_before, topic_key: obj.topic_key,
        unresolved: pending && !obj.not_before });
      return;
    }
    for (const v of Object.values(obj)) if (v && typeof v === 'object') visit(v, pending);
  };
  const read = (relative, pending = false) => {
    if (!existsSync(resolve(root, relative))) return;
    const raw = readFileSync(safeFile(root, relative), 'utf8');
    if (relative.endsWith('.jsonl')) raw.split('\n').filter(Boolean).forEach(l => visit(JSON.parse(l), pending));
    else visit(JSON.parse(raw), pending);
  };
  for (const f of ['social/x_experiment_history.json', 'status/x_own_posts_raw.json', 'status/x_voice_test_post_draft.json']) read(f);
  for (const f of ['social/x_experiment_next_post.json', 'social/x_experiment_next_toplevel.json']) read(f, true);
  for (const e of readdirSync(resolve(root, 'social'), { withFileTypes: true })) {
    if (!/^\d{4}-\d{2}$/.test(e.name)) continue;
    const dir = `social/${e.name}`;
    read(`${dir}/posted.jsonl`);
    if (existsSync(resolve(root, `${dir}/queue`))) for (const f of readdirSync(safeFile(root, `${dir}/queue`))) if (f.endsWith('.json')) read(`${dir}/queue/${f}`, true);
  }
  return out;
}
export function gitStore(dir, git = (args, options) => execFileSync('git', args, options)) {
  const options = { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'] };
  const call = args => { try { return String(git(args, options)).trim(); } catch { throw new Error('durable_git_failure'); } };
  if (call(['branch', '--show-current']) !== 'ai-news-state') throw new Error('wrong_state_branch');
  if (call(['status', '--porcelain'])) throw new Error('dirty_state_checkout');
  if (!existsSync(resolve(dir, 'state.json'))) throw new Error('state_bootstrap_required');
  return async state => {
    const path = resolve(dir, 'state.json'), tmp = `${path}.tmp`;
    writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', { mode: 0o600 });
    const fd = openSync(tmp, 'r'); fsyncSync(fd); closeSync(fd); renameSync(tmp, path);
    call(['add', '--', 'state.json']);
    if (!call(['diff', '--cached', '--name-only'])) return;
    call(['-c', 'user.name=ai-news-bot', '-c', 'user.email=actions@users.noreply.github.com', 'commit', '-m', 'chore(ai-news): durable checkpoint']);
    // No force/rebase/retry: an uncertain or rejected push MUST stop before the next API call.
    call(['push', 'origin', 'HEAD:refs/heads/ai-news-state']);
  };
}
