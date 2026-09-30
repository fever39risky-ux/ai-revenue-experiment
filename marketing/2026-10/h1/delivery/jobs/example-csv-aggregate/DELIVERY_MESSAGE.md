# Delivery message (talk room) — example-csv-aggregate  (WORKED EXAMPLE)

```
〇〇様

お待たせしました。ご依頼「経費CSVの月次・カテゴリ集計」が完成しましたので納品いたします。

■ 納品物
・集計.gs（スクリプト本体）
・手順書（導入と使い方）
・動作確認結果（ダミーデータ）

■ 導入方法
手順書のとおり、スプレッドシートの「拡張機能 → Apps Script」に貼り付け、メニュー「集計 → 月×カテゴリ集計」で実行してください。外部APIは使わないため追加費用はかかりません。

■ 動作確認
書式のばらついたダミーデータ（¥や空白入りの金額、2026/09/03・2026-9-15 のような日付、空行・品目空欄）で動作を確認済みです。月×カテゴリで正しく合計・件数が出ることを確認しました。

■ 補足
・制作にはAIを活用しております。想定と違う書式があればサンプルをお送りください。修正2回まで無料で対応します。

ご確認のうえ、問題なければ「承認」いただけますと幸いです。
```

## Checklist
- [x] Files: `集計.gs` + `TEJUNSHO.md`
- [x] `test.mjs` green (see ACCEPTANCE_CHECK.md)
- [x] No PII
- [x] Price/deadline match intake (¥6,000 / 10-04)
- [ ] (real job) after buyer confirms payment → `ops.mjs revenue ... --evidence "<coconala order id>"`
