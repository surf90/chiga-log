---
updated: 2026-07-09
---

# ちがログ 進捗メモ

> 役割: セッション完了ログ / 簡易 changelog（内部メモ、サイト非公開）。各セッション末に最新の完了項目を追記する（CLAUDE.md「トークン節約」参照）。

## 完了済み（2026-07-09）

### 公開URL検証→UX/UI・SEO・コード品質の低リスク修正（main 作業, Fable）

- **背景**: 公開 URL（`https://surf90.github.io/chiga-log/`）を Chrome 実機で観測検証（Console/Network/DOM/グラフ描画）した結果、**機能障害はゼロ**（全 fetch 200・`--` 残留なし・両グラフ描画・SW正常）。以降は「モダンなページ」観点の UX/UI・SEO・コード品質の残課題を三原則準拠で潰した。デザイン見た目（ライトモード）は不変。
- **UX/UI 改善**（commit `ba8677b`「fable UI改善」, `assets/css/style.css` / `index.html` / `DESIGN.md`）:
  - **スティッキーホバー解消**（最重要）: `.hero-card`/`.current-time`/`.toggle-btn`/`p.note a`/`.footer a`/`.lifesaving-link` の `:hover` を全て `@media (hover: hover)` でガード。タッチ端末でタップ後にホバー塗り（例: トグルボタン）が残る構造を是正。
  - **`color-scheme: light dark`** を `:root` に宣言（ダーク時のスクロールバー等 UA 部品の白浮き解消）。
  - **ダーク可読性**: 固定色 `.warning-none`(#707070)・潮位/区切り(#888888) を `var(--text-sub)` に変数化。ダーク時のみ満潮 `#60a5fa`・干潮 `#f87171`・エラー赤 `#ef4444` に明色化（Chart.js グラフ色は不変）。
  - **A11y**: 見出し・フッターの装飾 `|` に `aria-hidden="true"` 付与（SR の「縦線」読み上げ防止）。
  - `DESIGN.md` に hover ガード原則・color-scheme・ダーク明色置換・装飾記号 aria-hidden を追記。
- **SEO 修正**（`googled180bd734463e748.html`）:
  - **sitemap.xml から Google Search Console 検証ファイルを除外**。本番 sitemap に検証ファイル（非コンテンツ）が `<loc>` 登録されていた欠陥を実確認 → front matter に `layout: null` + `sitemap: false` を付与。ビルド出力を `cat -A` でバイト検証し、検証文字列＋改行のみで**先頭空行なし＝Google 検証は維持**。ビルド後 sitemap はホームページ1件のみに。
  - JSON-LD/OGP/canonical/robots/webmanifest/404 は再点検し欠陥なし（修正不要）。
- **コード品質**（`assets/js/app.js` / `app.min.js`）:
  - **死定数 `LAT`/`LON`（+ 専用 `_cfgLoc`）を削除**。データは Actions 事前取得 JSON 経由でクライアントは座標未使用。ESLint warn 3件（`LAT`/`LON`/未使用 catch）を解消。※2026-06-18 は「フォーク lat/lon 参照ドキュメント兼用」として温存判断だったが、lat/lon は `_data/site.json`・FORK.md・README・残存する `WAVE_GUID_AREA`/`TSUNAMI_AREA_CODE` のフォールバック例で十分保持されるため、本セッションで**方針転換して削除**。
  - `catch (e)` → `catch`（optional catch binding、月齢フォールバック箇所）。
  - `app.min.js` を CI と同じ `terser -c -m` で再生成。`node --check` OK。
- **sw.js 課題は誤検知と判明（変更なし）**: 「sw.js の Prettier 差分」は git 上は **LF 保存**で prettier 準拠、`core.autocrlf=true` による作業コピー CRLF 化のみが原因（CI/Linux では合格）。実体なしのため sw.js は変更せず revert。
- **README 修正**: minify 再生成手順の CSS コマンドが実 CI と不一致（README `clean-css-cli` ↔ `minify.yml` は `csscompressor`）だったのを是正。CI と同じ `csscompressor` の Python ワンライナーに差し替え。
- **検証**: 公開 URL 実機観測 / `jekyll build` 成功 / ローカル `_site` を baseurl 再現配信（ジャンクション）で描画・Network 200・グラフ・エラー無しを確認 / `eslint` warn0 / `prettier --check` 全 clean / `pytest` 41件通過 / 検証ファイル・app.min.js の `node --check` OK。
- **未処理（記録）**: ホームページ sitemap の `<lastmod>` 欠落は**意図的に見送り**。付与には `jekyll-last-modified-at` プラグイン追加（三原則2: 依存追加禁止）か静的日付ハードコード（データ更新と乖離＝誤読・三原則1）が必要で、いずれも原則に反する。lastmod は sitemaps.org 仕様上オプションで欠落は許容。

**関連ファイル**
- `assets/css/style.css` / `assets/css/style.min.css` / `index.html` / `DESIGN.md`（commit `ba8677b`）
- `googled180bd734463e748.html` / `assets/js/app.js` / `assets/js/app.min.js` / `README.md` / `progress.md`

---

### CI ハング解消（pa11y の baseurl 404）＋顕在化した a11y コントラスト2件を修正（main 作業, Fable）

- **発端**: 上記 UX 修正 push 後、GitHub の Frontend CI が **pa11y ジョブで23分以上ハング**し「デプロイが進まない」状態に。`gh run view` で `Wait for server` ステップ滞留を確認。
- **根因（ハング）**: pa11y ワークフローは `http-server _site` で **ルート配信**する一方、`.pa11yci` と `wait-on` は `http://localhost:4000/chiga-log/`（baseurl 付き）を待つ。成果物は `_site/index.html` で `_site/chiga-log/` は無い → `/chiga-log/` が 404 → `wait-on`（既定タイムアウトなし）が**無期限待機**。2026-06-18 の `frontend-ci.yml` 追加以来の潜在バグで、フロント変更を含む push で初めて顕在化。
- **ハング修正**（commit `e1bea78`, `.github/workflows/frontend-ci.yml`）: `_site` を `_serve/chiga-log/` に写して `/chiga-log/` を解決可能に（本番パス再現）。`wait-on` に `-t 60000`（60秒）を付与し、到達不能時は**ハングでなく高速失敗**させる。CI と同じ `http-server`＋`wait-on` でローカル end-to-end 検証（正しいパス即到達・不正パス60秒失敗）。
- **顕在化した a11y 欠陥2件**（ハング解消で pa11y が46秒完走し検出。いずれも**テキストのコントラスト不足**。Chart.js の線・点・スウォッチはグラフィック要素で 1.4.3 対象外）:
  1. **干潮文字** `.tide-low` `#d9534f`（3.96:1）→ **`#ce4844`（4.5:1）**（`style.css`）。ダーク上書き `#f87171` は不変。
  2. **波グラフ凡例テキスト**（インライン `color:#27ae60`, 2.87:1）→ `item.style.color` を除去し、**系列色はスウォッチ（丸）で示し文字は既定色**（`--text-main`）に（`app.js`）。
- **a11y 修正**（commit `fix(a11y)…`, `assets/js/app.js` / `assets/css/style.css` ＋ min 再生成 / `DESIGN.md`）。`DESIGN.md` に「本文4.5:1・系列色はスウォッチで示す・干潮 `#ce4844`」を追記。
- **検証**: **pa11y-ci をローカル実機 Chrome（`chromeLaunchConfig.executablePath` 指定）で実行 → `0 errors` / `1/1 URLs passed` / exit 0**。`eslint` warn0 / `prettier` clean / `jekyll build` 成功 / min は CI と同じ terser・csscompressor 再生成。**GitHub 側で全チェック緑を確認**（Frontend CI 成功49s・Minify 成功・pages deploy 成功）。
- **付随メモ**: ①キュー滞留（pages 等）は GitHub 側のランナー割当遅延で、`github-pages` 環境は branch policy のみ（必須チェックゲート無し）＝ CI ハングは Pages をブロックしない、と確認。②中間コミット `e1bea78` の CI が failure なのは a11y 修正**前**にコントラストを正しく検出したもの（想定どおり、緑コミットで置換済み）。③「LF→CRLF」警告は Windows 作業コピー起因で、コミット済みブロブは `core.autocrlf=true` により LF（`file(1)`＋小さい diffstat で確認）。
- **README 追従**: 「フロントエンド品質チェック」のローカル pa11y 手順も同じ 404 の落とし穴があったため、baseurl 配下配信（`_serve/chiga-log`）＋`wait-on -t` に修正。

**関連ファイル**
- `.github/workflows/frontend-ci.yml`（commit `e1bea78`）
- `assets/js/app.js` / `assets/js/app.min.js` / `assets/css/style.css` / `assets/css/style.min.css` / `DESIGN.md`（commit `fix(a11y)…`）
- `README.md` / `progress.md`

---

## 完了済み（2026-07-08）

### コード品質改善: ダークモード整合・タイムスタンプ吸収・表示トグル統一（main 作業）

- **背景**: 「ページ/ソース全体の改善・修正」レビュー。プロジェクトは成熟（onclick/インラインstyle 0件・A11y良好・エラー境界完備）のため、三原則準拠の低リスク修正に限定。min バンドルが直近の鮮度警告機能追加（`803b30b`）以降に未再生成で、本番 min 版に反映されていない点も同時に是正対象。
- **CSS**（`assets/css/style.css`）:
  - ハードコード色（`.jma-overview`/`.section-loading`/`.tide-age-label` の `#707070`、`.section-sub` の `#aaaaaa`）を既存 `var(--text-sub)`（ライト/ダーク追従）へ置換。
  - `skeleton`/`skeleton-hero-card`/`#toast` の固定ライト色を `@media (prefers-color-scheme: dark)` で上書き追加（ダーク時に白浮きしていた問題を解消）。
  - `.hero-card` の `cursor: pointer` 重複定義（末尾ブロック）を削除し 125 行の定義に集約。
- **JS: タイムスタンプ命名吸収**（`assets/js/app.js`）: `pickTimestamp(obj)` を追加し `updated_at ?? fetchedAt ?? observed_at` にフォールバック。`markStale`（tide/wave/warning/forecast/wind）・`freshness`・`displayFetchTime` の参照を統一。警報のみ `fetchedAt` 直参照だった分岐を解消し、フォーク/スキーマ変更耐性を確保。**データスキーマ（Python 生成 JSON）は不変**。前回セッション「スコープ外」記録だったタイムスタンプ命名統一を JS 側正規化で解決。
- **JS: 表示トグル統一**（`assets/js/app.js`）: content/loading の `.style.display` を `.hidden` クラスへ統一（34→21 箇所）。content は初期 `class="hidden"` と対で `classList.remove("hidden")`、loading（`.section-loading`, display 指定なし）は `classList.add("hidden")`。CSS の `display` 指定・ID セレクタ・flex/grid と衝突する箇所（`#skeleton-loading`/`#toast`/`.section-error`/`.tide-chart-area`/`.typhoon-notice`/概況・風トグル/`.floating-alert`）は打ち消しリスク回避のため**現状維持**。
- **検証**: `pytest` 41 件通過 / `node --check` OK / `prettier` 整形済み。差分は意図分のみ（+53/-30）。
- **未処理**: CSS/JS min はコミット push 時に `minify.yml` が自動再生成（`csscompressor`＋`terser`）。**push は要ユーザー操作**（自動モードで main 直 push が拒否されたため手元 push 待ち）。push 後、min 版に `stale-banner`/`markStale`/`pickTimestamp` が含まれることを grep 検証すること。

**関連ファイル**
- `assets/css/style.css` / `assets/js/app.js` / `README.md` / `progress.md`

---

### エラー耐性向上: データ鮮度の可視化＋バックエンド堅牢化（main 作業）

- **背景**: 実障害①オーナーのGitHubアカウントが誤検知で一時停止→Actions全停止→データ更新が止まったが**サイトに一切警告が出ず**閲覧者が古い情報を最新と誤認しうる状態だった。懸念②各ソース（気象庁/Open-Meteo）の仕様変更で最新取得不能時の表示安全性。原因は(1)「更新日時」が `new Date()`（取得時刻）でJSON内 `updated_at` 未参照、鮮度警告はアメダス `stale` のみで実質無効、(2)`fetch_forecast.py` だけが失敗時 `null` で既存を上書き。
- **層A: フロント鮮度表示**（問題1・2の主軸, `assets/js/app.js`）:
  - 鮮度ヘルパー追加（`parseIso`/`humanAge`/`freshness`/`markStale`）＋閾値定数 `FRESHNESS`（データ種別ごと個別: marine/wind 3h・forecast 18h・wave 15h・warning 3h・tide 30h）。
  - **`displayFetchTime` 是正**: 取得時刻→`weather_marine.updated_at`（実データ生成時刻＋経過時間）。古い時は `.is-stale` 警告スタイル。
  - **グローバル停止バナー** `#stale-banner`: 最頻更新ソース(weather_marine, */30)が3h超で古い or 取得失敗時に最上部表示。**アカウント停止/cron停止の主検知**（`fetchWeatherData` 内）。
  - **セクション別 stale 注記**: 潮汐・波・警報・天気・風の各 `updated_at`(警報は `fetchedAt`)基準で `.stale-note` 点灯。
  - **津波失敗の明示化**: 失敗を「平常(津波なし)」と区別し `#tsunami-error` 表示。
- **層B: バックエンド堅牢化**（問題2, `scripts/fetch_forecast.py`）:
  - 唯一の脆弱点だった「失敗時 null 上書き」を修正。`is_valid_forecast()` で構造検証し、失敗・仕様変更時は既存を温存（`fetch_warning.py` と同パターン）。既存も無い場合のみ `RuntimeError`。
- **HTML/CSS**（`index.html`/`assets/css/style.css`）: `#stale-banner`・各 `.stale-note`・`#tsunami-error` 要素追加。既存の警告色変数（`--warning-bg`/`--warning-border`, ダーク対応済）を流用したスタイル追加。トグルは `hidden` 属性方式（`display` 未指定）。
- **検証**: `pytest` 41件通過 / `node --check`・Python構文OK / `jekyll build` 成功 / HTML↔JS のID整合9件一致 / 鮮度ロジック実行確認（10分=正常・4h=stale「4時間前」・2日前表記・不正ISO=誤警告なし）/ `fetch_forecast.py` 温存を実行検証（取得失敗・スキーマ変更の両模擬で `data/forecast.json` 不変）。
- **スコープ外（記録）**: Actions失敗のGitHub通知・外部デッドマンスイッチ（ユーザー選択で見送り）。※アカウント停止時はActions自体が停止し内部監視は無力なため、フロントの停止バナーが実質的代替防御。タイムスタンプ命名統一（`updated_at`/`fetchedAt`/`observed_at` 混在）も今回は非対象。
- **未処理**: CSS/JS min はコミットpush時に `minify.yml` が自動再生成（ローカル不要）。

**関連ファイル**
- `assets/js/app.js` / `index.html` / `assets/css/style.css` / `DESIGN.md`
- `scripts/fetch_forecast.py` / `README.md`

---

## 完了済み（2026-06-18）

### 高度品質検証: Perf/PWA/SEO最適化＋ランタイム堅牢化＋FE品質ゲートCI（main マージ）

- **背景**: モバイル基礎検証完了後の上位検証（Core Web Vitals / a11y / PWA運用 / SEO・OGP）。コード精査で「成熟Webアプリ」観点の残課題を抽出し、三原則準拠の範囲で実装。canonical/JSON-LD/OGP/CSP/aria/skip-link/可変フォント等は既に高品質で、対象は最適化・堅牢化に限定。
- **ステージ1（Perf/PWA/SEO 最適化4点）**:
  - **SW Cache-First化** (`sw.js`): App Shell（CSS/JS/Chart.js/HTML）を Cache-First に変更し即時描画。`data/` JSON は Network優先（鮮度・原則1）、navigation はオフライン時 `index.html` フォールバック。`CACHE_NAME` v8→**v9**。
  - **Google Fonts 非ブロッキング化** (`index.html`): 2本の font `<link>` を `media="print" onload="this.media='all'"` 化＋`<noscript>` フォールバック。レンダリングブロック解消（LCP改善）。
  - **theme-color 統一**: ライト時 `#FFFBEB`→**`#0e7490`**（manifest `theme_color` と一致）。
  - **OGP PNG単独化**: `og:image` の WebP 重複を削除（一部スクレイパのサムネ欠落回避・互換優先）。
- **ステージ2（堅牢性＋品質ゲート）**:
  - **fetchタイムアウト** (`assets/js/app.js`): `fetchWithTimeout`（`AbortSignal.timeout(10000)`）を追加し `fetchCached`＋直接fetch全8箇所を集約置換。回線ハング時に10秒で AbortError→既存セクション別エラーUIへ（永久ローディング解消）。
  - **DOM null安全化**: `setText()` ヘルパー追加。`displayFetchTime`/`fetchWeatherData` を setText 化、`showTideError`/`fetchJmaWarning` 冒頭に null ガード（要素欠落での全画面エラー化を防止・フォーク耐性）。
  - **JS品質ゲートCI**: 自己完結型 `eslint.config.js`（flat config・依存追加なし・対象は手書き `app.js` のみ）＋ `.prettierignore`（生成物/data/vendor/Liquid生成 site-config.js/google認証HTML を除外）。`frontend-ci.yml` の `lint` ジョブで ESLint+Prettier を push/PR 自動実行。
  - **a11y自動検査**: `.pa11yci`（WCAG2AA）＋ `frontend-ci.yml` の `a11y` ジョブ（Jekyll build→http-server→pa11y-ci）。配色変更の回帰安全網。
  - **CI方針**: `frontend-ci.yml` は `test.yml` 同様 push/PR・paths限定で **cron非追加**（三原則3順守）。`_config.yml` exclude に `eslint.config.js` を追加（公開ビルド除外）。整形未済だった `404.html`/`_data/site.json`/`style.css`/`sw-register.js` を prettier 整形。
- **検証**: `node --check`（app.js/sw.js/sw-register.js）exit0 / `eslint` error0・warn3（未使用 LAT・LON・catch e=温存）/ `prettier --check` 全clean / `pytest` 41件通過。
- **見送り（記録）**: フォント woff2 自ホスト化（作業量大・今回は非ブロッキング化で代替）/ DOM null 全40箇所一括化（高リスク4関数に限定）/ LAT・LON 死定数の削除（フォーク時 lat/lon 参照ドキュメントを兼ね温存）。

**関連ファイル**
- `index.html` / `sw.js` / `assets/js/app.js` / `assets/css/style.css`
- `eslint.config.js`（新規）/ `.prettierignore`（新規）/ `.pa11yci`（新規）/ `.github/workflows/frontend-ci.yml`（新規）
- `_config.yml` / `README.md` / `404.html` / `_data/site.json` / `assets/js/sw-register.js`

---

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
- **再検証で判明した残課題の修正（第2フェーズ）**:
  - `README.md` 本文の旧名 `fetch_openmeteo.yml` → `fetch-openmeteo.yml`（CLAUDE.md表は済だが本文を見落としていた）。
  - スクリプト改名 `scripts/dl_wave-guid.py` → `scripts/fetch_wave_guidance.py`（ハイフン入りでPython識別子として不正だった）。workflow `run:` とテストを連動更新し、`tests/test_fetch_wave_guidance.py` の `importlib` 回避策を通常 `from fetch_wave_guidance import parse_csv` に簡素化。出力データ名 `wave_guid_20.json` は不変。

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

## 完了済み（2026-06-17）

### 品質改善（アクセシビリティ・エラー耐性・軽量化・構成）

- **アクセシビリティ**: `<header>`/`<main id="main-content">`/`<footer>` ランドマーク化、スキップリンク追加（`.skip-link`）、概況・予想風トグルに `aria-expanded`/`aria-controls`（JS側で開閉状態同期）
- **エラー耐性**: `window` の `error`/`unhandledrejection` グローバルエラー境界（`_showGlobalError()`）で白画面防止。最上位 catch を null 安全化
- **軽量化**: JSON-LD 重複 `alternateName` を `_data/site.json` の `alt_names` に一元化（`{{ ... | jsonify }}`）
- **構成**: 8個のセクションアイコンSVGを `_includes/icons/*.svg` に抽出（TSUNAMI/WAVE は `waves.svg` 共用）。index.html 839→666行。ビルド出力の等価性を検証済み
- **ローカル環境**: `Gemfile`（github-pages + webrick + tzinfo-data）追加。`bundle exec jekyll serve` でプレビュー可（Ruby 3.3 + DevKit/MSYS2 導入）
- CSP は変更せず（同一オリジン fetch のみで現状正しい）。GitHub Actions cron も不変

**関連ファイル**
- `index.html` / `assets/js/app.js` / `assets/css/style.css` / `_data/site.json`
- `_includes/icons/` / `Gemfile` / `_config.yml` / `.gitignore`
