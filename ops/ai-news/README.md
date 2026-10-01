# AIニュースのクラウド投稿（レビュー待ち・本番無効）

対象は @KinoshitaTsks のニュースだけ。既存の売上実験の `social/2026-10/queue`、1日2投稿、posted.jsonl、料金台帳を流用しない。ニュース予算は **月3,000円**。この差分は本番投稿・課金・認証操作を一切実行していない。

## 今回の範囲

- `scripts/ai-news/`：承認済みの長文＋出典URLを、そのまま単独投稿する別経路。画像はPNG/JPEG 1枚・5MB以下。短縮、スレッド化、URL削除、文章生成はしない。
- `social/ai-news/`：無効設定、空キュー、初期状態の見本。GPT6.1/Gemini4の公開済みID・日時・topicを登録。**ANCAR原稿は未投入**。
- `ops/ai-news/cloud.yml.template`：未有効化のActionsテンプレート。`.github/workflows` の新規workflowではない。承認後、GitHub上の `ai-news-state` ブランチが入力・費用予約・投稿結果・KPIを保持する。PCを起動しておく必要はない。
- 既存 `x-post-toplevel.yml` に他のX投稿と同じ `publish-main` concurrencyを追加する提案のみ。dispatchの追加や実行はしない。既存20:37投稿、2件/日の判定は変更していない。
- 初回実装時はGoogle正本を未確認だったが、その後read-only照合でタブ・列・確定原稿を確認済み（PREFLIGHT.md）。認証をコピーせず、親が確定原稿を渡す契約を実装。既存シートの列・タブ変更や直接writebackは行わない。

## 入出力：親が渡すもの

正本： https://docs.google.com/spreadsheets/d/1BSd9jv6B81Jxjndech9UgMyINA3peGFddLy8xTNs94w/edit

状態用ブランチのルートに `config.json`, `state.json`, `queue/*.json`, `media/*` を置く。初期化は一度だけ。運用開始後は絶対に初期stateで上書きしない。queueは公開後も承認の証拠として保持する。

queue JSON（`approval.sha256`は下記の関数で計算。ハッシュは内容固定用で、電子署名ではない。ブランチへの書込み権限・レビューが承認の信頼境界）：

```js
{
  schema: 1,
  id: 'news-20261002-0800-example', // 永続ID。再試行や改稿で別IDにして再投入しない
  account: 'KinoshitaTsks',
  sheet_id: '1BSd9jv6B81Jxjndech9UgMyINA3peGFddLy8xTNs94w',
  topic_key: 'stable-canonical-story-key', // 同じニュースには常に同じキー
  scheduled_at: '2026-10-02T08:00:00+09:00',
  text: '承認済み全文575〜600 Unicode codepoints（改行・完全な出典URL込み）',
  source_urls: ['https://actual-source.example/article'],
  source_refs: {
    post: '実在する投稿DBの行ID', queue: '実在する予約投稿キューの行ID',
    media: '実在するメディアDBの行ID', kpi: '実在するKPIの行ID',
    learning: '実在する学習DBの行ID'
  },
  image: { path: 'media/approved.png', sha256: '画像bytesのSHA256', mime: 'image/png' },
  text_fallback: { allowed: true, reason: null },
  approval: { by: '承認を確定した担当者', at: 'ISO日時', sha256: 'approvalHash(package)' }
}
```

`approvalHash` は `scripts/ai-news/core.mjs` からimportする。入力配列順も固定する。正文の改行・空白を保存し、文字数は正本に合わせ、URL・改行を含む全文のcodepointsで検査する（不適合時は書換えず停止）。媒体なしで渡すときは `image: null` と `text_fallback: {allowed: true, reason: 'technical' | 'approval'}` が必要。証拠付きで確認済みの画像権限拒否・ファイル欠落・明確な画像リクエスト拒否では許可済み本文代替を使える。料金不明を安く見積もるための本文代替は行わない。アップロードの結果不明時は停止する。権限未確認も停止する。権限拒否に基づく代替は `capabilities.media_upload=false` と `media_upload_denial: {confirmed:true, evidence:"非秘密の拒否根拠", checked_at:"ISO", valid_until:"ISO"}` が必要。

親は原稿の事実確認・本人文体・同一ニュースの意味上の重複を確認し、GPT6.1/Gemini4に別topicキーをつけて再投入しない。既知の投稿本文をinventoryに加えれば完全一致も検出する。意味の異なる文章が同じ話題かどうかを自動で断定する仕組みではない。

