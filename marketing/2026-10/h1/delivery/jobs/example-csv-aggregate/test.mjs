#!/usr/bin/env node
/**
 * End-to-end test on dummy data. Exits non-zero on any mismatch.
 * This is the acceptance gate for the worked example and the template for every node-testable H1 job.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { aggregate, toCsv } from './transform.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const input = readFileSync(resolve(__dir, 'dummy_input.csv'), 'utf8');
const expected = readFileSync(resolve(__dir, 'expected_output.csv'), 'utf8');

const got = toCsv(aggregate(input));

let failed = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failed++;
}

// Full-output equality (the primary gate)
check('output matches expected_output.csv', got === expected);

// Targeted assertions on the cleanup rules, so a failure points at the cause
const rows = aggregate(input);
const find = (m, c) => rows.find(r => r.month === m && r.category === c);
check('¥6,800 parsed as 6800 (currency + thousands separator)', find('2026-09', '消耗品').sum === 11680);
check('mixed date formats bucketed into 2026-09 (2026/09/03, 2026-9-15)', find('2026-09', 'その他').count === 1);
check('備品 2026-09 summed across 3 rows = 150400', (r => r.sum === 150400 && r.count === 3)(find('2026-09', '備品')));
check('blank 品目 row excluded (2026-10 消耗品 count = 1, sum 650)', (r => r.sum === 650 && r.count === 1)(find('2026-10', '消耗品')));
check('category whitespace trimmed (" 消耗品 " merged, no stray category)', !rows.some(r => r.category !== r.category.trim()));
check('rows sorted by 月 then カテゴリ', JSON.stringify(rows.map(r => r.month + '/' + r.category)) ===
  JSON.stringify(['2026-09/その他','2026-09/備品','2026-09/消耗品','2026-10/備品','2026-10/消耗品']));

if (failed) { console.error(`\n${failed} check(s) failed`); process.exit(1); }
console.log('\nAll checks passed. Output:\n' + got);
