#!/usr/bin/env node
/**
 * H1 worked example — CSV データ整理・集計
 *
 * Buyer job type: "経費/売上のCSVがバラバラなので、月ごと・カテゴリごとに集計してほしい".
 * This is the pure-logic core we would deliver (as GAS the same logic runs via a menu item; here it is
 * node-runnable so we can prove it end-to-end on dummy data — see test.mjs).
 *
 * Cleanup handled (all present in dummy_input.csv):
 *  - mixed date formats (2026-09-01, 2026/09/03, 2026-9-15) → month key YYYY-MM
 *  - stray whitespace in fields (" 消耗品 ", " 120000")
 *  - blank lines and rows with an empty 品目 → skipped
 *  - currency noise in 金額 ("¥6,800") → integer 6800 (digits only, reconstructed if a comma split the field)
 *
 * Output: 月 × カテゴリ の 合計金額 と 件数, sorted by 月 then カテゴリ (Unicode code-point order = deterministic).
 *
 * Usage: node transform.mjs [input.csv]   (defaults to ./dummy_input.csv; prints CSV to stdout)
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));

export function aggregate(csvText) {
  const lines = csvText.split(/\r?\n/);
  const totals = new Map(); // key "month\tcategory" -> { month, category, sum, count }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    if (i === 0) continue;             // header
    if (raw.trim() === '') continue;   // blank line

    const f = raw.split(',');
    const item = (f[1] || '').trim();
    if (item === '') continue;         // no 品目 → not a real record

    const month = normalizeMonth(f[0]);
    if (!month) continue;              // unparseable date → skip (would be flagged to buyer)

    const category = (f[2] || '').trim() || '未分類';
    const amount = toInt(f.slice(3).join(',')); // rejoin in case a comma split the amount ("¥6,800")

    const key = month + '\t' + category;
    const cur = totals.get(key) || { month, category, sum: 0, count: 0 };
    cur.sum += amount;
    cur.count += 1;
    totals.set(key, cur);
  }

  return [...totals.values()].sort((a, b) =>
    a.month === b.month ? cmp(a.category, b.category) : cmp(a.month, b.month)
  );
}

function normalizeMonth(s) {
  const m = String(s || '').trim().replace(/\//g, '-').match(/^(\d{4})-(\d{1,2})-\d{1,2}$/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, '0')}`;
}

function toInt(s) {
  const digits = String(s || '').replace(/[^\d]/g, '');
  return digits === '' ? 0 : parseInt(digits, 10);
}

function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }

export function toCsv(rows) {
  const out = ['月,カテゴリ,合計金額,件数'];
  for (const r of rows) out.push(`${r.month},${r.category},${r.sum},${r.count}`);
  return out.join('\n') + '\n';
}

// CLI
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const input = process.argv[2] || resolve(__dir, 'dummy_input.csv');
  process.stdout.write(toCsv(aggregate(readFileSync(input, 'utf8'))));
}
