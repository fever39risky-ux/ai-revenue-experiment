# 本番前の読み取り検証 — 2026-10-01

対象PR: https://github.com/fever39risky-ux/ai-revenue-experiment/pull/27
読み取り対象head: 045b944 / main: 47b414b。今回許可された追加修正は末尾のcheckpoint後再検証のみ。本番設定・正本・Secrets値・課金設定は変更していない。

## 判断

**まだ有効化しない。** ローカルmockは30件成功したが、正本の確定原稿と入力検査の文字数定義が一致しない。これはユーザーによる原稿修正ではなく、AI側の実装修正で解消するべきもの。

## CIと状態

- PR #27: draft/open、未merge、GitHub上mergeable=true（読み取り時点）。
- head045b944のPR-triggered workflow_runs=[]、combined status statuses=[]。したがって「GitHub CI成功」ではなく「ローカルmock成功」。check-runs RESTは環境からForbiddenで取得できず、未確認を明記する。新CI起動はしていない。
- remote `ai-news-state` は未作成。news config.enabled=false。新news workflowはtemplateのみ。
- 実workflow差分はx-post-toplevelのpublish-main直列化4行のみ。

## 正本の現状を確認できた

Google Drive/Sheetsの既存接続でmetadata・bounded range・validationをread-only取得。前回READMEの「子環境で未確認」は今回解消。Google認証・Secretsを複製していない。

正本: https://docs.google.com/spreadsheets/d/1BSd9jv6B81Jxjndech9UgMyINA3peGFddLy8xTNs94w/edit

- 共通_システム設定!B7=browser。H7にAPI利用許可、AIニュースX API月3,000円、超過前停止・本人判断、別事業を止めない方針を確認。
- B5=3、B10=24h,72h,7d、B12=FALSE（本人の日常的な手直しを必須にしない）、B15=FALSE（共通タブ自動書込み禁止）。
- CODEX_運用ルール!C6: 画像優先、実際にブロックされた場合の本文fallback。C9/C10はAPI連携検証中、現行browserを確認。

| 正本レコード | 所在 | 状態・照合 |
|---|---|---|
| GPT6.1 C-20261001-001 | 投稿DB row103 / Queue row56 / Media row31 | posted、XPostID=2105481450862641444、11:14:30 JST |
| Gemini C-20261001-005 | 投稿DB row107 / Queue row57 / Media row35 | posted、XPostID=2105506748412940411、12:55:01 JST |
| ANCAR C-20261001-004 | 投稿DB row106 / Queue row58 / Media row34 | draft/planned、20:00予定、公開URL/IDなし、画像QA pass・prepared_not_attached |

GPT6.1/Geminiの投稿・queueのURL、BodyHash、公開日時は整合。ANCARは引き続き親管理で、API queue未投入。この環境には親のANCAR画像パスの実ファイルがなく、文字列のパスだけでは画像を渡せない。Library等の承認済みファイルをクラウドへmaterializeしてSHA256確認する作業はAI側の準備であり、ユーザーに再アップロードさせる前提にしない。

## 入力検査の不一致（修正待ち）

正本K列の全文をコードのvalidatorへ渡す純粋関数検査。API呼出し0、queue投入0。3件ともUTF-8 SHA256は正本AG列のBodyHashと完全一致した。

| 原稿 | URL込みcodepoints | URLを除いた本文 | 現行validator |
|---|---:|---:|---|
| GPT6.1 | 587 | 500 | 拒否 |
| Gemini | 575 | 487 | 拒否 |
| ANCAR | 597 | 537 | 拒否 |

core.mjsは「URLを除いて575〜600」を要求しているため、本人向け確定稿を変更せず通せない。文字数の説明・検査・test fixtureを正本の定義へ合わせる修正が必要。既知の公開済み2件は修正後も再投入しない。

## 既存列への対応（構造変更不要）

| 対象タブ・sheetId | 入出力の既存列 | 注意 |
|---|---|---|
| CODEX_投稿DB / 1004 | A ContentID、F 元NewsID、K 投稿文_最終版、V 予約日時、AG BodyHash、H 投稿ステータス、O 投稿URL、AM XPostID、AN PublishedAt、AO PlatformPostID | Vは予定、ANは実公開。遅延・API receipt証拠はU備考に追記し既存内容を保持 |
| CODEX_予約投稿キュー / 720004 | A QueueID、E ContentID、F NewsID、G ScheduledAt、J PostText、K MediaType、L MediaPath、N PostURL、O Status、Q BodyHash、V RetryCount、W LastError、X UpdatedAt、Y Platform | Eを投稿DBのAへjoin。API queueをX native scheduledとして記録しない |
| CODEX_メディアDB / 1009 | A ImageID、C 紐づくContentID、J 画像URL/保存先、N RenderStatus、O QAStatus、P FilePath、S MediaHash、T AttachState | X media_id/media_key専用列はない。L備考にAPI evidenceとして保存する案。列追加なし |
| CODEX_KPI / 710004 | A KPIEventID、B NewsID、C RunID、D ObservedAt、E Impressions、R ContentID、S PostURL、T PublishedAt、AB Likes、AC Replies、AD Reposts、AE Bookmarks、AG ObservationWindow、AH Platform、AI PrimaryMetricName、AJ PrimaryMetricValue | 取得できないEngagements/ProfileViews等を0補完しない。現在のAPIはpublic_metricsのみ。学習は実測と解釈を分離 |
| CODEX_学習DB / 710005 | A LearningID、B EvidenceWindow、C Hypothesis、D ObservedChange、E Confidence、F RecommendedChange、H ApplyStatus、K LearningType、M SampleSize、N Metric | 現行exportの生観測をそのまま既存カラムへ書ける形ではない。仮説/改善案の生成は別工程で、観測だけで効果を断定しない |
| GPT_ニュースDB / 1003 | A NewsID、H URL、AM 一次情報URL、AV 重複キー、AW 収集RunID | source_urls/topic_keyの根拠。GPT側は読むだけ |

