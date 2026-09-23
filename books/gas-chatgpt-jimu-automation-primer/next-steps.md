---
title: "次の一歩：具体的な自動化レシピ"
---

ここまでで、どの自動化にも使う土台（キー管理・`askAI()`・JSON検証・6分制限対策・安全設計・費用見積もり）がそろいました。あとは「何を自動化するか」です。すべてコピペで動くコード付きで公開しています。

## 無料の記事

- [スプレッドシートのAI一括処理と、毎朝の自動要約メール](https://zenn.dev/kinoshita_ai/articles/gas-chatgpt-batch-summary-mail)
- [Gmailの問い合わせメールを自動仕分けして、AIが下書き返信を作る](https://zenn.dev/kinoshita_ai/articles/gas-chatgpt-gmail-inquiry-auto-reply)
- [請求書PDFを自動作成し、AIが添え状を書いた下書きメールまで用意する](https://zenn.dev/kinoshita_ai/articles/gas-invoice-pdf-ai-email)
- [ChatGPTに事実をでっち上げさせない「制約プロンプト」の型](https://zenn.dev/kinoshita_ai/articles/chatgpt-jimu-anti-hallucination-prompt)

事務作業向けのコピペ用プロンプト集も無料で置いています → [ChatGPTで事務仕事を時短する実務プロンプト（無料・日本語）](https://fever39risky-ux.github.io/ai-revenue-experiment/guides/chatgpt-jimu-jitan-prompt.html?ref=zenn-book)

## そのまま使える形にまとめたもの（有料）

自分で組み立てる時間を省きたい方向けです。

- **Gmail問い合わせAI下書き返信・GAS拡張版（$3）**：FAQ参照（登録した事実以外はAIに断定させない）、noreply等の除外、お試しモード付き → [Gumroad](https://feverish50.gumroad.com/l/koujr)
- **請求書PDF＋AI添え状メール下書き・GAS拡張版（$3）**：10%・8%の税率区分ごとの消費税、源泉徴収、請求書の通し番号、お試しモード付き → [Gumroad](https://feverish50.gumroad.com/l/ihdjg)
- **Googleフォーム問い合わせAI仕分け＆担当者通知・GAS拡張版（$3）**：設定シート、個人情報マスク、放置リマインド、日次まとめ付き → [Gumroad](https://feverish50.gumroad.com/l/hesoh)
- **スプレッドシート =AI() 関数・GAS拡張版（$3）**：分類・抽出・翻訳関数、数百行の一括処理（続きから再開）、月の予算上限付き → [Gumroad](https://feverish50.gumroad.com/l/ymotl)
- **そのまま動くGAS5本＋日本語導入ガイド【PRO】（$39）**：一括処理・毎朝の要約・Gmail問い合わせ仕分け・請求書PDF＋添え状・議事録要約の5本と、APIキー取得からつまずき対処までの導入ガイド → [Gumroad](https://feverish50.gumroad.com/l/jqxenl)

どれも、この本で解説した設計（下書き止まり・DRY_RUN・再実行しても二重処理しない）に沿って作っています。
