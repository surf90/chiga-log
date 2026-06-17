---
updated: 2026-06-17
---

# ちがログ 進捗メモ

> 役割: セッション完了ログ / 簡易 changelog（内部メモ、サイト非公開）。各セッション末に最新の完了項目を追記する（CLAUDE.md「トークン節約」参照）。

## 完了済み（2026-06-17）

### SEO再検証: JSON-LD 強化・表記ゆれ対策（main マージ）

- **背景**: SEO観点での再検証。メタ/OGP/ファビコン/PWA/robots/sitemap は高品質な一方、構造化データ（JSON-LD）に評価上有効なフィールドが欠落していた。可視UI・本文は変更せず `<head>` と `_config.yml` のメタ/JSON-LDのみ強化（本文がJSレンダリング依存のため可視テキスト拡充はユーザー選択で見送り）。
- **JSON-LD 強化** (`index.html`): `@graph` に **Person ノード（著者）** を新設し WebSite/WebPage/WebApplication から `author`/`publisher` を `@id` 参照。WebPage に `image`/`primaryImageOfPage`/`datePublished`(2026-04-13・初コミット日)/`dateModified`(`site.time` で自動更新) を追加。about の Place に `PostalAddress`（神奈川県/茅ヶ崎市）を追加。WebApplication に `image`/`inLanguage` 追加＋インデント整形。
- **表記ゆれ対策**: WebSite・WebApplication に `alternateName` 配列（ちがろぐ/チガログ/ちがろぐ茅ヶ崎/Chiga Log/ChigaLog/chigalog）を追加。Google のエンティティ理解にブランド別表記を宣言（不可視・低リスク。順位反映は再クロール後に漸進）。
- **Twitter Card 補完**: `twitter:image:alt` 追加（og:image:alt と対）。
- **`_config.yml` 補完**: `author` / `timezone: Asia/Tokyo`（`date_to_xmlschema` のJST出力）/ `future: false` を追加。
- **見送り（記録）**: 可視テキスト/FAQ追加・`meta keywords`（Google無視）・CSP `unsafe-inline` 除去（セキュリティ別件）・RSS導入。
- **検証**: Python で ld+json 抽出→Liquid擬似展開→`json.loads` 成功・未解決変数ゼロを確認（bundler未導入のため実Jekyllビルド検証は未実施＝要・公開前確認）。

**関連ファイル**
- `index.html`（head限定）/ `_config.yml`

---

## 完了済み（2026-06-12）

### SEO検証と改善（404ページ追加・デッドGA設定削除）

- **背景**: SEO観点での全面検証。title/description/OGP/Twitter Card/canonical/JSON-LD(@graph 3種+GeoCoordinates)/robots.txt/jekyll-sitemap/PWAマニフェスト/h1構造/Search Console 検証ファイルはすべて良好（評価B+）。不足は2点のみ。
- **404.html 新規作成**: ルート直下に軽量・自己完結ページ（JSなし、`style.min.css` 流用、`noindex`、`sitemap: false`、トップへの導線付き）。GitHub Pages が自動利用。
- **GA設定削除**: `_config.yml` の `google_analytics: G-L922RQ9G6R` を削除。gtagスニペットがどこにも存在せず CSP（script-src 'self'）でもブロックされる未使用設定だった。GA4導入時は CSP 緩和込みで別途実施。
- **見送り（記録）**: jekyll-seo-tag 導入（手動実装で全要素カバー済み・冗長）/ img alt（img要素なし、SVGは aria-hidden 済み）。

**関連ファイル**
- `404.html`（新規） / `_config.yml`

---

### スマホUX・表示速度・容量の改善 (PR #109 → main マージ)

- **背景**: スマホ閲覧主体サイトとしての要修正箇所レビュー。構成/PWA/ダークモード/エラー表示は良好な一方、初期表示の直列待ち・iOSスクロール挙動・小型端末の可読性・配信容量に改善余地があった。三原則を守る範囲で軽微修正を1コミットに集約。
- **🔴 初期表示高速化**: `assets/js/app.js` `fetchWeatherData` の直列 await（潮汐計算→警報群→波→風→海況）を単一 `Promise.allSettled` に統合し全fetch並行化。`wmData` は fulfilled 判定で安全取得。部分失敗は既存のセクション単位エラーUIで吸収。`calculateTide` は月齢ラベル描画のみで潮汐極値と独立＝並行化安全。
- **🔴 iOSスクロール**: `assets/css/style.css` `.chart-scroll` に `overscroll-behavior-x: contain`（チャート横スクロール端でのページ連動バウンス抑止）。
- **🟠 可読性**: 補足ラベル（`.section-label`/`.section-source`/`.section-sub`）の `font-size 10px→11px`。`DESIGN.md` のサイズ階層表も「補足・キャプション 11px（最小11px）」に追従。
- **🟠 容量削減**: `_config.yml` `exclude:` に `data/mooninfo_2026.json`（約2MB）/ `data/tide_data.json`（約150KB）を追加。クライアント未参照（フロントは `moon_daily.json`/`tide_widget.json` 参照）で Actions はリポジトリ直読みのため影響なし。`README.md` の両更新手順に除外注記を追加。
- **🟡 API/Actions節約**: 警報キャッシュバスターを1分→15分粒度に緩和（`fetchJmaWarning`、データ更新は30分cron）。
- **SEO**: `index.html` にフォールバック用 `<noscript>` 文を追加。
- **見送り（記録）**: Chart.js `responsive:false`（横スクロール固定幅設計＝意図的）/ 3時間自動更新（cron整合・三原則3）/ skeleton shimmer（表示完了で消滅・実害小）。
- 検証: CSS/JS は merge 後 `minify.yml` が自動再生成。

