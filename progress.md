---
updated: 2026-06-11
---

# ちがログ 進捗メモ

> 役割: セッション完了ログ / 簡易 changelog（内部メモ、サイト非公開）。各セッション末に最新の完了項目を追記する（CLAUDE.md「トークン節約」参照）。

## 完了済み（2026-06-11）

### 地点設定を `_data/site.json` に一元化（フォーク対応） (PR #103 → main マージ)

- **目的**: 別の海岸へフォークしやすくする。茅ヶ崎固有の値（緯度経度・JMA各種コード・地名）が JS/Python/HTML の15箇所以上に散在していたため、単一ソースに集約。
- **仕組み**: `_data/site.json`（Jekyll データフォルダ）を3者が参照。
  - JS: Jekyll が `assets/js/site-config.js` に `window.SITE_CONFIG` を展開（インラインは CSP `script-src 'self'` で遮断されるため**外部JS**として供給）。
  - Python: `scripts/_common.py` に `load_site_config()`（CWD非依存）を追加し各スクリプトが参照。
  - HTML: `{{ site.data.site.* }}` で title/OGP/JSON-LD/JMAリンクを展開。
- **安全策**: 全消費側に**現行リテラルへのフォールバック**（`.get(k,既定)` / `?? 既定`）。設定読込・Jekyll展開が失敗しても本家挙動は不変。値そのものは変更せず（座標の不一致も別フィールドで現状維持）。
- `.github/workflows/dl_wave-guid.yml`：波浪エリア変更に追従するよう `git add data/wave_guid_*.json` にグロブ化。
- `FORK.md`（新規）：フォーク手順書（各フィールドの意味・JMAコードの調べ方）。
- 検証: pytest 35件通過 / Jekyll描画シミュレートで元と完全一致 / minify後もフォールバック保持。

**関連ファイル**
- `_data/site.json`（新規）/ `assets/js/site-config.js`（新規）/ `FORK.md`（新規）
- `index.html` / `assets/js/app.js`・`app.min.js`
- `scripts/_common.py` ほか fetch/generate 系7本
- `_config.yml` / `.github/workflows/dl_wave-guid.yml`

---

### 参照数値の再検証＋アメダス取得元修正（海老名→辻堂） (PR #104 → main マージ)

- **背景**: `_data/site.json` の全参照値を気象庁の権威データ（area.json / amedastable.json / 津波予報区データセット / 潮位表）と突き合わせて再検証。
- **発見した誤り**: 観測値取得用 `amedas_code=46091` は実は**海老名（海老名市・内陸）**。コードのコメントが意図する「辻堂」でも、UIリンク（`amedas_link_no=46141`）とも不一致だった（番号の取り違え）。
- **修正**: `amedas_code` を **46141（辻堂・海岸）** へ。amedastable の `elems` 上も辻堂は同要素（気温・湿度・風・降水）を観測。ライブ取得で全4要素配信（temp/humidity/wind/precip）を確認＝データ欠落なし。
  - `scripts/fetch_openmeteo.py`：フォールバック既定値とコメントを 46141 に修正。
  - `scripts/generate_tide.py`：コメント「D8 = 江の島」→「D8 = 湘南港」（D8の正式名に修正）。
  - `README.md` / `FORK.md`：アメダス番号・潮汐観測所名を実態に合わせて更新。
- **その他の値は全て正しいことを確認**: forecast 140000(神奈川県) / area 140010(東部) / 警報 1420700(茅ヶ崎市)・JPTF / 潮汐 D8(湘南港) / 波浪 20・19 / 津波 330(相模湾・三浦半島) / 座標 35.3175,139.4151。

**関連ファイル**
- `_data/site.json` / `scripts/fetch_openmeteo.py` / `scripts/generate_tide.py`
- `README.md` / `FORK.md`

---

## 完了済み（2026-06-08）

### 津波注意報・警報カード追加（相模湾・三浦半島） (main マージ)

- **目的**: 相模湾・三浦半島に津波注意報/警報が発表中の時だけ、ページ最上部に専用カードを表示。デザインは既存「注意報・警報」カードに準拠。
- **データ源**: 気象庁 bosai 津波フィード（一覧 `bosai/tsunami/data/list.json` → 詳細JSON）。予報区「相模湾・三浦半島」= `Area.Code 330`。`Category.Kind.Code` で 大津波警報(52)/津波警報(53)/津波注意報(62) のみ表示、津波予報(71)・不在・解除は非表示。
- **方針**: bosai は **CORS対応**のためクライアント直接fetch（警報VPWS50と異なりBFF不要・**Actions/cron追加なし**＝三原則3）。1分キャッシュバスター。
- **実装**:
  - `index.html`：`#weather-content` 先頭に `#tsunami-box`（初期 `hidden`）を追加。気象庁HPリンク・注釈文埋め込み。
  - `assets/js/app.js`：`fetchTsunami()` 追加、`fetchWeatherData` の `Promise.allSettled` に登録。
  - `assets/css/style.css`：`.badge-tsunami-major/warn/adv`（紫/赤/橙）追加。`.warning-active` 流用。
  - `DESIGN.md`：津波カード配色・バッジ仕様を追記。
- **不具合修正（マージ後）**: カード非表示の原因は `index.html` の CSP `connect-src 'self'` が JMA へのクロスオリジンfetchをブロックしていたため。`connect-src 'self' https://www.jma.go.jp` に変更して解消。
- `sw.js`：`CACHE_NAME` `'chigalog-v6'` → `'chigalog-v7'`。

**関連ファイル**
- `index.html`
- `assets/js/app.js` / `app.min.js`
- `assets/css/style.css` / `style.min.css`
- `DESIGN.md`
- `sw.js`

---

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
