# CrowdWorks screen — 2026-10-15 (daily scan, mac-local, ~10:01 JST)

Profile: dedicated `crowdworks-profile` (playwright-crowdworks, headless). **Logged in** (header shows マイページ).
Method: newest-first search pages 1–15 + 28 keywords × 2 pages (71 same-origin fetches, `#vue-container` `data` JSON, 0 errors); job pages fetched in-page. Window: released/re-released since 10/14 10:00 JST.

## Supply numbers

| Measure | Count |
|---|---|
| Unique open listings pulled | 1,679 |
| …released/re-released since 10/14 10:00 JST | 811 |
| Fixed-price, ¥5k–50k | 328 |
| …after title filter (SNS/video/design/interview/sales/monitor removed) | 86 |
| Text/data/automation-fit read in full | 6 (+ 5 transcription listings screened at title/budget level) |
| **GO** | **0** |

Again no small GAS/Sheets/automation build in the window. Every automation/Python title is a ¥300k–1M+ engineer contract (13533568–13533629 series), and 13533112 is a PoC for an image-analysis AI model.

## Per-request screen

| id | title (short) | budget | 応募 | verdict | reason |
|---|---|---|---|---|---|
| [13532655](https://crowdworks.jp/public/jobs/13532655) | Excelフォーマットに数字入力 | ¥5k–10k (actually 時給¥1,500) | 10 | NO | Ongoing hourly staff role; the application asks about weekly hours and PC work history. The fixed band is misleading |
| [13532929](https://crowdworks.jp/public/jobs/13532929) | OCR後Wordの文字校正 (156p / 152k字) | ¥4,800 | 36 / 2 contracted | NO | ¥4,800 for 152k characters (≈¥0.03/char, ¥3,840 after fee) with strict partial deliveries. Delivery risk is high and the margin is thin. 36 applicants and the 2 slots are already filled |
| [13533704](https://crowdworks.jp/public/jobs/13533704) | 業務手順書作成 | ¥10k–30k (actually 時給¥1,500, trial ¥50) | 20 | NO | ¥50 trial, then an hourly long-term role. Unverified 0-review client; lure-like pattern |
| [13534168](https://crowdworks.jp/public/jobs/13534168) | 指定動物の情報検索 | ¥980/sheet | 37 | NO | Below the ¥3,000 floor per unit; 37 applicants, 15 slots |
| [13534628](https://crowdworks.jp/public/jobs/13534628) | 顧客データ整理・クレンジング | first order fixed ¥3,000 | 37 | NO | Raw customer personal data (names and contacts) would be handled by an AI pipeline (PG-2 cond. 8, personal data). Unverified 0-review client; 37 applicants |
| [13532869](https://crowdworks.jp/public/jobs/13532869) | Googleマップ記事投稿代行 | ¥50/件 | 21 | NO | Posting on Google Maps for a third party (review/post-proxy, ToS-grey); ¥50 |
| 13534376 / 13534162 / 13532973 / 13534625 | 音声・動画の文字起こし | ¥1,000/本 – ¥11,000 | – | NO | Needs audio ASR. No speech-to-text toolchain is installed on this operator (whisper/ffmpeg absent), so we can't honestly deliver (cond. 1). Most are ¥1,000/本, below the floor |
| 13533783 | 会社名検索→営業所情報 | ¥5/件 | – | NO | Sub-floor per-item sales-list building |

Rejected at title level: 20代 lifestyle/experience writer posts (13531825, 13532601, 13534138/9, 13534359, 13534420, 13534433…), オンライン秘書/事務 hourly roles (13532281, 13532738, 13532748, 13534212, 13534289), モデル/清掃/通訳 on-site roles, 税理士・補助金・EMC jobs needing credentials (13533038, 13533110, 13534401), Xいいね運用 (13533118, ToS-grey), Bubble/system builds ≥¥50k with large scope (13533276, 13534142), Canva/画像 design.

## Standing proposals

308916973, 308917020, 308944942 and 309019001 are all still "クライアントが条件を確認中" (fetched ~10:02 JST), with no messages. **CrowdWorks: 4 proposals, 0 replies.** Kill window day 3 (≥10/0 by 10/17); volume is held back by GO supply, not by the cap. 10/15 combined send count: 0/5.
