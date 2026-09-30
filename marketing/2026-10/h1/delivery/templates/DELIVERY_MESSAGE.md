# Delivery message (talk room) — <job-id>

> `mac-local` posts this in the Coconala talk room together with the files. Edit per job. Keep it honest and short.

```
<お客様のお名前>様

お待たせしました。ご依頼いただいた「<依頼内容を1行>」が完成しましたので納品いたします。

■ 納品物
・<ファイル名>.gs（スクリプト本体）
・手順書.pdf（導入と使い方。画像つき）
・<必要なら> サンプルの動作確認結果

■ 導入方法
手順書のとおり、スプレッドシートの「拡張機能 → Apps Script」に貼り付けてご利用ください。
初回のみGoogleの承認が必要です（お客様のシートのみにアクセスします）。

■ 動作確認
ダミーデータで <処理内容> の動作を確認済みです。<結果の要点を1行>。

■ 補足
・制作にはAIを活用しております。ご不明点や想定と違う動きがあれば、修正<2>回まで無料で対応します。
・<APIを使う場合> ChatGPTのAPIキーはお客様ご自身のものをご登録ください（当方はお預かりしません）。

ご確認のうえ、問題なければ「承認」いただけますと幸いです。追加のご要望もお気軽にどうぞ。
```

## Delivery checklist before posting
- [ ] Files attached: script + 手順書 (PDF or text)
- [ ] `ACCEPTANCE_CHECK.md` all green
- [ ] No PII anywhere in the files
- [ ] Price/deadline match the intake
- [ ] After buyer confirms payment → `ops.mjs revenue ... --evidence "<coconala order id>"`
