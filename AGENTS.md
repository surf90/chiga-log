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

## 英語表示（おまけ）の扱い

- **日本語版が本体、英語表示はおまけ**。いつ削除してもよい補助機能として扱い、日本語版の速度・保守・表示を一切犠牲にしない。迷ったら日本語版を優先し、英語側は諦める（日本語のまま残る／隠す）。
- 構成: フッターの `#lang-toggle` ＋ `app.js` 末尾のローダー ＋ `assets/js/en.js`（英語選択時のみ遅延読込。`sw.js` の事前キャッシュにも入れない）。`app.js` の文言を英語対応のために変えない（`t()` 化・属性追加をしない）。
- 機能追加・文言変更時: en.js の辞書追従は**任意**（漏れても英語表示で日本語のまま出るだけ）。ただし `app.js` が表示文言を判定に使っている箇所（例: `#current-time` の「更新中」）は en.js で訳さないこと。
- 気象庁の自由文（天気文・概況）は英語表示で隠す。警報・津波は隠さない（訳せない名称は日本語のまま）。
- 削除手順: `#lang-toggle`（index.html）・app.js の「英語表示（おまけ）」ブロック・`.lang-toggle`（style.css）・`assets/js/en.js`・`eslint.config.js`/`frontend-ci.yml` の en.js 指定を消す。
- 新しい JS/CSS に依存する HTML 変更（要素追加など）では `index.html`・`404.html` の `?v=` と `sw.js` の `ASSETS`・`CACHE_NAME` を上げる（SW の Stale-While-Revalidate で「新 HTML＋旧 JS」になり、追加ボタンが無反応になる。2026-10-15 英語切替で発生）。

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
| `frontend-ci.yml`            | ESLint/Prettier + Worker試験/SRI検証 + pa11y  | push/PR                  |

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
