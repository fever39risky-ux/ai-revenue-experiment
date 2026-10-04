# 日刊AIニュース画像添付 — ローカル実装、実通信なし

Base: 48564ef（日刊3枠guard反映済み、C2投入前）の隔離worktree。
現在remoteにあるC2キュー・成功履歴には読書きせず、既存workflow/認証/
Secret/OAuth/他事業台帳も変更していない。push/dispatch/X API/uploadは0回。
Weeklyのnative Articleとは別の通常POST /2/tweets対応。

## 追加動作

AIニュースqueueにimage指定がある場合だけ、Git HEADに保存された画像バイナリと
upload receiptを読み、QA/hash/media ID/media key/本人owner/HTTP200/期限/料金確認を
検査。通過した場合のみPOSTへ `media: {media_ids:[id]}` を追加する。
画像uploadは一切実装・呼出ししない。raw queue.media/media_idsは従来どおり拒否。
image_required:trueで画像がない場合、検査不合格、未確定費用、期限切れ、未commit
証跡では0 POSTで停止。本文のみ代替、追投稿、編集、削除、再uploadは行わない。

確認GETは既存の1回に `tweet.fields` のattachmentsだけを追加する。
画像の場合だけownerとattachments.media_keysが期待する1枚に一致するか検査。
不一致/GET失敗はpartial failureで終了し、再POSTしない。追加GET/expansionなし。
成功時の履歴/TOPLEVEL_RESULTにimage hash/media ID/key/receiptを含むHEAD commit/
attachment_verifiedを保存。実際の画像の見た目はAPI key照合だけでは保証しない。

## 入力契約（実データ未投入）

既存の日刊queue必須項目へ追加：

```json
{
  "image_required": true,
  "image": {
    "sha256": "実画像bytesの64hex SHA256",
    "media_id": "取得済みの数値文字列",
    "receipt_sha256": "JSON.stringify(parsedReceipt)のUTF8 SHA256",
    "post_cost": {
      "all_in_known": true,
      "max_usd": 0.3,
      "evidence": "実際の画像付きURL投稿＋確認GET料金根拠（0.3は形式例で料金ではない）"
    }
  }
}
```

既存workflowはshallow checkoutのため過去commitを追加fetchしない。
以下2ファイルを実行対象HEADへ事前commit/push・remote確認しておく：

- `social/ai-news/media/<image-sha256>.bin`：QAした実画像そのもの
- `social/ai-news/media/<image-sha256>.json`：下記upload成功receipt

receipt形式：version=1、outcome=uploaded_confirmed、http_status=200、
image_sha256、media_id、media_key（tweet_imageの3_<id>）、bytes、
media_category=tweet_image、owner_id=1982353950843256832、workflow_run_id数値文字列、
uploaded_at、expires_at、expires_after_secs、cost {all_in_known:true,evidence}、
qa {status:pass,image_sha256,evidence,checked_at}。

receipt hashは生JSONファイルの改行hashではなく、parse後JSON.stringifyのhash。
バイナリhashは実ファイルbytes。空画像・内部5MiB上限超は拒否。
有効期限はupload時刻＋API expiry秒数を超えないこと。未来時刻のupload/QAを拒否。
実行時点で残り120秒以下も停止する（内部安全余裕でありXの規定ではない）。

親が実APIレスポンス/実認証アカウント/QAの根拠からreceiptを作成・検証すること。
JSONのpass/confirmedフラグだけで真実性や料金を証明するものではない。
画像データをリポジトリに転送する際は公開可能な素材だけに限定する。
不明なmedia ID・期限・料金・証跡を作らない。実素材はまだ受領していない。

## 保持した動作と限界

従来他事業の1日guard・AIニュース3枠・本文270上限・返信禁止は保持。
元から明示承認済みのtext-onlyキューはそのままtext-only。画像指定が失敗した
ためtext-onlyへ切り替える分岐は存在しない。

同一実行内の再送なしはmock確認済み。ただし元publisherはrunner内だけで履歴更新と
queue削除を行う。fresh runnerの再dispatchまでこの拡張だけで防げるとは主張しない。
親のdurable intent、単一担当実行、結果/消費queueの永続化が必要。POST成功後GET失敗
または応答不明でも再dispatchしない。今回その本番cleanupには一切触れていない。

## 検証・残条件

`node --test tests/test_ai_news_slots.mjs tests/test_ai_news_media.mjs`：56件。
31既存枠テスト、25画像テスト。画像成功1POST+1GET・正しいmedia_ids、失敗時0POST、
不明POST時1POSTのみ、GET添付不一致で追加POSTなし、270上限、期限/QA/hash/owner/
media ID/証跡/料金/未commit拒否を検証。Git fixtureは一時ディレクトリ内だけ。

実行前には実画像転送とQA、別段階uploadの料金確定・実行許可・成功receiptの永続化、
画像付き投稿/URL/確認GET総費用と月3000円台帳余力、レビュー済みコードの反映が必要。
既存4X認証だけを利用し、新権限・新サービスは不要。今回の実装/テストでX有料API呼出しは0回。
