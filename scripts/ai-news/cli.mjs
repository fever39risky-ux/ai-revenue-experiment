import { readFileSync, writeFileSync, readdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validatePackage, validateState, validateConfig, run, report, sha } from './core.mjs';
import { json, safeFile, inventory, gitStore } from './storage.mjs';
import { xApi } from './x-api.mjs';
const [mode = 'dry-run', input = 'social/ai-news', output = '/tmp/ai-news-report.json'] = process.argv.slice(2);
let lock, fd, state, config, queue;
try {
  if (!['dry-run', 'live'].includes(mode)) throw new Error('use_dry_run_or_live');
  const root = resolve(input);
  config = json(safeFile(root, 'config.json'));
  state = validateState(json(safeFile(root, 'state.json')));
  queue = readdirSync(safeFile(root, 'queue')).filter(f => f.endsWith('.json')).map(f => validatePackage(json(safeFile(root, `queue/${f}`))));
  let result;
  if (mode === 'dry-run') {
    let blocker = null; try { validateConfig(config, Date.now()); } catch (e) { blocker = e.message; }
    result = { ...report(state, config, queue, Date.now()), mode, configuration_blocker: blocker, validated_packages: queue.length, api_calls: 0 };
  } else {
    if (process.env.AI_NEWS_LIVE !== 'approved' || process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_REF !== 'refs/heads/main') throw new Error('live_requires_approved_main_actions');
    lock = resolve(tmpdir(), `ai-news-${sha(root)}.lock`); fd = openSync(lock, 'wx');
    const persist = gitStore(root);
    result = await run({ state, config, queue, inventory: [...inventory(process.cwd()), ...(config.account_inventory?.posts || [])], api: xApi(), persist, loadImage: image => readFileSync(safeFile(root, image.path)) });
  }
  writeFileSync(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result, null, 2));
  if (result.halt) process.exitCode = 2;
} catch (e) {
  // Never print raw HTTP bodies, auth, process env, or git stderr.
  const message = /^[a-z0-9_:.-]+$/.test(e.message) ? e.message : 'runner_failed_review_required';
  const details = state && config && queue ? report(state, config, queue, Date.now()) : {};
  writeFileSync(output, JSON.stringify({ ...details, halt: { reason: message }, mode, review_required: true }, null, 2) + '\n');
  console.error(message); process.exitCode = 2;
} finally { if (fd !== undefined) { closeSync(fd); unlinkSync(lock); } }