```sh
node scripts/ai-news/cli.mjs dry-run social/ai-news /tmp/ai-news-report.json
node scripts/ai-news/export.mjs path/to/state.json /tmp/ai-news-sheet-proposal.json
node --test tests/test_ai_news.mjs
```

exportは投稿DB・予約投稿キュー・メディアDB・KPI・学習DBの論理upsert案を出す。親が実際の列にマッピングし、同じ `key` を二重追加しないよう反映する。未公開日時・欠けた指標・学習の解釈はnull。観測結果から架空の改善効果を作らない。出力自体はGoogleに書き込まない。

## 時刻・競合・再起動

08:00 / 12:00 / 20:00 JSTの3枠。これは **APIのクラウドキュー** でありXネイティブ予約ではない。GitHub scheduleは遅延・欠落し得るので定刻保証なし。15分を超えた投稿は停止して報告、まとめて消化しない。正午前の前倒しも不可。KPIは直後、実公開から24/72/168時間後が対象で、毎時17分の起動等により遅れて取得され得る。予定日時・取得日時・実公開日時・投稿遅延秒を別記録する。

既存の全月posted.jsonl/queue、旧history/稼働キュー、保存済み自分の投稿をread-onlyで照合。ニュースの公開済みtopic・本文・同じ枠を重複排除し、ニュース1日3件にはstateとaccount_inventory双方の既知の手動ニュースも含み、tweet IDで重複排除する。既存事業の投稿数はニュースに合算しない。他の投稿の予定／実公開の前後30分はニュース側を止める。20:00予定が20:10実行になると20:37既存投稿まで27分なので停止する。

`publish-main` はリポジトリ内の投稿workflowを直列化する。Actions concurrencyは実行順・全pending job保存を保証しない。**ブラウザ投稿、他リポジトリ、手動APIはこのロックに従わない**。開始前に親が全投稿経路を棚卸し、未調整writerがないことと手動投稿の予定/履歴を `account_inventory` に記録する。未確認・期限切れ・日時のない稼働キューがあるとニュース側を停止。既存経路のPOST後GET失敗問題はこのPRで修正していないため、既存経路に不明結果があればニュースの棚卸しを承認しない。

writeの順番は **費用予約をpush → upload intentをpush → upload → media IDをpush → post intentをpush → POST → tweet IDをpush → GET**。成功ID保存より先にGETしない。push失敗は後続APIを禁止し、remoteに残るintentが再起動時の自動再投稿を禁止する。HTTPエラーでもPOSTは自動再試行しない。GETのみ1時間以上あけて最大3回、各回の費用を予約する。画像の非同期processingは追加の料金不明pollingをせず停止する。

未完了の予約/intent/media-readyを見つけた再起動も安全側で停止する。GitHub artifactは事故調査用の補助であり、正本はremote checkpoint。state branch欠落、壊れたJSON、dirty checkout、同時更新、push拒否は停止する。git pushを勝手にrebase/forceして投稿を継続しない。

## 費用と停止

JPYの100分の1単位の整数で切り上げ予約する。ニュース専用の **確認済み実費＋未照合の実行/失敗費用予約＋将来観測予約 ≤ 300,000 minor JPY** を各JST暦月で守る。共有アプリ全体の料金をニュース費として取り込まない。月を跨ぐ24/72/7日観測は先に翌月分も予約し、翌月の請求条件が不明なら新規投稿も止める。取得遅延でさらに月が変われば実行月で再予約し、古い予約は照合まで保持する。

`config.json` の確定必須項目：

- `jpy_per_usd_ceiling`（換算上限）、`tax_rate`、`margin_rate`（最低10%）、料金の根拠 `pricing_evidence`、確認日時/期限。
- `prices.create_usd >= 0.2`、`read_usd >= 0.005`、画像を使う場合は確定した `upload_usd`。uploadの既定値nullは停止。
- `billing.news_only: true`、ニュース帰属の請求証拠/有効期限、`months['YYYY-MM'].actual_minor_jpy` と `reconciled_operation_ids`。Actions等のAPI以外のニュース費用には `non_api_reserve_minor_jpy` の確認済み月間上限予約も必須（無料枠で0の場合も証拠が必要）。その予約も3,000円の内数。初月の0円も確認根拠が必要。照合IDは実行済みの費用予約だけ。実費をAPI成功レスポンスから捏造しない。

未照合予約を実費と呼ばない。プロバイダ請求と照合済みの操作IDのみ実費に置き換える。失敗リクエストも無料扱いせず予約を保持する。将来のreadは実行前に最新のFX/料金で予約を増額し、増額できなければ停止する。承認済み換算上限を超える相場/税/料金変更は設定期限と再確認で止める運用が必要で、未知の請求額を数学的に保証できるものではない。

