---
updated: 2026-06-03
---

# ちがログ 進捗メモ

> 役割: セッション完了ログ / 簡易 changelog（内部メモ、サイト非公開）。各セッション末に最新の完了項目を追記する（CLAUDE.md「トークン節約」参照）。

## 完了済み（2026-06-03）

### 警報・注意報の取得をBFF化（bosai更新停止対策） (PR #92→#93→#94 → main マージ)

- **背景**: 茅ヶ崎で発令中でもカードが「✅ なし」表示になる不具合。調査の結果、JMA bosai の警報JSON（`warning/140000.json`）が**神奈川県で更新停止**（forecast は最新なのに warning だけ凍結）。最新データは `data.jma.go.jp` のレガシーフィード（`VPWS50/JPTF`）にのみ存在。
- **制約**: レガシーフィードは CORS 非対応 → ブラウザ直 fetch 不可。
- **対応**: BFF化。GitHub Actions 側で取得し同一オリジンJSONへ書き出し。
  - `scripts/fetch_warning.py`（新規）：`VPWS50/JPTF_jp.json` の `itemArea4` から茅ヶ崎（`1420700`）を抽出し `data/warning_chigasaki.json` へ出力。取得失敗時は既存ファイルを温存（誤って空にしない＝三原則1）。
  - `.github/workflows/fetch_openmeteo.yml`：警報取得ステップ＋`git add` 追加。**既存30分cronに相乗り（新規cron追加なし）**。
  - `assets/js/app.js`：`fetchJmaWarning()` を同一オリジンJSON読み込みに全面置換。レベル判定を名称ベース化（レベル4「危険警報」にも対応）。`WARNING_CODE_MAP` 撤去。
  - `sw.js`：`CACHE_NAME` `'chigalog-v4'` → `'chigalog-v5'`（更新JS配信）。
- 経緯メモ：#92（cache-buster＋TTL短縮）, #93（東部140010併合）は bosai が空データだったため無効と判明。真因特定後 #94 で BFF へ切替し解決。

**関連ファイル**
- `scripts/fetch_warning.py`（新規）
- `assets/js/app.js` / `app.min.js`
- `.github/workflows/fetch_openmeteo.yml`
- `sw.js`
- `data/warning_chigasaki.json`（Actions 自動生成 / 初期データ同梱）

---

## 完了済み（2026-05-07）

### 風予報カード統合 (PR #87 → main マージ)

- `scripts/fetch_openmeteo.py`：`WIND_FORECAST_URL` 追加、`wind_forecast.json` 出力
- `assets/js/app.js`：`renderWindForecast` / `toggleWindForecast` / `fetchWindForecast` 関数追加
- `index.html`：`wind-forecast-box` セクションを `jma-forecast-box` 直下に追加
- `assets/css/style.css`：`.wind-grid/.wind-row/.wind-time/.wind-dir/.wind-speed` スタイル追加
- `.github/workflows/fetch_openmeteo.yml`：`data/wind_forecast.json` を `git add` 対象に追加

**関連ファイル**
- `scripts/fetch_openmeteo.py`
- `assets/js/app.js` / `app.min.js`
- `assets/css/style.css` / `style.min.css`
- `index.html`
- `.github/workflows/fetch_openmeteo.yml`
- `data/wind_forecast.json`（Actions 自動生成）

---

### Service Worker `Response.clone()` 二重消費バグ修正 (PR #88)

- `sw.js`：`res.clone()` を `caches.open()` Promise の外（同期タイミング）で実行するよう修正
- `CACHE_NAME`：`'chigalog-v2'` → `'chigalog-v3'` にバンプし旧 SW を強制更新

**関連ファイル**
- `sw.js`

---

## 完了済み（2026-04-30）

### PWA化（ホーム画面アプリ対応）

- `site.webmanifest` 更新：ちがログ用の名前・テーマカラー・start_url設定
- `index.html`：マニフェストリンク・iOS用メタタグ・Service Worker登録スクリプト追加
- `sw.js` 新規作成：同一オリジンのみNetwork First、外部APIは素通し
- `app.js`：`visibilitychange`（10分超→自動fetch、3分超→トースト）＋ `pageshow`（bfcache復帰→強制fetch）追加

**関連ファイル**
- `site.webmanifest`
- `index.html`
- `sw.js`
- `assets/js/app.js` / `app.min.js`

---

## 完了済み（2026-04-21）

### 潮汐・波グラフ 横スクロール同期

- `tide_2day.json`（当日+翌日）を `extract_daily_data.py` で生成
- 両グラフを `type: linear` + msタイムスタンプのx軸に変更
- x軸始点：当日最初の干満潮時刻（`chartXMin`）で両グラフ統一
- 幅：`PX_PER_HOUR(28) × 24h × 2日 = 1344px` に縮小（旧: 1920px）
- 翌日0:00のx軸ラベルに日付（M/D 0:00）を表示
- `syncChartScroll()` でスクロール位置同期
- `scrollChartsToNow()` で初期表示を現在時刻付近に設定
- 波グラフの縦スクロール防止：`overflow-y:hidden`
- 潮汐テキスト表示（数値）は当日分のみ維持

**関連ファイル**
- `assets/js/app.js`
- `index.html`
- `scripts/extract_daily_data.py`
- `data/tide_2day.json`
