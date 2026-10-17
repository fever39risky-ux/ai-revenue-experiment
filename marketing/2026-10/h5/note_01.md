<!--
H5 note free article #1 — draft by founder 2026-10-18 (JST). Publish: mac-local (note @satotsu1020), task h5-ec-csv-tool-note-1018.
Motion: H5 (productized self-serve + content-led demand for EC sellers). The free browser tool is the demo that sells.
Honesty (Constitution Art.10/12): AI-assisted production is stated; no over-promise; tool processes files in-browser only.
Links: tool https://fever39risky-ux.github.io/ai-revenue-experiment/tools/order-csv-converter-jp.html
       guide https://fever39risky-ux.github.io/ai-revenue-experiment/guides/order-csv-shipping-label-convert.html
Note has no tables → render the before/after table as a list when publishing. Suggested tags: #ネットショップ #EC #BASE #業務効率化 #無料ツール
On publish: log `event founder signal qualified_reach --note "note h5-01 URL"` + `event mac-local done h5-ec-csv-tool-note-1018 --note "<URL>"`.
-->

# BASE・STORES・メルカリShopsの注文CSVを、送り状用に一発整形する無料ツールを作りました（登録不要・ブラウザ内処理）

## 毎回の発送、この手作業に時間取られていませんか

ネットショップで注文が入るたびに、注文CSVを開いて——

- いらない列を消して、送り状サービスの並び順に入れ替える
- 郵便番号「１５００００１」や電話番号の**全角を半角に直す**
- 姓と名をつないで、宛名に「様」を付ける
- 郵便番号のハイフンを付けたり外したり

発送のたびのこの整形、1件なら数十秒でも、件数が増えると地味に効いてきます。しかも、手でやると**打ち間違い**も混ざります。宛先の打ち間違いは、再送・お詫び・レビュー低下に直結する、いちばん避けたいミスです。

> ※ この記事と下記ツールはAIを活用して制作しています。過度な効果をうたうものではありません。整形結果は必ずご自身でご確認のうえご利用ください。

---

## 作ったもの：注文CSV → 送り状CSV 変換ツール（無料）

👉 **[注文CSV→送り状CSV 変換ツール（無料・登録不要）](https://fever39risky-ux.github.io/ai-revenue-experiment/tools/order-csv-converter-jp.html)**

やることは3ステップだけです。

1. カート管理画面から**注文データをCSVで書き出す**（ヘッダー行のあるCSVならOK）
2. ツールにCSVを読み込み、**どの列が郵便番号・氏名・住所・電話番号か**を指定（列名が一般的なら自動で割り当てを試みます）
3. 全角→半角・姓名の結合・「様」付与・ハイフンの有無・列の並べ替えを指定して、**送り状用CSVとして書き出す**。プレビューで中身を確認してからダウンロードできます

### いちばん大事なこと：ファイルはどこにも送信しません

CSVの読み込みも変換も、**すべてお使いのブラウザの中だけ**で行います。注文データや個人情報がサーバーに送られることはなく、ページを閉じれば何も残りません。登録もインストールも不要です。Shift_JIS（Excelや一部カートの書き出し）とUTF-8のどちらのCSVも自動で読み分けます。

---

## 変換の例（Before → After）

- 郵便番号：`１５００００１`（全角）→ **`150-0001`**
- 氏名：姓「山田」／名「太郎」が別列 → **`山田 太郎 様`**
- 電話番号：`０９０１２３４５６７８`（全角）→ **`09012345678`**
- 列の順番：注文日・決済・氏名・住所… → **郵便番号・氏名・住所・電話…**

ツールには**サンプルで試す**ボタンもあるので、手元のCSVがなくても動きを確認できます。使い方の詳しい手順は[こちらのガイド](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/order-csv-shipping-label-convert.html)にまとめています。

※ 送り状サービス（クリックポスト／ヤマトB2 など）の取込フォーマットは各社で異なり、変更されることもあります。参考プリセットは用意していますが、取り込む前に必ずご利用のサービスの仕様で列名と順番をご確認ください。本ツールは整形を助けるもので、各社フォーマットへの適合を保証するものではありません。

---

## 「自分のショップ専用に設定してほしい」方へ（先着は無料）

上のツールは「自分で列を選んで整形する」汎用版です。もし、

> 自分のカート（BASE/STORES/メルカリShops）と、使っている送り状サービスの**組み合わせ専用**に、列マッピングや、Google スプレッドシート＋GASでのワンクリック変換まで設定してほしい

という方がいれば、ご相談を受け付けています。**実績づくりのため、先着数名は無料でセットアップ**します（制作はAIを活用して行います。過不足なくお作りできる範囲でお受けします）。

使っているカートと送り状サービスを、**X（旧Twitter） [@KinoshitaTsks](https://x.com/KinoshitaTsks) のリプライ・DM**で教えてください。日本円での購入・相談は[ココナラ](https://coconala.com/services/4426150)でも受け付けています。

---

この無料ツールは「AIに会社を任せる実験」の一環として公開しています。実験の記録（日々の売上・判断・失敗）は [X @KinoshitaTsks](https://x.com/KinoshitaTsks) と[実験トップページ](https://fever39risky-ux.github.io/ai-revenue-experiment/)で公開しています。もしこのツールが役に立ったら、ひとことリプライいただけると今後の改善の励みになります。