**関連ファイル**
- `assets/js/app.js` / `assets/css/style.css` / `_config.yml` / `index.html` / `DESIGN.md` / `README.md`

---

## 完了済み（2026-06-11）

### 構成校正: 命名統一・アセット集約（ブランチ `chore/restructure-naming`）

- **背景**: GitHub Pages/PWAベストプラクティスに基づく構成レビュー。命名がsnake/kebab/略語で混在、ルート直下にアイコン/OGPが散在していた。
- **A群（低リスク）**:
  - workflowをkebab統一: `fetch_openmeteo→fetch-openmeteo` / `fetch_forecast→fetch-forecast` / `dl_wave-guid→fetch-wave-guidance`（内部参照・job名・cron不変）。
  - 画像集約: `favicon.svg`/`favicon-48.png`/`apple-touch-icon.png`→`assets/icons/`、`ogp.*`→`assets/og/`。`favicon.ico`はルート慣例で残置。`index.html`/`site.webmanifest`/`FORK.md`追従。
- **B群（dataをsnake_case統一）**:
  - `forecast_data.json→forecast.json`（_data冗長解消）/ `tidedata.json→tide_data.json` / `moon_today.json→moon_daily.json`。
  - 既にsnake_caseの `tide_widget`/`warning_chigasaki`/`weather_marine`/`wind_forecast` は変更なし。
  - **改名保留**: `mooninfo_2026.json`（`extract_daily_data.py`の`f"data/mooninfo_{year}.json"`動的参照＝年サフィックス意味的）/ `wave_guid_20.json`（`_20`は気象庁エリアコード）。
  - 連動更新: scripts(書) / app.js+app.min.js再生成(読) / workflowのgit add / README・FORK / `sw.js` CACHE_NAME v7→v8。
- **検証**: `pytest` 35件通過、リネームJSON妥当、全ソースで旧名0ヒット（履歴ログ・reports除く）。bundler未導入のためJekyllビルド検証は未実施（要・公開前確認）。

### リポジトリ構成整理・未使用ファイル/死パイプライン撤去 (main マージ)

- **背景**: フォルダ/ファイル構成の妥当性検証を実施。生成元・参照元のないファイルや、誰にも消費されないデータ取得パイプラインが残存していた。
- **削除（孤児ファイル）**: `data/tide_2day.json`（横スクロール同期機能の旧仕様、現在は未参照）。
- **Stormglass 定期取得パイプライン撤去（Actions cron -1本）**:
  - `scripts/fetch_tide.py` / `data/tide_data.json` / `.github/workflows/update-tide-data.yml` を削除。
  - `tide_data.json` はフロント・他スクリプトのどこからも読まれておらず完全に死んでいた。
  - Stormglassフォールバック自体は `scripts/extract_daily_data.py` の `fetch_stormglass_tides()`（気象庁データ欠損時のみライブHTTP取得）として存続。挙動・`STORMGLASS_API_KEY` の用途は不変。
- **未消費の中間生成物撤去**: `data/tide_today.json` / `data/tide_3day.json` とその生成関数（`extract_tide_today` / `extract_tide_3day`）を `scripts/extract_daily_data.py` から削除。フロントは `tide_widget.json` に一本化済みのため影響なし。
- **git衛生**: 誤って追跡されていた `.claude/worktrees/` 配下を追跡解除し、`.gitignore` に `.claude/worktrees/` `.pytest_cache/` `.claude/settings.local.json` を追加。
- **ドキュメント追従**: `CLAUDE.md` の Actions 一覧表から `update-tide-data.yml` を削除。`README.md` の `tide_data.json` 参照を `tide_widget.json` に修正、Stormglassシークレット説明・データ構成例・使用技術欄を実態に合わせて更新。
- 検証: `python scripts/extract_daily_data.py` 正常実行（tide_widget.json/moon_today.json生成、tide_today/3dayは再生成されず）/ pytest 35件通過。

**関連ファイル**
- `.gitignore` / `CLAUDE.md` / `README.md`
- `scripts/extract_daily_data.py`
- 削除: `data/tide_2day.json` / `data/tide_data.json` / `data/tide_today.json` / `data/tide_3day.json` / `scripts/fetch_tide.py` / `.github/workflows/update-tide-data.yml`

---

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