source_refsは行番号を恒久IDにせず、ContentID/QueueID/ImageID等で再検索する。package.idは現行正規表現が小文字限定なので、ContentIDを決定論的に小文字化し、元のIDはsource_refsに保持する。approvalHashは承認package全体のハッシュであり、正本BodyHash（本文のみ）で上書きしない。

**状態enumの変換が必須**：Queue O列はstrict validationで planned/ready/scheduled/posted/failed/blocked/cancelledだけ。内部verified/post_intent/posted_unverifiedを直書き不可。verified→posted、結果不明→blocked＋Wにreasonとtweet ID、未公開のAPI queue→planned/readyの対応案。結果不明を未投稿として再queueしない。予約確認列PやBrowserEvidence列UにAPI queueをnative予約確認として書かない。

KPIは観測ごとのKPIEventIDを新規割当し、学習は必要時のLearningIDを割当する。現在のpackage仕様の「既存kpi/learning参照必須」は空の未来観測行と自然には一致しないため、将来event用の論理参照と親側upsert規則を確定する必要がある。Googleへの実writebackは本PRにない。

## 全投稿経路と競合

| 経路 | トリガー・現状 | ニュースとの関係 |
|---|---|---|
| x-phase2 | 08:37/12:37/20:37、2件/日、publish-main | 10/1 20:37、10/2 08:37/20:37 queueあり。変更しない |
| social-x / commentary | 30分毎・manual・専用queue push、publish-main | 稼働queueファイルは現在なし |
| x-post-toplevel | manual、mainでは共有lockなし | PRがpublish-mainを追加。現在専用queueなし |
| x-post-voice-test | manual、publish-main | 過去のvoice-test receiptあり。一度限り経路も棚卸し対象 |
| scripts/post_x.mjs | 現在workflow参照なし、legacy queue/postedは空 | 直接CLI起動は共有lock外。旧ops/AUTOMATION.mdは現workflowと不一致。新news inventoryはこの旧ディレクトリを走査しないため、復活させない運用か追加検知が必要 |
| 親のbrowser/既存ニュースtask | B7=browserで現行運用 | GitHub lock外。ANCAR移管・切替境界を親が管理し、並行writerを残さない |
| X verify/fetch | read-only API | 投稿しないが有料readの帰属は別事業と分離 |

現在repo inventory 207件、日時未確定の稼働queue0。正本の2件と既存事業receiptのID/本文は別。既存事業の朝投稿は11:20:56 JST（2105483067351507272）で、GPT6.1の11:14:30とは6分26秒差。別経路が自動では協調していなかった実例として扱う。ニュース自身の30分ガードは今後の競合抑止であり過去の事実を隠さない。

20:00ニュースと20:37事業は定刻なら37分差。ただしニュースが20:07を過ぎると30分未満に入り停止する。Actionsの実行遅延により08/20枠が実質約7分で停止し得る。定刻・全量実行の保証はしない。単なる共有lockは同時実行を防ぐだけで、他経路が直後に投稿することまで防がないため、browserを含む予定inventoryと運用切替が必要。

## 料金・権限の証拠の引継ぎ

公式pricingはURL Create $0.2、Read $0.005、MediaMetadata $0.005。90投稿+360read=$19.80で、画像upload等は別。既存短文の投稿成功は既存OAuth1で短文create/readできる証拠であって、長文・画像の適格性を証明しない。

親からのConsole担当の中間報告: 認証済み、共有残高$4.18。これはニュース専用残高・月間使用額・将来必要額の証拠ではないためconfigに自動採用しない。単価/権限確認結果を待つ。

Console担当に必要な非秘密の証拠: 対象app/accountの対応、既存read/write権限、Premium/longform条件、media endpointと現在のOAuth方式の可否、upload課金単位/単価、ニュース分の請求帰属、税/通貨/換算根拠、既存spend limit/auto-rechargeの表示状態。設定は変えず、key/token/secretを表示・コピーしない。不明項目はnullのまま停止を維持する。

## 今回の追加修正

親の独立reviewで発見した「post_intentのremote push中に時刻が進む」競合を修正。ack直後、create直前に15分期限とアカウント競合を再確認し、間にawaitを置かない。

回帰テスト: (1)20:06:59判定→push中2秒経過→20:37事業の保護窓へ入りPOSTゼロ、(2)予定+14分59秒→push中2秒経過→15分超過でPOSTゼロ。durable intentとhaltを保持し再起動しても自動POSTしない。合計30 tests PASS。

## ユーザー本人の操作

現時点で新Secrets入力、再認可、課金変更、PC起動が必要とは判定していない。Consoleの既存認証は親担当が確認済み。上記の実装修正・mapping・状態準備・重複確認はAI側の仕事。

AI側の不一致解消とConsole証拠確認後に、ユーザーが一度判断するのは「確認済み条件で本番に切り替えるか」の最終判断。ログイン/2FA等が実際に必要と判明した場合だけ、該当操作をその時まとめて依頼する。月額追加予算は要求せず、3,000円を超える前の停止方針を維持する。