上限/不明価格/権限/不明投稿等で `state.halt` を永続保存。以後、月替わりでも自動復帰しない。JSON報告とActions summary/artifactに、実費・未照合予約・未実行原稿・未観測予定を残し、失敗終了してユーザー判断を待つ。Actionsの失敗通知を本人が受け取れる設定は開始条件。メール/Slack等の外部送信は追加していない。Secrets作成、課金Console上限変更、自動リチャージ設定、追加予算消費はしない。

90投稿＋270観測＋直後90確認なら、公開の単価による基本額は **$19.80**。画像upload、税、為替、安全余裕、GET再試行は別。Media Metadataは$0.005/回だが本実装ではそのエンドポイントを呼ばない。将来alt text等のmetadata APIを追加する場合は別費用予約が必要。月3,000円で90投稿を賄えるとは約束しない。

## 本番開始前の一度の手順（今回は未実施）

1. 親が差分と検証結果をレビュー。現アカウントID、Premium/longform適格性、既存OAuth1のwrite権限、media upload権限・単価を正規の証拠で確認。API機能の存在と当該アカウントの利用可否を分ける。テスト投稿・新OAuth認可は別承認なしにしない。
2. 全アカウントの既存/手動/外部writer・公開済みニュース・予約を棚卸し、投稿時間帯を調整。正本の実在レコード参照・既存列とのexport対応を親が確定。ANCARは引き続き親管理で、意図的に移管するまでqueueへ入れない。
3. ニュース帰属の実費と価格/換算/税/余裕/有効期限を確定しconfigを設定。追加予算を使わない。共有アプリ全体のConsole上限を変更して既存事業を止めない。
4. コードを通常レビューでmerge後、別途承認を得て専用 `ai-news-state` ブランチを一度だけ初期化する（ルートは `social/ai-news/` の内容のみ、隠し`.gitkeep`も保持）。主ブランチと独立した状態用ブランチにし、GitHub Actionsからの既存repository tokenによるcommit/pushを許可。Secrets値の取得/コピー/作成なし。config/queueの書込権限を限定し、stateを巻き戻さない。
5. 親の確定原稿・画像だけ入力してdry-runし、通知先/Actions失敗通知・artifact閲覧・state保全を確認。最終承認後にのみtemplateを `.github/workflows/x-ai-news.yml` に設置し、config `enabled: true` とRepository Variable `AI_NEWS_ENABLED=approved` を設定。既存4つのX Secret参照名だけを使用する。workflowはmain起動でのみliveを許す。

**日々の必要作業**：親のクラウド作業で原稿承認/投入、外部投稿inventory更新、期限内の料金照合を行う。PCでの常駐は不要だが、情報が古ければ自動で停止する。Google直接同期を別途希望する場合は最小権限接続と列mappingを提案し、今回の実装済み機能とは扱わない。

**停止からの復旧**：post intent不明時はXの実履歴・Actions artifact・remote checkpointで公開有無を調査し、公開済みなら同じnews IDにtweet IDを補完してposted_unverifiedへ。公開されていないことの証拠が取れない限り再POSTしない。費用停止は使用額と未実行一覧を提示しユーザー判断を待つ。元の上限を増やさず、明示的な判断に沿って延期/取消・料金照合後にhaltを解除する。月替わりだけを理由に解除しない。

## 公式仕様の確認（2026-10-01）

- [X changelog](https://docs.x.com/changelog)：2024-08-09長文作成、08-20に25kへ拡張。
- [Create Posts](https://docs.x.com/x-api/posts/create-post)：`POST /2/tweets` のtextとmedia.media_ids。同時使用するJSONをmock検証。実アカウントの長文画像投稿は未実証。
- [Upload media](https://docs.x.com/x-api/media/upload-media)：`POST /2/media/upload` のbase64 JSON、media_category=tweet_image。OAuth1による現アカウントの利用は未検証。
- [Pricing](https://docs.x.com/x-api/getting-started/pricing)：URL付きCreate $0.2、Posts Read $0.005、Media Metadata $0.005。割引/重複排除を安く見積もる根拠にしない。
- [GitHub schedule](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)：高負荷で遅延/欠落し得る。Web長文予約と混同しない。

- [X Help: post types](https://help.x.com/en/using-x/types-of-posts)：長文はPremium条件があり、Web上の長文のdraft保存・後日の予約は不可。APIクラウドキューの機能とは別。
