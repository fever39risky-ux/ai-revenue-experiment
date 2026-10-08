# CrowdWorks screen — 2026-10-08 (first scan, mac-local, ~13:20 JST)

Profile: dedicated `crowdworks-profile` (playwright-crowdworks, headless) — logged in OK.
Method: newest-first search (pages 1–5, no keyword) + 16 keywords × 2 pages (GAS, スプレッドシート, Excel, マクロ, CSV, データ整形, 自動化, ChatGPT, 文字起こし, リスト作成, 集計, Python, Googleフォーム, データ入力, 記事作成, 資料作成) + categories 83/370/372/369/283/103/249/241 + group/development. Read from the search page JSON (one page load + same-origin fetches).

## Supply numbers (for the review)

| Measure | Count |
|---|---|
| Unique open listings pulled | 1,142 |
| …non-hourly (fixed / task / competition / writing) | 869 |
| …posted/re-released 10/07–10/08 | 495 |
| …fixed-price among those | 365 |
| …fixed-price with budget ≥ ¥10,000 | 192 |
| Passed keyword/category fit pre-filter (AI-deliverable, ≤ ~8–30 applicants, not hourly staff) | ~25 |
| Read in full | 11 |
| **GO** | **2** |

Read: the pool is ~10× Coconala's, but dominated by hourly/ongoing "staff" posts, ¥5–¥500 micro tasks, SNS list scraping, survey responses, and lure-pattern posts. Well-fit, objective, ≥¥3k one-off jobs are a small slice (≈2 GO from ~25 fits in one scan). Applicant counts are high: anything AI-adjacent and ≥¥10k had 25–80 applicants within hours; "AI業務自動化"-branded competitors appear in nearly every applicant list.

## Per-request screen

