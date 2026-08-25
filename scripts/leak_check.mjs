#!/usr/bin/env node
/**
 * Secret / PII leak checker for the AI Revenue Experiment.
 * Pure Node. Gate before any public publish (Pages / SNS).
 *
 * Usage:
 *   node scripts/leak_check.mjs                 # scan all git-tracked text files
 *   node scripts/leak_check.mjs file1 file2 ... # scan specific files/paths
 *
 * Exit code 1 if any FAIL-level finding (a real secret) is present.
 * WARN-level findings (owner email in a public page, ambiguous bearer) are
 * printed but do not fail, so the pipeline can decide.
 *
 * Deliberately does NOT flag public Stripe object identifiers that are meant
 * to be public: acct_*, prod_*, price_*, plink_*, and buy.stripe.com links.
 */
import { readFileSync, statSync } from 'fs';
import { execSync } from 'child_process';

const BINARY = /\.(png|jpe?g|gif|webp|zip|pdf|ico|woff2?|ttf|mp4|mov)$/i;

// FAIL: high-confidence live secrets. These prefixes never appear in public IDs.
const FAIL = [
  ['Stripe secret key',      /\bsk_(live|test)_[A-Za-z0-9]{16,}\b/],
  ['Stripe restricted key',  /\brk_(live|test)_[A-Za-z0-9]{16,}\b/],
  ['Stripe webhook secret',  /\bwhsec_[A-Za-z0-9]{16,}\b/],
  ['GitHub token',           /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['GitHub fine-grained PAT',/\bgithub_pat_[A-Za-z0-9_]{40,}\b/],
  ['Slack token',            /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['AWS access key id',      /\bAKIA[0-9A-Z]{16}\b/],
  ['Google API key',         /\bAIza[0-9A-Za-z_\-]{35}\b/],
  ['Private key block',      /-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/],
  ['Labeled secret value',   /\b(client_secret|refresh_token|access_token|api[_-]?secret|shared_secret|app_password)\b["'\s:=]+["']?[A-Za-z0-9\-\._~\/+]{16,}/i],
];

// WARN: worth a human/pipeline glance, not an automatic block.
const WARN = [
  ['Owner private email in file', /fever39risky@gmail\.com/i],
  ['Bearer token (verify)',       /\bBearer\s+[A-Za-z0-9\-\._~\+\/]{24,}=*/],
  ['Possible bank/IBAN',          /\bIBAN[:\s]*[A-Z]{2}\d{2}[A-Z0-9]{10,}\b/i],
];

function targets() {
  const args = process.argv.slice(2);
  let files;
  if (args.length) files = args;
  else files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);
  return files.filter(f => { try { return statSync(f).isFile() && !BINARY.test(f); } catch { return false; } });
}

let fails = 0, warns = 0;
for (const f of targets()) {
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  const lines = text.split('\n');
  for (const [name, re] of FAIL) {
    lines.forEach((ln, i) => { if (re.test(ln)) { fails++; console.log(`FAIL  ${f}:${i+1}  ${name}`); } });
  }
  for (const [name, re] of WARN) {
    lines.forEach((ln, i) => { if (re.test(ln)) { warns++; console.log(`WARN  ${f}:${i+1}  ${name}`); } });
  }
}

console.log(`\nleak_check: ${fails} fail, ${warns} warn across scanned files.`);
if (fails > 0) { console.error('BLOCK: potential secret(s) found — do not publish.'); process.exit(1); }
process.exit(0);
