#!/usr/bin/env node
// render_news_card.mjs — deterministic Japanese 16:9 AI-news card renderer.
//
// Purpose: the AI-news awareness lane (ops/LOOP_PROTOCOL_ADDENDUM.md) needs a
// post-specific image for every story WITHOUT an image-generation model. This
// turns a small JSON spec of the story's REAL facts into a clean, shareable
// 1600x900 PNG via the pre-installed headless Chromium. No fabricated UI, no
// logos — just typographic facts. Layout `variant` varies composition so the
// account does not become visually repetitive.
//
// Usage: node scripts/render_news_card.mjs <spec.json> <out.png>
// Spec schema: see marketing/ai_news/_template/news_card.spec.example.json
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CHROME_CANDIDATES = [
  "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  "/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",
  process.env.CHROME_PATH,
].filter(Boolean);

function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try { readFileSync(p); return p; } catch { /* next */ }
  }
  throw new Error("No Chromium binary found. Set CHROME_PATH.");
}

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function buildHtml(spec) {
  const {
    kicker = "AIニュース",
    date = "",
    headline = "",
    central_number = "",
    central_unit = "",
    central_label = "",
    points = [],
    source = "",
    handle = "@KinoshitaTsks",
    accent = "#3ea6a0",
    accent2 = "#5b8def",
    variant = "left-number",
  } = spec;

  const fontStack = `"IPAexGothic","IPAGothic","IPAPGothic","Noto Sans CJK JP","Noto Sans JP",sans-serif`;
  const pointsHtml = points.slice(0, 3).map((p) => `<li>${esc(p)}</li>`).join("");
  const numberBlock = `
    <div class="numwrap">
      <div class="num"><span class="nnum">${esc(central_number)}</span><span class="nunit">${esc(central_unit)}</span></div>
      <div class="nlabel">${esc(central_label)}</div>
    </div>`;

  // Two composition families so the lane is not visually repetitive.
  const isCenter = variant === "center-number";

  return `<!doctype html><html lang="ja"><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1600px;height:900px}
  body{font-family:${fontStack};color:#eef4f8;
    background:
      radial-gradient(1100px 640px at ${isCenter ? "50% -12%" : "84% -8%"}, ${accent}2b, transparent),
      linear-gradient(160deg,#0d1620 0%,#0a121b 60%,#0b1017 100%);
    position:relative;overflow:hidden}
  .edge{position:absolute;inset:0;border:2px solid #1d2a37;border-radius:0}
  .accentbar{position:absolute;top:0;left:0;height:10px;width:100%;
    background:linear-gradient(90deg,${accent},${accent2})}
  .pad{position:absolute;inset:0;padding:66px 84px 46px;display:flex;flex-direction:column}
  .top{display:flex;align-items:center;gap:18px;font-size:26px;color:#a9bccb;letter-spacing:.04em}
  .kicker{font-weight:700;color:#fff;background:linear-gradient(90deg,${accent},${accent2});
    padding:8px 20px;border-radius:999px;font-size:24px}
  .date{margin-left:auto;color:#7f95a6;font-size:24px}
  .headline{margin-top:${isCenter ? "34px" : "40px"};font-weight:800;line-height:1.32;
    font-size:${headline.length > 34 ? "58px" : "68px"};letter-spacing:.01em;
    ${isCenter ? "text-align:center;" : ""}max-width:${isCenter ? "1400px" : "1440px"}}
  .headline .hl{color:${accent};}
  .body{display:flex;gap:56px;margin-top:${isCenter ? "40px" : "56px"};align-items:flex-start;
    ${isCenter ? "flex-direction:column;align-items:center;gap:30px;" : ""}}
  .numwrap{flex:0 0 auto;${isCenter ? "text-align:center;order:-1;margin-top:26px;" : ""}}
  .num{display:flex;align-items:baseline;gap:10px;line-height:1;
    ${isCenter ? "justify-content:center;" : ""}}
  .nnum{font-size:${isCenter ? "168px" : "150px"};font-weight:800;
    background:linear-gradient(90deg,${accent},${accent2});-webkit-background-clip:text;
    background-clip:text;color:transparent;letter-spacing:-.02em}
  .nunit{font-size:56px;font-weight:800;color:${accent2}}
  .nlabel{font-size:28px;color:#b9cad8;margin-top:14px;${isCenter ? "" : "max-width:420px"}}
  ul.points{list-style:none;display:flex;flex-direction:column;gap:18px;flex:1;
    ${isCenter ? "align-items:center;text-align:center;" : ""}}
  ul.points li{font-size:32px;line-height:1.5;color:#dbe7f0;padding-left:${isCenter ? "0" : "34px"};position:relative}
  ul.points li:before{content:"";position:absolute;left:0;top:16px;width:16px;height:16px;
    border-radius:4px;background:linear-gradient(135deg,${accent},${accent2});${isCenter ? "display:none" : ""}}
  .foot{margin-top:auto;display:flex;align-items:center;gap:16px;
    font-size:25px;color:#c8d6e2;border-top:1px solid #2b3d4d;padding-top:24px}
  .foot .src{color:#c8d6e2}
  .foot .handle{margin-left:auto;color:#eef4f9;font-weight:700}
  </style></head><body>
    <div class="accentbar"></div><div class="edge"></div>
    <div class="pad">
      <div class="top"><span class="kicker">${esc(kicker)}</span><span class="date">${esc(date)}</span></div>
      <div class="headline">${headline}</div>
      <div class="body">
        ${numberBlock}
        <ul class="points">${pointsHtml}</ul>
      </div>
      <div class="foot"><span class="src">出典: ${esc(source)}</span><span class="handle">${esc(handle)}</span></div>
    </div>
  </body></html>`;
}

function main() {
  const [specPath, outPath] = process.argv.slice(2);
  if (!specPath || !outPath) {
    console.error("Usage: node scripts/render_news_card.mjs <spec.json> <out.png>");
    process.exit(1);
  }
  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  const html = buildHtml(spec);
  const dir = mkdtempSync(join(tmpdir(), "newscard-"));
  const htmlPath = join(dir, "card.html");
  writeFileSync(htmlPath, html);
  const chrome = findChrome();
  execFileSync(chrome, [
    "--headless", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
    "--force-device-scale-factor=1", "--window-size=1600,900",
    `--screenshot=${outPath}`, `file://${htmlPath}`,
  ], { stdio: ["ignore", "ignore", "inherit"] });
  console.log(`rendered ${outPath} (variant=${spec.variant || "left-number"})`);
}

main();
