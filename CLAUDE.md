# 静的サイトプロジェクト (GitHub Pages, ちがログ)

## 三原則
1. **確かなソース**: 気象庁を一次優先。Open-Meteo/Stormglass/NASA は補助。取得失敗時はUI上で明示し、ダミー値で誤読を誘発しない。
2. **高速表示**: JSライブラリ原則不使用。例外は Chart.js のみ（自ホスト軽量Build）。フォントは可変フォント+サブセットで最小化。
3. **API/Actions 節約**: fetch は sessionStorage/localStorage キャッシュ経由。GitHub Actions cron は既存頻度維持、追加禁止。軽微Pushでの再ビルド禁止。

## 実行コマンド（PowerShell / win32）
- プレビュー: `python -m http.server 8000`
- 整形: `npx prettier --write .`
- minify 再生成（`app.js`/`style.css` 編集後）:
  - `npx --yes terser assets/js/app.js -c -m -o assets/js/app.min.js`
  - `npx --yes clean-css-cli -o assets/css/style.min.css assets/css/style.css`
- 容量確認: `Get-ChildItem -Recurse -File | Measure-Object Length -Sum`
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
- `.claudeignore` でソース以外を除外。

## GitHub Actions（`.github/workflows/`）
| ファイル | 役割 | cron (UTC) |
|---|---|---|
| `fetch_openmeteo.yml` | Open-Meteo（海面・風）＋警報BFF（主力） | `*/30 * * * *` |
| `fetch_forecast.yml` | 気象庁 天気予報 | `5 20,2,8 * * *` |
| `dl_wave-guid.yml` | 気象庁 波浪ガイダンス | `5 0,6,12 * * *` |
| `update-tide-data.yml` | 潮汐データ更新 | `5 15 * * *` |
| `update-daily-data.yml` | 日次（月齢・潮汐抽出） | `5 15 * * *` |
| `update-jma-tide.yml` | 気象庁 年次潮汐 | 年2回（1/1・7/1） |
| `minify.yml` | CSS/JS minify | push トリガ |
| `test.yml` | Python ユニットテスト | push/PR |

- cron 追加・頻度変更は要相談（三原則3: API/Actions 節約）。
- 軽微修正は複数まとめて1コミットに集約。

## トークン節約
- 応答は原始人スタイル（簡潔・名詞句優先）。
- 大規模変更は計画モード。
- セッション末で `progress.md` 更新後 `/clear`。
