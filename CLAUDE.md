# 静的サイトプロジェクト (GitHub Pages, ちがログ)

## 三原則

1. **確かなソース**: 気象庁を一次優先。Open-Meteo/Stormglass/NASA は補助。取得失敗時はUI上で明示し、ダミー値で誤読を誘発しない。
2. **高速表示**: JSライブラリ原則不使用。例外は Chart.js のみ（自ホストUMDビルド `assets/vendor/chart.umd.min.js`）。フォントは可変フォント+サブセットで最小化。
3. **API/Actions 節約**: fetch は sessionStorage/localStorage キャッシュ経由。GitHub Actions cron は既存頻度維持、追加禁止。軽微Pushでの再ビルド禁止。

## 実行コマンド（PowerShell / win32）

- プレビュー:
  - 忠実: `bundle exec jekyll serve`（`baseurl`/Liquid を解決。要 Gemfile 追加）
  - 簡易（生HTMLのみ）: `python -m http.server 8000`（`{{ site.baseurl }}` 未解決＝アセット/Chart.js は読めない）
- 整形: `npx prettier --write .`
- minify: `assets/css/style.css` / `assets/js/app.js` を編集して push すると `minify.yml` が自動生成（ローカル実行不要）。
- 容量確認: `Get-ChildItem -Recurse -File | Where-Object FullName -notmatch '\\(\.git|\.claude)\\' | Measure-Object Length -Sum`
- テスト: `pytest tests`（任意。`pip install -r scripts/requirements.txt`）

## コーディング規約

- HTML: セマンティック。インライン `style` / `onclick` は最小化。
- CSS: 変数+ダークモード対応を維持。未使用セレクタは削除。
- JS: 標準API優先。外部依存の追加は要相談。
- 画像: 追加前に WebP/最適化必須。
- UI（色・フォント・余白・角丸）変更時は `DESIGN.md`（実CSS準拠の仕様書）に従い、変更後は同ファイルも追従更新。

## キャッシュ戦略（API節約の要）

- 当日変動データ（潮汐・波・天気）: sessionStorage 30分TTL
- 日次データ（月齢・潮汐表）: 日付キー方式
- Service Worker: `sw.js` でアセットキャッシュ

## セキュリティ

- 機密情報（APIキー・.env）のコミット厳禁。
- ソース以外（`scripts/`・各md・`reports/`）は `_config.yml` の `exclude:` でビルド除外。

## GitHub Actions（`.github/workflows/`）

| ファイル                     | 役割                                          | cron (UTC)               |
| ---------------------------- | --------------------------------------------- | ------------------------ |
| `fetch-openmeteo.yml`        | Open-Meteo（海面・風）＋警報BFF（主力）       | `*/30 * * * *`           |
| `fetch-heatstroke-alert.yml` | 環境省 熱中症警戒情報（発表前の遅延対策取得） | `35,45,55 19,4,7 * * *`  |
| `fetch-forecast.yml`         | 気象庁 天気予報                               | `5 20,2,8 * * *`         |
| `fetch-wave-guidance.yml`    | 気象庁 波浪ガイダンス                         | `5 0,6,12 * * *`         |
| `update-daily-data.yml`      | 日次（月齢・潮汐抽出）                        | `5 15 * * *`             |
| `update-jma-tide.yml`        | 気象庁 年次潮汐                               | 年3回（12/20・1/1・7/1） |
| `minify.yml`                 | CSS/JS minify                                 | push トリガ              |
| `test.yml`                   | Python ユニットテスト                         | push/PR                  |
| `frontend-ci.yml`            | ESLint/Prettier + pa11y (WCAG2AA)             | push/PR                  |

- データ品質は気象庁を一次優先（原則1）、更新頻度は Open-Meteo が主力（`fetch-openmeteo.yml`）。
- cron 追加・頻度変更は要相談（三原則3: API/Actions 節約）。
- cron は指定どおりには起動しない。`*/30` の実効間隔は約50分・最大93分まで伸びる
  （2026-08 実測: 8.5時間で期待17回に対し実績11回）。`app.js` の `FRESHNESS`
  閾値はこの遅延を織り込んで設定しており、cron 頻度そのままで詰めないこと。
- 軽微修正は複数まとめて1コミットに集約。

## トークン節約

- 応答は簡潔・名詞句優先（グローバル Concise Output に準拠）。
- 大規模変更は計画モード。
- セッション末に `progress.md` 更新（`/clear` はユーザー操作）。
