import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
mkdirSync(__dirname, { recursive: true });

const css = `
  *{box-sizing:border-box;margin:0;padding:0}
  .tile{width:2000px;height:2000px;position:relative;overflow:hidden;
    font-family:-apple-system,"Segoe UI",system-ui,sans-serif;color:#eaf1f7;
    background:radial-gradient(1600px 900px at 72% -8%,rgba(62,166,160,.28),transparent),
               linear-gradient(160deg,#0f1720,#0b1118)}
  .pad{padding:150px 160px}
  .eyebrow{display:inline-block;font-size:40px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;
    color:#5fd0c9;border:2px solid #2a3a49;border-radius:999px;padding:20px 40px;margin-bottom:60px}
  h1{font-size:150px;line-height:1.04;font-weight:800;letter-spacing:-.02em}
  h1 .g{background:linear-gradient(90deg,#3ea6a0,#5b8def);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .lead{font-size:56px;line-height:1.4;color:#b8c6d2;margin-top:56px;max-width:1500px}
  .price{position:absolute;bottom:150px;left:160px;font-size:64px;font-weight:800}
  .price s{color:#7d8b98;font-weight:500;margin-left:20px}
  .badge{position:absolute;bottom:158px;right:160px;font-size:46px;font-weight:700;color:#0f1720;
    background:linear-gradient(90deg,#3ea6a0,#5b8def);padding:28px 52px;border-radius:20px}
  h2{font-size:110px;font-weight:800;margin-bottom:80px;letter-spacing:-.02em}
  ul{list-style:none;display:flex;flex-direction:column;gap:44px}
  li{display:flex;gap:40px;align-items:flex-start;font-size:58px;line-height:1.32}
  .n{flex:0 0 96px;height:96px;border-radius:24px;background:linear-gradient(90deg,#3ea6a0,#5b8def);
    color:#0f1720;font-weight:800;display:flex;align-items:center;justify-content:center;font-size:52px}
  .k{color:#eaf1f7;font-weight:800}
  .sub{color:#9fb2c0}
  .prompt{background:#161f2a;border:2px solid #243140;border-radius:28px;padding:52px 60px;font-size:50px;
    line-height:1.4;color:#d7e2ec}
  .grid{display:flex;flex-direction:column;gap:44px}
  .foot{position:absolute;bottom:140px;left:160px;font-size:44px;color:#7d8b98}
`;

const tiles = {
  '01-cover': `
    <div class="tile"><div class="pad">
      <span class="eyebrow">AI Automation · No Code · Instant Download</span>
      <h1>The No-Code<br><span class="g">AI Automation Toolkit</span></h1>
      <p class="lead">10 copy-paste AI workflows + ready-to-run scripts to cut 20+ hours/month of repetitive work. Built for solopreneurs & small teams.</p>
      <div class="price">$9 <s>$19</s></div>
      <div class="badge">Instant Download</div>
    </div></div>`,
  '02-inside': `
    <div class="tile"><div class="pad">
      <h2>What's inside</h2>
      <ul>
        <li><span class="n">1</span><div><span class="k">10 AI workflows</span> <span class="sub">— email, meeting notes → tasks, spreadsheet cleanup, invoices & more</span></div></li>
        <li><span class="n">2</span><div><span class="k">2 ready-to-run Google Apps Script tools</span> <span class="sub">— bulk-process a sheet with AI; daily summary email</span></div></li>
        <li><span class="n">3</span><div><span class="k">20 business prompts</span> <span class="sub">(CSV) — import into Sheets or Notion</span></div></li>
        <li><span class="n">4</span><div><span class="k">Invoice template + safety checklist</span> <span class="sub">+ free updates</span></div></li>
      </ul>
    </div></div>`,
  '03-prompts': `
    <div class="tile"><div class="pad">
      <h2>20 business prompts</h2>
      <div class="grid">
        <div class="prompt">“Turn this messy meeting transcript into clear minutes + an action list with owners and due dates.”</div>
        <div class="prompt">“Rewrite this customer email to be warm, concise, and on-brand. Give me 3 versions.”</div>
        <div class="prompt">“Clean and standardize this spreadsheet column: fix casing, remove dupes, flag errors.”</div>
      </div>
      <div class="foot">…and 17 more, ready to copy-paste.</div>
    </div></div>`,
  '04-who': `
    <div class="tile"><div class="pad">
      <h2>Who it's for</h2>
      <ul>
        <li><span class="n">✓</span><div><span class="k">Solopreneurs & freelancers</span> <span class="sub">drowning in repetitive admin</span></div></li>
        <li><span class="n">✓</span><div><span class="k">Small teams & ops/admin</span> <span class="sub">who want AI without hiring a developer</span></div></li>
        <li><span class="n">✓</span><div><span class="k">Anyone with Google Sheets</span> <span class="sub">+ free ChatGPT or Claude — no coding needed</span></div></li>
      </ul>
      <div class="foot">Note: contents created with the help of AI. Original compiled product — not resold.</div>
    </div></div>`,
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 2000, height: 2000 }, deviceScaleFactor: 1 });
for (const [name, body] of Object.entries(tiles)) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${body}</body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle' });
  const el = await page.$('.tile');
  await el.screenshot({ path: `${__dirname}/${name}.png` });
  console.log('rendered', name);
}
await browser.close();
console.log('done');
