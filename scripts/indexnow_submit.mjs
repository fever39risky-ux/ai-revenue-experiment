// Submit every sitemap URL to IndexNow (Bing, Yandex, Seznam, Naver...).
// Public, keyless-account protocol: the key file at the site root proves ownership.
// Usage: node scripts/indexnow_submit.mjs   (after the key file is live on GitHub Pages)
import fs from 'node:fs';

const HOST = 'fever39risky-ux.github.io';
const BASE = `https://${HOST}/ai-revenue-experiment/`;
const keyFile = fs.readdirSync('.').find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('IndexNow key file not found at repo root');
const key = fs.readFileSync(keyFile, 'utf8').trim();
const urlList = [...fs.readFileSync('sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key, keyLocation: BASE + keyFile, urlList }),
});
console.log(`indexnow: submitted ${urlList.length} urls -> HTTP ${res.status}`);
if (res.status >= 400) process.exit(1);
