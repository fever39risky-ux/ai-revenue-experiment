# 検証記録 — 2026-10-01

基点: `origin/main` 7932e9d（2026-10-01T02:20:56Z の既存X更新）。
作業: `codex/ai-news-cloud-queue`。全テストはlocal/mock。X API・画像upload・投稿・課金・Secrets操作なし。

| 検証 | 結果 |
|---|---|
| `node --test tests/test_ai_news.mjs` | 39/39 PASS |
| `node --test tests/test_ai_news_sheet.mjs` | 10/10 PASS（正本→mock API→反映案往復） |
| `node tests/test_periods.mjs` | PASS |
| `bash tests/test_ops.sh` | PASS（fixtureを本番台帳から分離） |
| `node scripts/oct/x_phase2.mjs validate` | PASS、既存20:37キュー222 weighted |
| `bash tests/test_x_schedule.sh` | SKIP、既存朝枠が消化済み。news suiteで20:37 cron・2件/日・キュー保持を別途assert |
| `node scripts/promotion_check.mjs` | 0 problems |
| `node scripts/leak_check.mjs` | 0 fail / 0 warn |
| `git diff --check` | PASS |
| news dry-run | 0 API calls、0投入原稿、news_disabled、実費未確認をnull表示 |
| 既存アカウント記録read-only scan | 205 records、日時未確定の稼働キュー0（外部writerの完全性確認ではない） |

28件には、長文+URL完全保持、承認ハッシュ、投稿IDをGET前に保存、POST応答不明、receipt push失敗からの再起動、前段push失敗、GETのみの再試行と3回上限、画像欠落/改変/拒否/timeout/空レスポンス、許可済み本文代替、料金不明時停止、円上限ちょうど/最小単位超過、FX増額、請求照合、API外費用予約、翌月先行予約、観測月ずれ、公開遅延、枠/1日制限、既存20:37との競合、既知2投稿再投稿禁止、全文/t.co展開/添付検証、シート用export、mock HTTP payloadを含む。

Git永続化はローカルbare remote＋別checkoutで実験。checkpointのremote保存と、古いcheckoutによる更新拒否を確認。実GitHub Actionsでのlive実行は未検証。

`test_ops.sh` は本番October台帳のunknown costをコピーしながら「テストが追加したunknown costだけで1」と固定assertしていた。本日既存unknownが1あるため変更前に2となり失敗。テスト専用の空entriesを作り、本番台帳を変えずに解消。

残る開始条件はREADMEに記載。現アカウントのPremium/長文/API権限、画像upload単価とOAuth1対応、実費帰属・FX/税・API外費用、外部writerの棚卸し、Google正本の実列との対応、state branch/通知設定を未確認。既存のSecretsは参照名のみ。本番state branch・新workflow・新Secrets・OAuth権限・Console設定は作成/変更していない。

提示された既存run https://github.com/fever39risky-ux/ai-revenue-experiment/actions/runs/36805396703 は既存270 weighted経路の証拠であり、本ニュース経路の長文画像適格性を証明しない。GPT6.1/Gemini4のID/時刻は親の提供情報から登録し、この作業でXへ有料照会していない。ANCARは未投入。

## 追加レビュー後

正本read-only照合と親からの追加指摘を反映。詳細はPREFLIGHT.md。news suiteは36/36 PASSへ更新。API呼出しは引き続き0。画像権限unknown、checkpoint中の時刻/料金期限変化、外部手動ニュースの件数、report欠落時の誤報を追加検証。正本の全文とBodyHashも純粋関数で照合し、URL込み文字数検査へ修正。
