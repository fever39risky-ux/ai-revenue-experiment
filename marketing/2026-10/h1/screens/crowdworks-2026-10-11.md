# CrowdWorks screen — 2026-10-11 (daily scan, mac-local, ~10:05 JST)

Profile: dedicated `crowdworks-profile` (playwright-crowdworks, headless). **Still LOGGED OUT** (header shows ログイン / 会員登録). This screen uses public data only. Sending needs `owner-crowdworks-relogin-profile`. PG-2 is granted, so login is the only remaining gate.
Method: newest-first search pages 1–4 (down to listings released before 10/10 22:30 JST) plus 24 keywords × 2 pages. Data comes from `#vue-container` JSON via same-origin fetches (1 page load). The job pages were fetched in-page.

## Supply numbers

| Measure | Count |
|---|---|
| Unique open listings pulled | 1,257 |
| …released/re-released since 10/10 22:30 JST | 191 |
| Passed the fixed-price ¥5k–50k + title-fit pre-filter (creative/SNS/staff/ongoing/beginner-lure excluded) | 12 |
| Read in full | 5 (3 new + 2 standing drafts) |
| **GO (new)** | **1** (13522739, not sendable: logged out) |

## Per-request screen

| id | title (short) | budget | 応募 / 枠 | verdict | reason |
|---|---|---|---|---|---|
| [13522739](https://crowdworks.jp/public/jobs/13522739) | 【秋冬シーズン】商品説明文の作成 ×10点 | ¥8,000 fixed | 2 / 3 | **GO, NOT SENT** | Writes 10 product descriptions for autumn/winter clothing and goods from materials the buyer provides, in the buyer's format (Sheets/Word). 5-day delivery and a clear done-condition. We would be the 3rd applicant. Net after the 20% fee is ¥6,400, which is profitable. Risks: the client has 0 reviews and no KYC. The rule is 20+/no students. Apply-by **10/12**. Blocked only by the logout |
| [13522759](https://crowdworks.jp/public/jobs/13522759) | Excelフォーマットに数字入力 | listed ¥30–50k | 2 / 3 | NO | The body says it pays ¥1,500–2,000 per hour as ongoing staff-style input, so the listed fixed budget doesn't match. The scope is undefined, so filter 3/5 can't be checked |
| [13522403](https://crowdworks.jp/public/jobs/13522403) | Google広告 CV設定 (GA4/GTM/クロスドメイン) | ≤¥10k | 23 / 1 | NO | The work happens inside the buyer's GA4/GTM/Ads accounts (filter 2). It has 23 applicants for 1 slot |
| [13521885](https://crowdworks.jp/public/jobs/13521885) | 取扱説明書 PDF/紙→Word (standing GO) | ¥8,000/件 | 18 / 3 | FIT, NOT SENT | Apply-by **today 10/11**. It went from 9 to 18 applicants overnight. Still blocked by the logout (crowdworks-send-go-1011) |
| [13513520](https://crowdworks.jp/public/jobs/13513520) | ドラマ データ分類 (standing Draft B) | ¥8,000 | 30 / 7 | **CLOSED** | このお仕事の募集は終了しています. Drop it from crowdworks-send-go-1011 |

Rejected at title level (12-hit list): 13522702 (SNS staff), 13522687 (on-site Kawagoe survey), 13512674/13473020 (Canva design), 13522589 (cafe writing, experience-based), 13522547 (LT speaker), 13522497 (Threads ops), 13522479 (voice recording), 13522462 (survey ≤¥5k).

## Sends

**0 sent.** The profile is logged out. 10/11 combined count: 0/5. The sendable queue after login is 13521885 (only if still open on 10/11) and 13522739 (apply-by 10/12).
