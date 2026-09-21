# 入力1回 → 台帳・メール確認用プレビューの小規模デモ

`node demos/dispatch-proof/demo.mjs` で result.json を再生成します。架空2案件を使い、1件の未配車を除外し、人間による担当変更時に古い下書きの確認警告を出します。重複ID・不足入力を拒否します。

これはJavaScriptの変換ロジックの実行証拠です。GAS/Sheets/Gmail連携、画面、採番の同時実行、数式保全、復旧、本番性能は未実装・未検証。顧客データを使わず、通信も送信も行いません。結果が同じになることは外部システムへの書込みの冪等性を証明しません。

狙いは、全システム開発を約束する前に、実務の小さな一部分を見て評価してもらうことです。

## TEST用Apps Scriptプレビュー（2026-09-21追加）

1. 新規の空のGoogle Sheetsを `TEST_DEMO` という名前で作成します。本番ファイルは使いません。
2. `DEMO_INPUT` シートを作り、全セルをプレーンテキスト形式にして `sample.tsv` の架空データをA1へ貼ります。
3. 拡張機能→Apps Scriptへ `preview.gs` を貼り、内容を確認して `previewDispatch` を実行します。
4. 新しい `PREVIEW_...` シートに確認用一覧が出ます。実行ごとに別シートを作ります。既存シートは更新しません。

`node demos/dispatch-proof/test-preview.mjs` でGASコードをモック環境で検証できます。未配車の文面除外・重複ID・実在しない日付・不足入力・ヘッダー不一致・TEST名の制限・数式として解釈されうる文字の無害化を確認済み。実Googleアカウントでの実行は未検証です。Gmail下書き、送信、既存台帳の更新、採番、復旧、同時編集は含みません。既存のdemo.mjsは別途、変更警告の概念例です。今回のGS版には変更履歴比較は未実装です。

公式API参照: [SpreadsheetApp](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app)、[Range](https://developers.google.com/apps-script/reference/spreadsheet/range)。権限ダイアログは実行者が内容を確認してください。部分的な書込み失敗時には新規プレビューシートが残る場合があります。