| id | title (short) | budget | 応募数 / 枠 | verdict | reason |
|---|---|---|---|---|---|
| [13513659](https://crowdworks.jp/public/jobs/13513659) | PDF社内マニュアル→Word転記・編集 (200–220p) | ¥15,000 fixed | 25 / 3 | **GO** | Objective done-condition (docx, 游明朝, layout ≈ PDF, editable), 1-page sample offered by buyer, 1-month deadline → AI-doable (PDF text/image extraction → python-docx → page-by-page check). ¥15k = G2 lever band. Not early (25 apps) but 3 slots. Buyer unverified/0 reviews → escrow only. |
| [13513520](https://crowdworks.jp/public/jobs/13513520) | ドラマ情報のデータ分類 500件 | ¥8,000 fixed | 26 / 7 | **GO** | Rule-based genre/category classification per manual, 2-week deadline, objective (500 rows). AI-doable in <1 day + human-style check. 7 slots. Buyer unverified/0 reviews. |
| [13514127](https://crowdworks.jp/public/jobs/13514127) | 講演会 PDF→Word 文字起こし | ¥5,000/file | 27 / 15 | NO | Lure pattern: 3 near-identical "PDF→Word文字起こし" posts (also 13512935, 13510904) from new unverified accounts at an above-market ¥5k/3,000 chars, 15 slots, age-gated. Risk of off-platform/paid-manual funnel; not worth a send slot. |
| [13514364](https://crowdworks.jp/public/jobs/13514364) | Instagram短文原稿・記録サポート | ¥30,000 | 5 / 5 | NO | Vague scope ("判断はすべて運営側"), daily ongoing 1 month, no objective deliverable, unverified 0-review buyer; asks 年代. |
| [13513792](https://crowdworks.jp/public/jobs/13513792) | マニュアル沿いチェック・集計 (月1) | ¥500/月 | 6 / 1 | NO | Below ¥3k floor; Gmail + LINE external contact required (PG-1 cond.6). |
| [13511912](https://crowdworks.jp/public/jobs/13511912) | AI生成画像の選別 | ¥3/scene | 3 / 1 | NO | Women only; requires ≥1 CrowdWorks track record (cond.4); rate far below floor. |
| [13514527](https://crowdworks.jp/public/jobs/13514527) | Instagram リサーチ・リスト化 | ¥1,000/sheet | 17 / 3 | NO | SNS list extraction (ToS-grey), low rate, deadline 10/09. |
| [13513289](https://crowdworks.jp/public/jobs/13513289) | Webフォーム作成・ご案内 | 成果報酬 | 10 / 10 | NO | Vague commission "ご案内" work — MLM/sales pattern, not form building. |
| [13512229](https://crowdworks.jp/public/jobs/13512229) | YouTube AI漫画 プロンプト/制作フロー構築 | 要相談 | 25 / 2 | NO | Needs image-generation tooling + sample images we can't produce without spend (cond.1/7); asks past manga-production portfolio (cond.4). |
| [13514086](https://crowdworks.jp/public/jobs/13514086) | Amazon大型OEM商品リサーチ | ¥3,000/件 成果 | 3 / 3 | NO | Requires SellerSprite (paid tool, cond.7); 45%-margin hits uncertain → effective rate risky. |
| [13514595](https://crowdworks.jp/public/jobs/13514595) | 指定カフェのSNS投稿リンク収集 | ¥700/20件 | 11 / 11 | NO | Below floor; SNS link scraping. |

Also skimmed and rejected at title level (not read in full): 13514332 BigQuery×Search Console export (¥5–10k, 31 apps — needs buyer GCP login, cond.2); cat370 "【AI開発】…AIエージェント" series 13512966/13512986/13512977/13512955/13512896/13512033 (¥150–200k, 26–66 apps — over the ¥50k band, buyer-system access); 13511477 AI業務改善アイデア整理 (83 apps); 13509920 AppSheet入力 (buyer account login); 13514134 税務 (実務経験者限定, cond.4); online-secretary/staff posts 13513363/13512961/13513351/13513240 (ongoing staffing, not a deliverable).

## Sends

**0 sent.** Both GO proposals were drafted, but filling the CrowdWorks application form was blocked by the local Claude Code auto-mode permission classifier ("Unrequested Commit in a Connected App") on `browser_type` in the proposal form. Not worked around. Drafts below are ready to paste once the permission exists.

### Draft A — 13513659 (¥13,637 税抜 = ¥15,000 税込, 完了予定 2026-10-18)

```
はじめまして。ご依頼内容を拝見しました。
「PDFの社内マニュアル（200〜220ページ）を、後から加筆・修正しやすいWordファイルに、PDFとできるだけ近いレイアウトで再現したい」というご依頼と理解しました。

■ ご提案内容
・PDFから本文テキストと画像・図表を抽出し、Word（.docx）上でページごとに再構成します
・本文は打ち直しではなく編集可能なテキストとして配置し、フォントは游明朝に統一します
・画像・写真は切り出して挿入、図表は可能なものは表として、複雑なものは画像として配置します
・ページごとに改ページを設定し、見開き資料は見開き単位で崩れないよう調整します
・PDFと1ページずつ見比べて、文字・図表の抜け漏れを確認してから納品します

■ 進め方
1. ご提示のサンプル1ページを先に作成してお送りします（レイアウト・フォントのご確認用、PDF受領後24時間以内）
2. 方向性をご確認いただいたうえで全ページを作成
3. 10/18までに全ページ納品 → ご確認後、修正は2回まで無料で対応します

■ 金額・納期
15,000円（税込）／2026年10月18日までに納品（ご希望の1か月より前倒し）

■ 補足（正直にお伝えします）
・作業にはAIと変換ツールを活用しており、その分スピードと価格を抑えています。最終的なレイアウト調整と全ページの照合は責任を持って行います。
・クラウドワークスでの実績はまだありません。そのためサンプル1ページで品質をご判断いただければ幸いです。お支払いはクラウドワークスの仮払い（エスクロー）なので、ご確認後の検収で安心してご利用いただけます。
・やり取りはすべてクラウドワークス内で行います。

ご不明点があれば、お気軽にご質問ください。
```

### Draft B — 13513520 (¥7,273 税抜 = ¥8,000 税込, 完了予定 2026-10-15)

```
はじめまして。ご依頼内容を拝見しました。
ドラマ作品500件を、マニュアルのルールに沿ってジャンル・カテゴリーなどに分類するお仕事と理解しました。

■ ご提案内容
・いただくマニュアルの分類ルールを最初に整理し、判断に迷うケースの基準を先にご確認します
・500件をルールに沿って分類し、判断が難しかった作品には備考欄に理由を残します
・分類結果はご指定のシート形式で、記入漏れゼロを確認してから納品します

■ 進め方
1. 最初の20件を先に分類してお送りし、基準のズレがないかご確認いただきます（無料サンプル）
2. 確認後、残りを一括で作業
3. 契約から1週間以内（10/15目安）に全500件を納品、修正は2回まで無料

■ 金額・納期
8,000円（税込）／契約から1週間以内

■ 補足（正直にお伝えします）
・作業にはAIを活用して作品情報を確認・整理しており、その分スピードと正確性のチェックに時間をかけています。最終確認は責任を持って行います。
・クラウドワークスでの実績はまだありません。最初の20件で精度をご判断ください。お支払いは仮払い（エスクロー）なので安心してご依頼いただけます。

ご質問があれば、お気軽にお問い合わせください。
```

## PG-1 conditions (both drafts)
1. Deliverable with current capabilities — A: PDF→docx extraction/rebuild + per-page check; B: rule-based classification. ok
2. Profitable after 20% fee — A: ¥12,000 net; B: ¥6,400 net; only AI compute. ok
3. Delivery risk not excessive — A: buyer gives 1 month, we commit 10/18 with sample first; B: 2-week buyer deadline, we commit 1 week. ok
4. No false track record — drafts state "クラウドワークスでの実績はまだありません" and disclose AI use. ok
5. Platform terms — CrowdWorks rules respected (no off-platform). ok
6. No external contact — "やり取りはすべてクラウドワークス内". ok
7. No spending / legal consent / KYC — none. ok
