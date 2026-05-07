# 静的サイトプロジェクト (GitHub Pages, ちがログ)

## 三原則
1. **確かなソース**: 気象庁を一次優先。Open-Meteo/Stormglass/NASA は補助。取得失敗時はUI上で明示し、ダミー値で誤読を誘発しない。
2. **高速表示**: JSライブラリ原則不使用。例外は Chart.js のみ（自ホスト軽量Build）。フォントは可変フォント+サブセットで最小化。
3. **API/Actions 節約**: fetch は sessionStorage/localStorage キャッシュ経由。GitHub Actions cron は既存頻度維持、追加禁止。軽微Pushでの再ビルド禁止。

## 実行コマンド
- プレビュー: `python -m http.server 8000`
- 整形: `npx prettier --write .`
- 容量確認: `du -sh ./*`

## コーディング規約
- HTML: セマンティック。インライン `style` / `onclick` は最小化。
- CSS: 変数+ダークモード対応を維持。未使用セレクタは削除。
- JS: 標準API優先。外部依存の追加は要相談。
- 画像: 追加前に WebP/最適化必須。

## キャッシュ戦略（API節約の要）
- 当日変動データ（潮汐・波・天気）: sessionStorage 30分TTL
- 日次データ（月齢・潮汐表）: 日付キー方式
- Service Worker: `sw.js` でアセットキャッシュ

## セキュリティ
- 機密情報（APIキー・.env）のコミット厳禁。
- `.claudeignore` でソース以外を除外。

## GitHub Actions
- 既存ワークフロー: `update-jma-tide.yml`, `update-tide-data.yml`
- 追加・頻度変更は要相談。
- 軽微修正は複数まとめて1コミットに集約。

## トークン節約
- 応答は原始人スタイル（簡潔・名詞句優先）。
- 大規模変更は計画モード。
- セッション末で `progress.md` 更新後 `/clear`。
