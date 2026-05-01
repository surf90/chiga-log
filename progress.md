---
updated: 2026-05-01
---

# ちがログ 進捗メモ

## 完了済み（2026-05-01）

### 波グラフ Y軸固定スクロール

- `index.html`：`#wave-chart-scroll` を `#wave-chart-wrapper`（`position:relative`）で囲み、左右に `#waveChartLeftAxis` / `#waveChartRightAxis` のダミーCanvasを追加
- `assets/css/style.css`：`.fixed-axis` / `.left-axis` / `.right-axis` を追加（`position:absolute` で wrapper 上に重ねて固定、`background:var(--box-bg)` で背後のグラフ線を遮蔽）
- `assets/js/app.js`：`drawWaveCombinedChart` 末尾にダミーグラフ生成ロジックを追加。メイングラフの確定済み `min/max` を取得して目盛りを完全同期。`_updateChartsTheme` にダミー軸の色更新を追加

**関連ファイル**
- `index.html`
- `assets/css/style.css`
- `assets/js/app.js`

---

### BFF化：外部API通信をGitHub Actions側へ移管

- `scripts/fetch_openmeteo.py` 新規作成：Open-Meteo（天気）＋Marine API（海面）を取得し `data/weather_marine.json` を生成
- `scripts/extract_daily_data.py` 改修：気象庁データ欠損時のStormglassフォールバック追加、月齢を統合した `data/tide_widget.json` を出力
- `assets/js/app.js`：Open-Meteoの直接フェッチを廃止→静的JSON読み込みに変更、潮汐の3段フォールバックを廃止→`tide_widget.json`の1フェッチに簡略化
- `fetchWeatherData(isManual)` 引数追加：手動タップ時のみ`smoothTop()`発火、定期実行時はスクロール位置をキープ
- `syncChartScroll()` に `{ passive: true }` を追加
- `.github/workflows/fetch_openmeteo.yml` 新規作成：30分ごとに自動実行

### 警報フローティングアラートバー

- 気象庁から警報・特別警報発令時、画面下部に固定表示される警告バーを追加
- 警報（赤 `#c0392b`）・特別警報（紫 `#7c3aed`）で色分け、注意報のみ・解除時は非表示
- モバイルのホームバーと重ならないよう `env(safe-area-inset-bottom)` で対応
- `z-index: 10000`（トースト9999より前面）

**関連ファイル**
- `scripts/fetch_openmeteo.py`（新規）
- `scripts/extract_daily_data.py`
- `assets/js/app.js`
- `assets/css/style.css`
- `index.html`
- `.github/workflows/fetch_openmeteo.yml`（新規）
- `data/weather_marine.json`（新規・自動生成）
- `data/tide_widget.json`（新規・自動生成）

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
