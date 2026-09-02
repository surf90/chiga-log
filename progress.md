---
updated: 2026-09-02
---

# ちがログ 進捗メモ

> 役割: セッション完了ログ / 簡易 changelog（内部メモ、サイト非公開）。各セッション末に最新の完了項目を追記する（CLAUDE.md「トークン節約」参照）。

## 完了済み（2026-09-02）

### スマホのスクロール量削減（縦余白の圧縮, PR #164 / #165 / 本PR）

閲覧時のスクロール量が多いという指摘を受け、可読性（フォントサイズ・`line-height:1.7`）はそのままに、縦方向の余白のみを段階的に圧縮した。375px 幅での実測で `document.body.scrollHeight` **2455px → 2389px**（本PR分。#164/#165 を含めた累計はさらに大きい）。

**PR #164 — カード余白**

- `.weather-box`: `padding` `20px 24px`→`16px 24px`、カード間 `margin-bottom` `16px`→`12px`（420px以下は `padding` `14px 16px` / `margin-bottom` `10px`）
- `.weather-box h2` `margin-bottom` `12px`→`10px`、`.hero-card` / `.hero-cards` / 420px以下の `.container` も同様に微調整

**PR #165 — グラフ高さ（第1段）**

- 潮汐 160→144px、波高・周期 200→180px

**本PR — 積み残しの微調整**

- グラフ第2段: 潮汐 144→**134px**、波高・周期 180→**164px**
- `header`: `padding` `18px 20px 16px`→`15px 20px 13px`、`margin-bottom` `22px`→`18px`（420px以下は `12px 10px 11px` / `14px`）
- `.data-row` `padding` `6px 0`→`5px 0`（全カードの各行に効くため累積効果が大きい）
- `.tide-chart-scroll-wrap` `margin-top` `20px`→`14px`

**実装上の注意（DESIGN.md に追記済み）**

- Chart.js は両グラフとも `responsive:false` / `maintainAspectRatio:false`。キャンバス高は **CSS（`.tide-chart-area` / `.wave-chart-area`）と JS（`canvas.height`）の2箇所に重複**して持つため、変更時は必ず両方を揃える。
- 高さ固定値に依存する処理は無い（`nowLinePlugin` は `chart.height`、`stickyYAxisPlugin` はキャンバス全高、横幅は `CHART_TOTAL_PX`）。

**検証（ローカル、Chromium 実描画）**

- `bundle exec jekyll build` → `_serve/chiga-log` 配信 → Puppeteer（375px, DPR2）で実測。JS エラー・`pageerror` なし（ネットワーク fetch 失敗のみ＝サンドボックス起因で変更前後とも同一）、横スクロール発生なし、両グラフとも描画され目盛り（潮位 m / 波高 m / 周期 秒）が判読可能なことをスクリーンショットで確認。
- `npx eslint` / `npm test`（潮汐フロントエンド単体）/ `node --test warning-worker/test/*.test.js` / Chart.js SRI 一致 / `prettier --check` / `pa11y-ci`（WCAG2AA, 0 errors）すべて green。

**追補 — 波グラフ下の空白（PR #167）**

- 波グラフのみ `layout.padding.bottom: 24` が残っており、X軸ラベルの下に 24px の死に領域ができて直下の注記との間が間延びしていた（潮汐グラフには無い）。凡例を `.chart-scroll` の外へ出した際の残骸と判断し `layout: { padding: 0 }` へ。あわせてキャンバス高 164→140px とし、**プロット領域（chartArea 高 112px）は変えずに** 24px 短縮。
- 計測: `Chart.getChart()` で `scales.x.bottom` がキャンバス高と一致（=下に空白なし）することを確認。

**関連ファイル**

- `assets/css/style.css` / `assets/js/app.js` / `DESIGN.md`（`.min` 版は `minify.yml` が自動生成）

### GitHub Pages 配信設定の検証とリポジトリ全体監査（PR #157 / #158 / #159）

最新の GitHub Pages 推奨構成・各配信形式に照らして全体を点検し、実効していない設定と CI の検査漏れを解消した。**コード上の実害となるエラー・脆弱性は検出されず**、修正はいずれも設定・CI 側。

**配信設定の修正（PR #157）**

- **CSP の `frame-ancestors` が無効だった**: meta 版 CSP では仕様上このディレクティブは無視され、ブラウザはコンソール警告を出すだけ。GitHub Pages はレスポンスヘッダを設定できないため、クリックジャッキング対策はそもそも付与できない。削除し、meta でも有効な `frame-src 'none'` / `form-action 'none'` を追加（サイト内に `<form>` は無し）。
- **`favicon.ico` が相対パス**: `index.html` のこの1行だけ `{{ site.baseurl }}` が無く、サブパス配信の 404 ページから解決が外れる。baseurl 付きに統一。
- **robots.txt が実効していない**: プロジェクトページ配下の `/chiga-log/robots.txt` はクローラに読まれない（オリジン直下のみ有効）。さらに `Disallow: /reports/` は baseurl 欠落で別サイト領域を指していた。パスを訂正し、実効範囲をファイル冒頭に明記（`reports/` は `_config.yml` の exclude で既にビルド除外済みのため実害は無かった）。
- **`site.webmanifest` に `id` 追加**: `start_url` にクエリが付くため、PWA のアプリ同一性を `"id": "/chiga-log/"` で固定。

**CI の検査漏れを解消（PR #158）**

- **ESLint が SW を検査していなかった**: `eslint.config.js` の `files` は `assets/js/app.js` のみで、`sw.js` と `assets/js/sw-register.js` はどのブロックにも一致せず `no-undef` すら適用されていなかった（未定義参照が素通り）。SW 用 globals を追加し、ルールを `sharedRules` として共有。CI の lint も 3 ファイル対象に。
- **Worker のテストが未実行だった**: `warning-worker/test/` がどのワークフローからも呼ばれていなかった。Worker は Pages とは別デプロイだがソースは本リポジトリにあり、壊れると警報表示が黙って落ちる。追加依存なしの `node --test` を lint ジョブに追加（`node --test <dir>` は Node 22 で未対応のため glob 指定）。
- **Chart.js の SRI 未検証**: `index.html` の `integrity` と自ホスト実ファイルの SHA-384 がずれると、ブラウザがスクリプトを丸ごと拒否しグラフが全滅する。CI で照合して検知（現状は一致）。

**保守性の追補（PR #159）**

- **Dependabot が `warning-worker/` を見ていなかった**: ルートとは別の `package-lock.json` を持つため `directory: "/"` では更新されず、2026-08 の undici 系アラートは手動対応になっていた。`/warning-worker` を個別登録して自動追従させる。
- **`persist-credentials: false`**: 読み取り専用ジョブ（`frontend-ci` の lint / a11y、`test`）の checkout で認証情報を `.git/config` に残さない。
- **paths に `_data/**` を追加**: `_data/site.json` は `site-config.js` の生成元かつ Python スクリプトの設定元だが、変更しても CI が起動しなかった。

**監査して問題なしだった箇所**

- ワークフロー: 全 action が SHA ピン止め、`permissions` 明示（read/write 最小）、`pull_request_target` 不使用、`${{ github.event.* }}` を `run` に展開するインジェクション経路なし。
- Python: 標準ライブラリのみ、`subprocess`/shell 不使用、`save_json` は tmp + `os.replace` の原子的置換、HTTP はタイムアウト＋バックオフ付きリトライ。
- フロント JS: `innerHTML` は空文字クリアのみ（挿入なし）、`eval`/`document.write` なし、fetch は `AbortSignal.timeout` 付き、`JSON.parse` は try 内。
- Service Worker: オリジンを `URL` で厳密比較、データ JSON はネットワーク優先＋クエリ除去キー、静的資産は SWR。
- Cloudflare Worker: CORS はオリジン許可リスト、`X-Content-Type-Options: nosniff`、上流スキーマ検証あり、エラー詳細を漏らさない。
- 依存: root / warning-worker とも `npm audit` 0 件。**2026-08-18 の申し送りだった `extract-zip`（GHSA-x7jf-2287-qcpf）は解消済み**（`@puppeteer/browsers` の overrides と `PUPPETEER_SKIP_DOWNLOAD` により検出されなくなった）。Chart.js 4.4.7 に該当 CVE なし。
- HTML: 重複 id なし・タグの閉じ漏れなし。テストは Python 70 / フロント 27 / Worker 3 すべて green。

**今後の候補（未着手・要相談）**

- Chart.js 4.4.7 → 4.5 系の更新（現状セキュリティ上の必要性は無く、グラフ全面の再検証コストが見合わないため見送り）。
- `wrangler deploy --dry-run` による Worker のビルド検証を CI に追加（wrangler のインストールが必要で、実行時間と依存が増えるため保留）。
- cron の追加・頻度変更は今回も一切なし（三原則3）。

**関連ファイル**

- `index.html` / `robots.txt` / `site.webmanifest`
- `eslint.config.js` / `.github/workflows/frontend-ci.yml` / `.github/workflows/test.yml` / `.github/dependabot.yml`
- `README.md` / `CLAUDE.md` / `AGENTS.md`

## 完了済み（2026-08-29 追補）

### データ鮮度対策のマージ後監査と積み残しの解消

PR #154 マージ後に本番状態を監査し、残っていた不具合・弱点を全て解消した。

- **監査結果（問題なし）**: `minify.yml` が実行され `app.min.js` に新関数（`fetchLiveAmedas` / `pickSeaState` / `upgradeWithLiveAmedas` / `renderWeatherCards`）が入っていること、`sw.js` が `chigalog-v19` であることを確認。`data/weather_marine.json` の `marine.hourly` は次回の `fetch-openmeteo` 実行から入る（マージ時点の最新 run はマージ前のもの）。
- **警告閾値とライブ取得トリガを分離（重要）**: `LIVE_AMEDAS.staleAfterMs` が `FRESHNESS.marine` を共有していたため、**アメダスのライブ取得が使えない環境（CORS遮断・オフライン・パス形の相違）では、通常運用の cron 間隔（実効50〜90分）でも45分超で警告が出続ける**状態だった。変更前（3時間）より警告が増える退行になり得るため、警告は `FRESHNESS.marine = 2時間`、取得トリガは `LIVE_AMEDAS.staleAfterMs = 45分` に分離。「取り直す価値があるか」と「利用者に伝える価値があるほど古いか」は別の基準。
- **風予報の警告が fail-open だった**: 系列が現在時刻に届いていないのに `updated_at` が壊れていると、`markStale()` が時刻を解釈できず**警告を出さないまま「データなし」だけを表示**していた。カバレッジ欠落時は時刻が読めなくても必ず警告するよう分岐（三原則1）。
- **sessionStorage のキーが増え続ける**: アメダスのキャッシュキーは3時間ブロックごとに変わるため、PWAで開きっぱなしのタブでは1日8件ずつ溜まり TTL でも消えなかった。取得成功時に現在ブロック以外を掃除する `pruneAmedasCache()` を追加。列挙は `length` / `key(i)`（`Object.keys(sessionStorage)` は環境依存のため使わない）。
- **ライブ取得のタイムアウトを6秒に短縮**: 既定10秒だと、その間 `fetchWeatherData` の再入ガードが効いたままで**手動更新のタップが無反応**になる。付加的な取得なので本体より短く切る。`fetchCached` に `timeoutMs` の受け渡しを追加。
- **Actions の push がブランチで失敗する問題**: `git pull --rebase origin main` が main 決め打ちで、`workflow_dispatch` をブランチで実行すると浅いクローン（`--depth=1`）に main の共通祖先が無く add/add コンフリクトで push できなかった（PR #154 での実測）。7本すべてを `origin "$GITHUB_REF_NAME"` に変更。**main 上では完全に同じ挙動**で、cron の頻度・本数は不変（三原則3）。
- **テスト**: `tests/test_live_frontend.cjs` を24→**27件**に拡張。ストレージのスタブを実ブラウザ同様の `length` / `key(i)` を持つ実装に差し替え、(1) 1時間前の観測でライブ取得は走るが警告は出ないこと、(2) 古いブロックのキャッシュが掃除されること、(3) `updated_at` が壊れていても系列欠落なら警告が出ることを固定。pytest 70件・Node 27件・ESLint・Prettier すべて成功。

**関連ファイル**

- `assets/js/app.js`
- `.github/workflows/*.yml`（データ push を持つ7本）
- `tests/test_live_frontend.cjs`
- `DESIGN.md`

---

## 完了済み（2026-08-29）

### WIND / NOW / 水温･波高 のデータ鮮度対策（Actions 発火遅延の吸収）

- **原因特定**: 「⚠ データが古い可能性（最終更新4時間前）」は実装不具合ではなく、**GitHub Actions の schedule 発火遅延**。`fetch-openmeteo.yml`（`*/30`）の run は #935〜#964 まで全て success で、発火自体が 8/26 20:37 UTC 以降 **4〜12時間間隔**に悪化していた。GitHub 公式（community discussion #156282）が開始ドリフト悪化を認識済みで、2026-08-06 の Actions 大規模障害・08-26 の複数インシデントと同時期。**cron 追加・高頻度化では解決しない**（三原則3でも禁止）。
- **判定軸の誤り**: 従来は全データを「ファイル生成時刻の年齢」で古いと判定していた。`wind_forecast.json` は未来48時間分を含むため、生成が4時間前でも表示行は妥当であり、**⚠ は誤警告**だった。実測値（アメダス）と予報値で「古い」の意味が違うことを踏まえ、判定軸を分離。
- **NOW（アメダス）＝ Snapshot First / Live Fallback**: スナップショットで先に描画し、`jma_amedas.observed_at` が45分超の時だけ気象庁 bosai の**地点別**JSON（`bosai/amedas/data/point/{code}/{yyyyMMdd}_{HH}.json`）を直接取得して差し替え。全国分の `map/{ymdhns}.json` はモバイルには重いため使わない（三原則2）。失敗時はスナップショットと ⚠ を維持（三原則1）。sessionStorage 10分TTL（観測周期と一致）。**十分新しければ外部リクエストは1本も出さない**（三原則3）。CSP は `www.jma.go.jp` が津波カードで許可済みのため変更不要。
- **WIND**: ライブ取得は行わず、鮮度判定を「系列が現在時刻に届いているか」（カバレッジ）へ変更。年齢閾値は更新停止検知用に 3h→6h。
- **水温･波高**: ブラウザからの追加取得ではなく、`fetch_openmeteo.py` の Marine URL に `hourly=wave_height,sea_surface_temperature&forecast_days=2` を追加（**同一URLのパラメータ追加でリクエスト数は増えない**）。フロントは `marine.hourly` から現在時刻以前の最新行を選ぶ。hourly が仕様変更で弾かれた場合に current だけで再試行する退避経路（`fetch_marine()`）を用意し、更新停止を防ぐ。MARINEカードに `#sea-stale` を新設（従来は注記が無く、古い値を無表示で出していた）。
- **表示**: 「LIVE」バッジは追加せず（`.section-source` と「更新日時」と重複）、NOWカードに観測時刻「（10:20 観測）」を常時表示。`updated_at`（ジョブ実行時刻）ではなく `observed_at` を鮮度判定と「更新日時」の基準に変更。
- **検討して見送り**: WIND/波の Open-Meteo ブラウザ直fetch（費用対効果が低く、Python/JS のロジック二重化・CSP 追加・混在整合性の問題を招く）。外部scheduler＋`workflow_dispatch`（閲覧者不在でも更新が要る日次系のみ有効。別件）。
- **テスト**: `tests/test_live_frontend.cjs` を新設（17件）。QCフラグ処理、3時間ブロックのフォールバック、**新鮮な時に外部fetchが0本であること**、失敗時のスナップショット維持、hourly 行選択、風のカバレッジ判定を固定。`tests/test_fetch_openmeteo.py` に `fetch_marine()` の退避経路3件を追加。pytest 70件・Node 21件・ESLint・Prettier すべて成功。`sw.js` を `chigalog-v19` へバンプ。
- **自己レビューで発見・修正した4点**（初回コミット後）:
  1. `pickSeaState` が `marine.hourly` に一部の系列しか無い場合、欠けている項目を `null` で上書きして**既存の値を消していた**。系列そのものが無い項目は `current` の値を残し、系列はあるが当該時刻が欠測の場合だけ「データなし」と出すよう修正（Marine API が `sea_surface_temperature` を hourly で返さなかった場合の退避も兼ねる）。
  2. `upgradeWithLiveAmedas` が `updated_at` へフォールバックしていたため、**`jma_amedas` 自体が無い**（気象庁取得失敗＋引き継ぎ値なし）状態で `updated_at` が新しいとライブ取得を行わず、Open-Meteo 値のまま固定されていた。観測値の有無で判定するよう修正。
  3. 手動更新（時刻タップ）時にライブ側だけ sessionStorage キャッシュを見ていたため、`force` を `fetchLiveAmedas` まで伝播。
  4. `amedasKeyToIso` が想定外キーで例外を投げ得たため、`null` を返して当該スロットを捨てるよう変更。
  - 回帰テストを3件追加（計24件）。
- **Marine API の hourly は実証済み**: `workflow_dispatch` でブランチ上のワークフローを1回実行し、`fetch_openmeteo.py` が **退避経路の `[warn]` を出さずに** `data/weather_marine.json` を保存（`4 files changed, 287 insertions(+)`）。`hourly=wave_height,sea_surface_temperature&forecast_days=2` は受理される。
  - なおこの run は最後の push 段階で失敗した。`git pull --rebase origin main` が **depth=1 の浅いクローン＋main 以外のブランチ**では共通祖先を持てず add/add コンフリクトになるため。main 上の通常運用（checkout 対象が main）では発生しない**既存の性質**で、今回の変更とは無関係。データは push されておらず影響なし。ブランチ上で手動 dispatch するのは非対応、と理解しておく。
- **未検証（実ブラウザでの確認が必要）**: 実行環境から `www.jma.go.jp` へ到達できず、**アメダス地点別JSON（`bosai/amedas/data/point/{code}/{yyyyMMdd}_{HH}.json`）のパス形と CORS ヘッダのみ未実測**。失敗時はスナップショット維持に落ちる設計（コンソールに `Live amedas fetch failed` を出す）だが、公開後に DevTools で要確認。成功していれば NOW カードに「（HH:MM 観測）」が最新スロットで出る。

**関連ファイル**

- `assets/js/app.js` / `index.html` / `sw.js`
- `scripts/fetch_openmeteo.py`
- `tests/test_live_frontend.cjs`（新規） / `tests/test_fetch_openmeteo.py`
- `package.json` / `.github/workflows/frontend-ci.yml`
- `CLAUDE.md` / `DESIGN.md`

---

## 完了済み（2026-08-25）

### 月齢・潮回りロジックの検証と修正

- 月齢を四捨五入して潮回りへ直接変換していたため、2026-08-24（月齢11.391）が「若潮」になる誤判定を確認。NASA月齢から直前の朔のJST日付を復元し、陰暦日で判定する方式へ変更（同日は陰暦12日相当の「中潮」）。
- 数式フォールバックの基準新月 `2000-01-06 18:14` をJSTとして解釈していた9時間ずれをUTCへ修正。JST日付境界で概算陰暦日を求めるよう変更。
- NASA配列の対象エントリ `time` と期待UTC時刻を照合し、欠落・並べ替え時に別時刻の値を採用しない検証を追加。NaN・Infinity・bool・範囲外・配列以外のJSONも失敗扱いにし、古い `moon_daily.json` は `tide_widget.json` の月情報へ再利用しない。
- 朔がJST正午より後に来る日は正午月齢だけだと前月30日になるため、当日末までの月齢リセットを検査し、その日全体を陰暦1日として扱うよう修正。
- 平均朔望月だけのフォールバックは2026年中48日でNASA由来の潮回りと異なったため、`moon_daily.json` に当日から35日ぶんのNASA由来潮回りを同梱。日次更新の遅延・オフラインキャッシュ中も当日キーを優先し、数値型・1〜30の範囲を満たす値だけ採用する。
- フロントの回帰テストをNode標準テストで追加し、Frontend CIへ組み込み。文字列を数値へ暗黙変換していたスキーマ違反も拒否する。
- Pythonテスト後のPrettier全体検査が生成キャッシュへ入らないよう、`.pytest_cache/` と `__pycache__/` を整形対象外へ追加。
- 2026年データを全件監査し、月齢8,760時間は時刻欠落なし、月齢・潮回り365日は算出不能なし、気象庁潮位365日は日付欠落・時刻順・型異常なし。さらに計算フォールバックを1900〜2100年の73,414日で検査し、範囲外・「不明」はゼロ。
- 当日生成物を更新し、2026-08-25は月齢12.391、陰暦13日相当の中潮、満潮2:00/126cm・16:31/139cm、干潮9:25/26cm・21:49/92cmを確認。

**クローズ判定**

- 関連Python 30件、フロント4件、ESLint、Prettier、Terser、Python構文、Workflow YAML、`git diff --check`を通過。調査範囲内に未修正の不具合・エラー・脆弱性は残っていないため、本タスクを完了扱いとする。
- 外部運用上は従来どおり `mooninfo_2027.json` の年次配置が必要。12月の既存警告と当年ファイル欠落時の異常終了で検知するため、今回のコード不具合には数えない。

**関連ファイル**

- `assets/js/app.js` / `scripts/extract_daily_data.py` / `tests/test_extract_daily_data.py` / `tests/test_tide_frontend.cjs` / `data/moon_daily.json` / `data/tide_widget.json` / `.github/workflows/frontend-ci.yml` / `.prettierignore` / `package.json` / `README.md` / `progress.md`

## 完了済み（2026-08-10）

### 残ブランチの整理と軽微修正

- **`claude/fix-errors-bugs-vulnerabilities-sri5yl` を削除**（先端 `b2815dc`）。マージ前に実際にローカルでマージして検証した結果、**コード差分ゼロ**（マージ後ツリーと `origin/main` を `assets/` `index.html` `sw.js` で比較して差分なし）。内容は PR #131（`738a4fb`）として squash 済みで、ブランチ側は squash 後に main へ入った変更を持たない**退行版**だった（`DESIGN.md` にサイトバー節が無い、`eslint.config.js` に `IntersectionObserver` global が無い等）。競合3ファイル（`DESIGN.md` / `progress.md` / `eslint.config.js`）はいずれもこの退行と prettier の表整形差によるもので、マージしても得るものは空の重複見出し2件のみ。よって**マージせず削除**した。
- **`fetch-heatstroke-alert.yml:28` のコメント修正**: `actions/checkout` の SHA ピンは他ワークフローと同一（`3d3c42e…` = v7.0.1）なのにコメントだけ `# v5` のままだった（2026-08-08 の残課題）。`# v7.0.1` に統一。動作影響なし。

### dependabot オープンPR 5件のマージ

いずれも差分がバージョンピンのみであること、`origin/main` と競合しないこと、CI（ESLint + Prettier / pa11y WCAG2AA）が success であることを確認のうえ squash マージ。ブランチはマージ時に自動削除。

- #132 `ruby/setup-ruby` 1.320.0 → 1.321.0（`frontend-ci.yml` の SHA ピンのみ）
- #133 `eslint` 10.7.0 → 10.8.0
- #134 `ip-address` 10.2.0 → 10.4.0
- #135 `undici` 6.27.0 → 6.28.0（ルートの `package-lock.json`）
- #139 `js-yaml` 4.3.0 → 4.3.1

マージ後、main で Frontend CI / Minify / pages build がいずれも success。オープンPR・main 以外のリモートブランチはゼロになった。

**関連ファイル**

- `.github/workflows/fetch-heatstroke-alert.yml` / `progress.md` / `package.json` / `package-lock.json` / `.github/workflows/frontend-ci.yml`

**残タスク**

- **Dependabot アラート5件（high 1 / medium 4）が未解消**。対象は `warning-worker/package-lock.json` の `undici` 7.28.0（脆弱範囲 `>= 7.0.0, < 7.29.0`）。これは `wrangler 4.114.0` → `miniflare 4.20260722.0` が **`undici` を `7.28.0` で完全固定**しているための推移的 devDependency で、`undici` 単体では上げられない。解消には `wrangler` の更新（最新 4.120.0）が必要。デプロイ用CLIのみで Worker ランタイムには載らないため実害は限定的だが、依存の更新幅が大きいので要相談（CLAUDE.md「大きな依存関係変更」）。
- 2026-08-08 時点の12件（high 3 / moderate 9）は上記5件を残して解消。

## 完了済み（2026-08-08・続き）

### ドキュメント追従（README / DESIGN）

下の不具合修正（PR #141、マージ済み）で確定した仕様を、参照される場所へ反映した。コード変更なし。

- **README に「オフライン対応とキャッシュ戦略（PWA）」を新設**: これまで README は Service Worker に一切触れておらず、`sw.js` を読まないとキャッシュ方針が分からなかった。対象別の戦略（`data/*.json`＝ネットワーク優先・保存しない／ナビゲーション＝ネットワーク優先／静的アセット＝Stale-While-Revalidate）を表で明記し、**静的アセットを Cache-First にしてはいけない理由**（`index.html` がクエリ無し固定URLで参照するため、修正が永久に届かなくなる）を再発防止として書き残した。`sw-register.js` の「置き換え時だけ再読み込み」条件と `CACHE_NAME` の更新手順も追記。「使用技術・API」に PWA 行を追加。
- **DESIGN.md 追従（CLAUDE.md の規約どおり）**: (1) フローティングアラートに `body.has-floating-alert` の余白確保と `setFloatingAlert()` への集約を明記。(2) データ鮮度の節に「`.section-error` は成功時に必ず消す（`setSectionError()`）」「全面エラーは初期表示前に限る」を追加。(3) ボタンの節に「更新日時ボタンの右寄せは flex。`float`＋`overflow:hidden` は使わない（フォーカスリングが欠ける）」を追加。(4) ブランドグラデに標準 `background-clip` 併記の必須化を明記。

**関連ファイル**

- `README.md` / `DESIGN.md`

## 完了済み（2026-08-08）

### 不具合修正（配信・エラー表示・表示欠落）＋モダン化（PR #141 マージ済み）

実ブラウザ（Chromium/Playwright、375〜390px）で修正前後を計測して確認した5件。

- **PWAに新しいCSS/JSが永久に届かない（最重要）**: `sw.js` の静的アセットが **Cache-First かつ再検証なし**だったため、`minify.yml` が更新した `style.min.css` / `app.min.js` は `CACHE_NAME` を手で上げるまで古いまま配信され続けていた。`index.html` はクエリ無しの固定URLで参照するため、他に更新経路がない。**Stale-While-Revalidate** に変更（キャッシュがあれば即返して描画をブロックせず＝原則2、裏で取得して次回に反映）。`CACHE_NAME` を v16→v17。実測：旧=リロード2回してもデプロイ内容が反映されず、新=リロード2回目で反映。
- **初回訪問が必ず二重読み込みになる**: `skipWaiting()`+`claim()` は**初回登録でも `controllerchange` を発火**するため、`sw-register.js` がその場で `location.reload()` していた。新規訪問者は毎回フルリロード＋データ再取得（原則2・3に反する）。登録時に既存コントローラの有無を記録し、**置き換え時だけ**再読み込みするよう変更。実測：メインフレームのナビゲーション 旧2回 → 新1回。
- **復旧してもセクションのエラー行が消えない**: 天気予報・波・風・警報の各セクションは失敗時に `style.display="block"` でエラーを出すだけで、**成功パスで消していなかった**。3時間ごとの自動更新・手動更新で再取得に成功しても「取得に失敗しました」が正常なデータの横に残り続ける（誤読の原因＝原則1）。`setSectionError()` を追加し4セクションの成功時に確実に消す。実測：失敗→`block`、その後の手動更新成功→`none`。
- **当日ぶんの極値が無い日にタイドグラフごと消える**: `displayTideData()` が「満潮・干潮: データなし」を出した時点で `return` しており、**複数日データ（`forecast`）があってもグラフを描かずに終わっていた**。テキストとグラフを分離し、`chartExtremes` があれば描画する。`drawTideChart()` にも要素欠落時のガードを追加（例外がグローバル境界に届いて全面エラーへ倒れるのを防ぐ）。
- **表示済みなのに全面エラーへ倒れる**: `_showGlobalError()` が `error`/`unhandledrejection` で無条件に「データの取得に失敗しました」を出すため、描画後の想定外の例外（グラフ操作中など）で**正常なデータの上にエラーが残り続けていた**。境界の目的は骨組み残り・白画面の救済なので、`#weather-content` が表示済みなら何もしないよう限定。各セクションは個別のエラーUIと鮮度注記を持つ。
- **警報バーがフッターに重なる**: `.floating-alert` は `position:fixed` で画面下端に出るのに `body` 側の余白が無く、発令中はフッター最終行が読めなかった。`setFloatingAlert()` に集約して表示中だけ `body.has-floating-alert` を付け、余白（safe-area 込み）とトーストの位置を確保。実測：修正後は最下部までスクロールしても重なり無し。
- **モダン化（DESIGN.md 準拠、見た目の変更なし）**: ロゴのグラデ文字に標準 `background-clip: text` を併記（接頭辞のみだと将来 `-webkit-text-fill-color: transparent` だけが残り不可視化する）。更新日時ボタンの `float: right`+`overflow:hidden` のクリアフィックスを flex 右寄せへ（`overflow:hidden` はフォーカスリングの欠けも招いていた）。注釈・免責に `text-wrap: pretty`。

**検証**

- `eslint` / `prettier --check` クリーン、`pytest tests` 54件成功。
- `bundle exec jekyll build` → `pa11y-ci`（WCAG2AA）**0 errors**。
- Playwright（Chromium 390×844）で通常表示・警報発令時・当日極値なし・取得失敗→復旧を再現。`pageerror` 0件。

**関連ファイル**

- `sw.js` / `assets/js/sw-register.js` / `assets/js/app.js` / `assets/css/style.css`

## 完了済み（2026-08-07・続き2）

### 前回セッションで「要相談」として残した推奨修正の実装

- **潮汐の年跨ぎを根治（cron 前倒し＋翌年ぶん併合）**: 前回はフォールバック側で塞いだだけだったため、JST 1/1 は Stormglass 依存（＝APIキー未設定なら空表示）のままだった。根治として2点。(1) `update-jma-tide.yml` に **12/20 15:05 UTC（= JST 12/21 0:05）の cron を追加**（既存の 1/1・7/1 は保険として維持。年3回＝三原則3の範囲内）。(2) `generate_tide.py` が当年に加えて**翌年ぶんも取得して併合**するよう変更。`tide_data.json` は日付キーの辞書なので、年末時点で翌年ぶんを持っていれば JST 1/1 も当日キーが引ける。翌年ぶんは気象庁の公開時期次第で404になるため、取得できなければ当年ぶんのみで正常終了する（当年ぶんの失敗は従来どおり exit 1）。あわせて `datetime.now().year`（UTC）を `now_jst().year` に是正。回帰テスト3件追加（併合／翌年欠落は非致命／当年失敗は異常終了）。
- **波グラフ右端の空白を解消**: x軸は「当日最初の干満潮時刻＋48h」なので右端は翌々日の未明まで伸びるのに、`fetchWaveGuidance()` のフィルタが翌々日を **`T00:00` の1点しか通していなかった**。実物の `app.js` を vm で走らせて計測したところ**右端に5.2時間の空白**が出ていた。フィルタを `CHART_DAYS+1` 日ぶん丸ごと通すよう変更し、実際の表示範囲での切り出しは `drawWaveCombinedChart()` 側へ移動（原点が確定するのは潮汐の到着後のため）。切り出しは前後1コマ（3時間）ぶんを含めて線が両端まで届くようにし、副次的に**画面外の値が波高軸のスケールを引き伸ばす問題**も解消。修正後は未カバー 0h。
- **Dependabot の失敗（前回の申し送り）**: 調査の結果、**コード変更は不要**と判断。`npm audit` では4件（undici / ip-address / js-yaml / brace-expansion）すべて `fixAvailable: true` で、**Dependabot は既に修正PRを開いていた**（#134 ip-address 10.2.0→10.4.0、#135 undici 6.27.0→6.28.0、#139 js-yaml 4.3.0→4.3.1）。再取得すると3件とも `mergeable=true / clean`。02:48 の失敗 run は main への push を受けた再評価であり、PR 自体は健全。ここで `package-lock.json` を手で書き換えると**これらのPRと衝突・重複**するため実施せず、既存PRのマージを推奨する。なお対象は全て devDependencies（`pa11y-ci`→`cheerio`→`undici`、`socks`→`ip-address` 等のCIツール依存）で、**公開サイトには同梱されない**。

**検証**

- `pytest tests` 54件成功（+3）。`eslint` / `prettier --check` / `node --check` / 全YAMLパース クリーン。
- 波グラフ右端は vm 上の実行で修正前 5.2h 空白 → 修正後 0h を確認。x軸原点そろえの既存検証（到着順2通り）も引き続き OK。
- 気象庁エンドポイントは本環境から到達不可のため、**翌年ぶんURLの実在・公開時期は未確認**。取得できない場合は当年ぶんのみで正常終了する設計にして影響を封じている。

**関連ファイル**

- `scripts/generate_tide.py` / `tests/test_generate_tide.py` / `.github/workflows/update-jma-tide.yml` / `assets/js/app.js`

## 完了済み（2026-08-07・続き）

### コード全体レビュー：取得先との齟齬・時刻境界バグの是正

- **Actions の相互キャンセル（本命・実害確認済み）**: 全7ワークフローが `concurrency: group: data-push` を共有していた。GitHub は1グループにつき _running 1 + pending 1_ しか保持せず、新しい run が入ると**待機中の run を別ワークフローのものでもキャンセルする**（`cancel-in-progress: false` は「実行中を守る」だけで待機中は守らない）。実測: `Update Daily Data`（run 31121321206）は 16:52 UTC 投入 → 17:19 に 30分cronの Open-Meteo に押し出されて `cancelled`、`runner_name` は空＝ランナー未割当。同様に Open-Meteo 自身も 18:25 投入分が 18:40 に次回分で潰されていた。結果 `moon_daily.json` / `tide_widget.json` が 8/6 のまま停止。→ `group: data-push-${{ github.workflow }}` にスコープを分離。跨ワークフローの push 競合は既存の `git pull --rebase` リトライループが吸収する（cron の頻度・本数は不変＝三原則3順守）。
- **日次ジョブの部分成功が捨てられる**: `extract_daily_data.py` は月齢・潮汐の片方でも失敗すると `sys.exit(1)`。書き出し済みの成功分があっても後続の「Commit and push」ステップが丸ごとスキップされていた。→ 該当ステップに `if: always()`（異常通知は exit code のまま維持）。
- **潮汐の年跨ぎ空表示**: `build_tide_widget()` の分岐が `if all_tides:` だったため、`tide_data.json` が前年ぶんしか無い1/1 JST は「真だが当日キーは引けない」状態を素通しし、`today`/`forecast` が空のウィジェットを出力 → フロントが「潮汐データの取得に失敗しました」になる（`update-jma-tide` の cron は 1/1 15:05 UTC ＝ JST 1/2 0:05 のため、JST 1/1 は丸一日この状態）。→ 判定を「当日分の極値があるか」に変更し Stormglass フォールバックへ正しく抜けるよう是正。`ok_tide` の成否判定も同基準に揃え、フォールバックした事実を握り潰さないようにした。回帰テスト3件を追加（修正前は落ちることを確認済み）。
- **キャッシュバスターの UTC/JST 齟齬**: `calculateTide()` / `fetchTideExtremes()` の日付キーが `toISOString().slice(0,10)`（UTC基準）。日次ジョブは JST 0:05 更新のため、**JST 0〜9時のあいだキーが前日のまま**で、更新済みの月齢・潮汐表を最大9時間拾えなかった。→ 既存の `toJstDateStr()` に統一。
- **設定の一元管理からの漏れ（FORK.md の前提との齟齬）**: (1) CSP `connect-src` が警報Worker URL をリテラル直書きで、`_data/site.json` の `warning_api_url` を差し替えても CSP 側だけ取り残され**ライブ取得が黙ってブロックされスナップショットに落ちる**状態だった → Liquid でオリジンを自動展開（URL未設定・キー欠落・別URLの4パターンで描画検証、既存構成では出力バイト一致）。(2) `fetchJmaForecast()` が予報区 `140010` と気温地点 `46106` をハードコード → `jma.forecast_area_code` / 新設 `jma.forecast_temp_code` 参照に変更。いずれも FORK.md の表に追記。
- **細部**: 極値が1件しか無い日に `Math.min(...[])`＝`Infinity` が潮汐グラフのY軸へ渡る経路をガード。`_config.yml` の月齢元データ除外を `data/mooninfo_2026.json` → `data/mooninfo_*.json` に一般化（年を直書きすると翌年ぶんが除外から漏れ約2MBが公開ビルドに混入する。Jekyll の `EntryFilter` で 2026/2027 とも除外されることを実機確認）。`sw.js` を `chigalog-v15` にバンプ。

**同セッション 追加分（整合性検証で判明した積み残し）**

- **潮汐/波グラフのx軸原点ズレ（到着順依存）**: `drawTideChart()` は `chartXMin` を無条件で当日最初の極値に上書きするが、`drawWaveCombinedChart()` は `chartXMin` が null のときだけ暫定原点（当日4:00 JST）を使う。両者は `Promise.allSettled` の並行取得で**到着順が不定**なため、波が先着すると波グラフだけ暫定原点のまま取り残される。2つのグラフは `scrollLeft` を相互同期しているので、時刻軸が無言でズレる。実物の `app.js` を Node の `vm` 上でスタブ実行して検証したところ、8/7（当日最初の極値 05:10）では **wave先着時に70分＝約16pxのズレ**を再現（14px/h × 672px 幅）。極値が0:15等なら3時間超のズレになり得る。→ 描画元データを `waveChartData` に保持し、潮汐が後着で原点を動かした場合のみ波グラフを同一原点で描き直す。両順序で `xMin` が一致することを確認（修正を外すと再現、戻すと解消）。
- **Open-Meteo 障害が気象庁警報の更新を巻き添えにする**: `fetch-openmeteo.yml` は1ジョブで Open-Meteo →警報→熱中症→commit を直列実行する。`fetch_openmeteo.py` は必須データ欠落で `raise` するため、既定の `if: success()` により**Open-Meteo が落ちただけで30分ごとの防災情報（警報）の取得・コミットまで丸ごとスキップ**されていた。前セッション(#136)が熱中症で潰した不具合と同種で、`fetch_openmeteo.py` が先頭ステップである点が見落とされていた。→ 後続3ステップに `if: ${{ !cancelled() }}`。各スクリプトは失敗時に既存ファイルを温存する設計なので独立実行して安全。
- **`if: always()` → `!cancelled()`**: 前段で入れた日次ジョブの条件は、キャンセル時にもコミットを走らせてしまう。キャンセル時は実行しない `!cancelled()` に是正。
- **exclude 漏れで非公開想定のファイルが公開されていた**: `_config.yml` の独自 `exclude:` は Jekyll 既定値を丸ごと上書きするが、`node_modules` の再宣言が漏れていた（progress.md に「ローカルビルドが落ちる既存の環境要因」として残っていた事象の正体）。さらに `tests/`・`warning-worker/`・`package.json`・`package-lock.json` は exclude 対象に無く、**実際に公開ビルドへ出力されていた（計約280KB）**。CLAUDE.md の「ソース以外はビルド除外」方針との齟齬。→ いずれも追加。Jekyll の `EntryFilter` を実際に走らせ、公開対象トップレベルから除外されること・サイト本体（`index.html`/`assets`/`data`/`sw.js` 等）が影響を受けないことを確認。トップレベルのディレクトリ指定は**末尾スラッシュ無し**でないとマッチしない点も実測で確認済み（`node_modules/` では効かない）。
- **FORK.md**: `warning-worker/src/index.js` は `_data/site.json` を読まない独立デプロイのため、フォーク時に手動で書き換える箇所として §4 に追記。

**検証**

- `pytest tests` 51件成功（+3）。`npx eslint assets/js/app.js` / `npx prettier --check` / `node --check` ともにクリーン。全 YAML のパース確認済み。
- `extract_daily_data.py` を実データのコピー上で実行し、通常経路が `source=気象庁` / exit 0 のままであることを確認。
- CSP は Liquid を4パターン（URL設定済み/空文字/キー欠落/別URL）で描画検証。加えて PR #138 の pa11y ジョブが実際に `bundle exec jekyll build` を通しており、CI 3件すべて green。
- グラフ原点の修正は Node の `vm` 上で実物の `app.js` を実行し、到着順2通りで検証（回帰スクリプトはスクラッチ領域のみ・リポジトリ非追跡）。
- 気象庁・環境省の各エンドポイントはこの実行環境からは到達不可（プロキシが 403）。上流レスポンス形式の実地照合はできていないため、判断はリポジトリ内の実取得済み JSON とコードのみに基づく。

**未対応（要相談）**

- 潮汐の年跨ぎは今回フォールバック側で塞いだが、根治は `update-jma-tide.yml` の cron を年末（例: 12/25）へ前倒しすること。cron 変更は要相談（三原則3）のため見送り。
- 波グラフのx軸右端（当日最初の極値+48h）に対し波浪ガイダンスのデータは翌々日0:00までしか無く、右端に最大数時間の空白が残る（従来からの挙動、今回は不変）。

**関連ファイル**

- `.github/workflows/*.yml`（7ファイル）/ `scripts/extract_daily_data.py` / `tests/test_extract_daily_data.py`
- `assets/js/app.js` / `index.html` / `_data/site.json` / `_config.yml` / `sw.js` / `FORK.md` / `README.md`

## 完了済み（2026-08-07）

### Actions失敗の原因調査・修正（Fetch Open-Meteo Data / Update Daily Data）

- **報告事象**: 8/6夜「Fetch Open-Meteo Data」失敗、8/7「Update Daily Data」全ジョブキャンセル。
- **原因**: `scripts/fetch_heatstroke_alert.py` が環境省WBGT CSV（当日・前日×4時刻ぶんの候補URL）を全滅（実ログでは `403 Forbidden`）すると `RuntimeError` を送出していた。この呼び出しは `fetch-openmeteo.yml` の最終ステップのため、直前に成功していた Open-Meteo（海面・風）・気象庁警報データの「Commit and push」ステップまでスキップされ、正常取得できていたデータもコミットされずジョブ全体が失敗扱いになっていた。全ワークフローが `concurrency: group: data-push` を共有しているため、この失敗が繰り返される中で「Update Daily Data」等の後続スケジュール実行がキュー詰まりでキャンセルされる一因にもなっていたと推定（現在は再発なし・キュー内ジョブなしを確認）。
- **修正**: `scripts/fetch_warning.py` と同じ「取得失敗時は警告ログを出し既存ファイルを保持して正常終了」方式に統一（`raise RuntimeError` を削除）。他スクリプトの `raise`/`sys.exit` 箇所（`fetch_openmeteo.py` 必須データ欠落、`fetch_forecast.py` 既存ファイルも無い場合、`generate_tide.py`/`extract_daily_data.py`）は単独ステップの一次データ取得で他ステップをブロックしないため対象外と判断。
- **検証**: `pytest tests`（48件）成功。マージ後 `fetch-openmeteo.yml` 実行（2026-08-07T00:24 UTC）が成功したことを確認。

**関連ファイル**

- `scripts/fetch_heatstroke_alert.py`

**PR**: [#136](https://github.com/surf90/chiga-log/pull/136)（マージ済み）

## 完了済み（2026-07-27・続き）

### ヘッダー／フッターのモダン化＋鮮度警告の誤認防止

- **スクロール追従サイトバー（`#site-bar`）**: 縦に長い1ページ構成でヒーローヘッダー（サイト名）が画面外に出た後もサイト名を見失わせないため、`<header>` が非交差になったら上端に「ちがログ｜茅ヶ崎の海情報」の細いガラス調バーを表示する。`.container` が `overflow:hidden` のため `position:sticky` は効かず、コンテナ外に `position:fixed; z-index:900` で配置（`.skip-link` 1000 / `#toast` 9999 の下）。表示制御は `IntersectionObserver` 1つのみ、scroll イベント購読は使わない（三原則2）。非対応環境では常に非表示（安全な劣化）。アンカー移動先がバーに隠れないよう `.weather-box` の `scroll-margin-top` を `12px`→`56px` に変更。
- **フッターをカードからテキストへ変更**: 当初チップ化・リンク強調を提案したが、「フッターのリンクは閲覧時の重要度が低く、目立たせるとゴチャつく」との判断で撤回。最終的に `.footer` の背景・枠・角丸・影を廃し、上端 `1px solid var(--hairline)` の区切り線のみのテキスト形式に変更（構造・文言・リンク先は無変更）。
- **ページ上部の全体鮮度バナーを廃止（`#stale-banner`）**: 従来は `weather_marine.json`（30分更新）の鮮度のみで判定し、遅延時にページ最上部へバナーを出していたが、風予報だけが遅延しているケースでも「更新が停止している可能性」という文言が全データに対する不信感を与えてしまう問題があった。GitHub Actions のスケジュール遅延はデータ種別ごとに独立して起きるため、全体バナーを廃止し、影響するカードにだけ注記する方式に統一。「現在の気温･風」カードに `#marine-stale`（既存 `.stale-note` と同じ見た目）を新設し、`weather_marine` の鮮度・取得失敗をそこに限定して表示。副次的に、`#amedas-stale`（前回値引き継ぎの注記）がパイプライン全体の stale 判定に連動して誤って「取得失敗」と表示される不具合も修正（アメダス自身の `stale` フラグまたは `weather_marine` 取得失敗時のみ点灯するよう是正）。
- **Service Worker キャッシュ更新漏れの修正**: 上記フッター修正が `chigalog-v13` のまま再訪ユーザーに反映されない事象があり、`CACHE_NAME` を `chigalog-v14` へ更新（CSS/JS変更時は毎回バンプする既存運用の徹底漏れ）。

**判断: 変更しないこととした点**

- `.current-time.is-stale`（更新日時の赤字化＋経過時間表示）は維持。全体の鮮度を示す控えめな手掛かりを完全に無くすのは三原則1に反すると判断。バナーのような赤枠ではなく既存の更新日時表示が赤くなるだけなので、他データへの誤認は招かない。

**検証**

- `npx prettier --write` / `npx eslint assets/js/app.js`（`eslint.config.js` に `IntersectionObserver` global 追加）ともにエラーなし。
- `bundle exec jekyll build` はローカルの `node_modules/` が `_config.yml` の exclude 対象外なため失敗する（**main でも再現する既存の環境要因**、CI は `npm ci` 前に build するため無関係）。`node_modules` を一時退避してビルドし、生成 HTML に `#site-bar` が正しく出力されることを確認。
- デプロイ済み `style.min.css` にフッター修正が正しく反映されていることを確認した上で、原因を Service Worker のキャッシュ版数バンプ漏れと特定（v13→v14）。

**関連ファイル**

- `index.html` / `assets/css/style.css` / `assets/js/app.js` / `eslint.config.js` / `sw.js`
- `DESIGN.md`（サイトバー・フッター・鮮度表示の節を更新）/ `README.md`（鮮度表示の説明を実装に追従）

**残タスク**

- ~~未使用ブランチ `claude/fix-errors-bugs-vulnerabilities-sri5yl` の削除~~（2026-08-10 に削除済み）。
- 風予報等のデータ取得スケジュール自体の遅延は本セッションの対象外（`gh workflow run fetch-openmeteo.yml` で手動復旧可能）。

## 完了済み（2026-07-27）

### デザイン・動作・UX の改善

実ブラウザ（Chromium / 390px・320px / light・dark）で実サイトをレンダリングし、DOM を計測して評価した結果に基づく改善。

- **グラフが「今」の位置へスクロールしていなかった（動作バグ）**: `drawTideChart()` / `drawWaveCombinedChart()` は末尾で `scrollChartsToNow()` を呼ぶが、その時点では `#weather-content` がまだ `display:none` で、`scrollWidth === clientWidth === 0` のため `scrollLeft` 代入が 0 にクランプされ黙って捨てられていた。結果、両グラフは常に一番左（当日最初の満潮/干潮）から始まり、オレンジの現在時刻ラインは終日ほぼ画面外だった。コンテンツ表示直後に `requestAnimationFrame(scrollChartsToNow)` で寄せ直すよう修正。あわせて潮汐取得失敗時に `chartXMin` が `null` のままで波グラフだけ取り残される経路も塞いだ。
- **波グラフの凡例「周期 [秒]」が画面外だった（動作バグ）**: 凡例を横スクロール領域の内側（幅672px）に挿入していたため `justify-content: space-between` が 672px 幅で効き、2項目目が `left=653px`（ビューポート390pxの外）に飛んでいた。スクロールしない親へ挿入するよう変更し、可視領域の両端に並ぶようにした。
- **Y軸の固定表示（新規 `stickyYAxisPlugin`）**: 上記スクロール修正により、今度はキャンバス左端のY軸が画面外へ出る副作用が判明。スクロール量ぶん平行移動した位置に軸幅の下地（`--box-bg`）をキャンバス全高で塗り、Chart.js の scale を再描画することで、左軸（潮位 m・波高 m）を表示領域の左端、右軸（周期 秒）を右端へ貼り付けた。スクロール中の再描画は `requestAnimationFrame` で1フレーム1回に間引く。既存 `nowLinePlugin` と同じ自前プラグイン方式（ライブラリ追加なし＝三原則2）。
- **横スクロールの右端フェード**: モバイルではスクロールバーが出ず2日目のデータに気づけないため、`.chart-scroll` に `mask-image` で右端20pxのフェードを追加。固定表示の周期軸が重なるので不透明度 `0.45` で止め、目盛りが読める濃さを保つ。追加DOM・追加JSなし。
- **風予報を「直近3件は常時表示、残りを折りたたみ」に変更**: 従来は全件がトグルの内側にあり、開かないと1件も見えなかった。`WIND_VISIBLE_COUNT = 3` を導入し、4件目以降を `#wind-forecast-more` へ分離。残りが0件（夜間など）はトグルごと非表示にし、押しても何も出ないボタンを見せない。ラベルは折りたたむ側の時間帯を示す（`残りの予想風（12:00-23:00）を表示 ▼`）。行生成を `createWindRow()` に切り出し、「データなし」行・常時表示側・折りたたみ側で共通化した（従来は重複）。
- **天気テキストの可読性**: 「くもり　夜　雨　所により　雷を伴い…」が全角スペース区切りのまま右寄せで折り返し、行頭が揃わず読みにくかった。既に風へ適用済みの `.replace(/　/g, " ")` を天気にも適用し、`#jma-weather` のみ左寄せにした。

**検証（実ブラウザでの計測）**

| 項目                    | 修正前                 | 修正後                    |
| ----------------------- | ---------------------- | ------------------------- |
| 潮汐グラフ `scrollLeft` | `0`（max 366）         | `366`                     |
| 波グラフ `scrollLeft`   | `0`（max 372）         | `366`                     |
| 凡例「周期 [秒]」の位置 | `left=653px`（画面外） | `left=287px`（画面内）    |
| Y軸ラベル               | スクロール時に画面外   | 左右とも端に固定          |
| 風予報の初期表示        | 0行（全件折りたたみ）  | 3行＋残り12行を折りたたみ |
| 天気テキスト            | 右寄せ・全角スペース   | 左寄せ・半角スペース      |

- 320 / 360 / 375 / 390 / 414 / 600px で横溢れなし（修正前と同一）。light / dark 双方でフルページ確認済み。`pageerror` なし。
- pytest 48件、ESLint、Prettier `--check`、`node --check`、Worker単体テスト3件すべて成功。
- `eslint.config.js` の browser globals に `getComputedStyle` を追加（`stickyYAxisPlugin` が下地色を CSS 変数から読むため）。

**今回対象外（報告のみ）**

- 320px での見出し折返し（MARINE / WIND が2行）。横溢れは無く実害が小さいため見送り。
- `.stale-inline` の重複定義（`style.css` に2ブロック）。動作影響なし。
- 風予報が夜間に少なくなる件（`dateJst === todayJst` かつ 4〜23時で絞るため）。翌日分を含めるとセクションの意味とラベルが変わりプロダクト判断が要るため見送り。ただし上記の常時表示化で、少ない時間帯でも折りたたまず読めるようになった。

**関連ファイル**

- `assets/js/app.js` / `assets/css/style.css` / `index.html` / `eslint.config.js`
- `DESIGN.md`（チャート・風予報の節を追記）/ `README.md`（グラフの見かた・風予報の表示方法）

### オープンPR6件のマージとブランチ整理

- **#131**（上記UX改善）を draft 解除して squash マージ。CI（ESLint + Prettier / pa11y WCAG2AA）はいずれも success。
- **dependabot 5件**を依存関係の妥当性（差分がバージョンピンのSHA更新のみであること）を確認のうえ squash マージ。
  - #124 `actions/setup-python` 6.3.0 → 7.0.0
  - #128 `ruby/setup-ruby` 1.318.0 → 1.320.0
  - #125 `prettier` 3.9.5 → 3.9.6
  - #127 `wait-on` 9.0.10 → 9.1.0
  - #126 `actions/checkout` 5.0.1 → 7.0.1（#124 と隣接行で衝突したため `@dependabot rebase` を依頼し、リベース後にマージ）
- マージ後、`test.yml` が新しい `actions/checkout@v7.0.1` + `actions/setup-python@v7.0.0` で success することを確認。
- dependabot の5ブランチはマージ時に自動削除。`claude/fix-errors-bugs-vulnerabilities-sri5yl` は本セッションの git プロキシが ref 削除の push を拒否したため、**手動削除が必要**（内容は `738a4fb` として main に取り込み済みで削除して問題なし）。
- **残課題（未対応・軽微）**: #126 のマージにより `fetch-heatstroke-alert.yml:24` の `actions/checkout` SHA ピンが `v7.0.1` 相当に更新されたが、コメント表記が `# v5` のまま（dependabot の生成ミス）。動作影響なし。次回の軽微修正時にコメントのみ `# v7.0.1` へ直す。

## 完了済み（2026-07-26）

### 不具合・脆弱性の修正

- **Webフォントが適用されない（CSP違反）**: `index.html` のフォント用 `<link>` が `onload="this.media='all'"` を使っていたが、CSP `script-src 'self'`（`script-src-attr` がフォールバック）下ではインラインイベントハンドラが実行されずブロックされていた。属性を `data-media-onload="all"` に変え、`app.js` の `applyDeferredStyles()` が読込完了後に `media` を切り替える方式へ移行（非ブロック読込は維持）。
- **更新が恒久停止する競合**: `fetchWeatherData()` が `_isFetching = true` の後、`try` の外でDOM操作していたため、そこで例外が出ると `finally` に到達せずフラグが立ちっぱなしになり、以後の自動更新・手動更新・可視化復帰がすべて無視されていた。事前UI更新を `try` 内へ移し、要素をnullガード。
- **潮汐・津波の時刻が閲覧端末のTZ依存**: 満潮・干潮時刻とグラフラベル（`toLocaleTimeString`）、津波の第一波到達時刻（`getHours`）が端末TZで描画され、JST以外の端末で誤った時刻を表示していた。`formatJstHhMm()` を追加しJST固定に統一。
- **Service Workerのオリジン判定が前方一致**: `url.startsWith(self.location.origin)` は `https://<origin>.attacker.test/` のような別ドメインも自オリジンと誤判定するため、`URL` を解析して `origin` を厳密比較する方式へ変更（解析不能なURLは素通し）。
- **波浪ガイダンスの日付算出**: `new Date(new Date().toLocaleString("en-US", …))` はロケール文字列の再パースが実装依存（Invalid Date になり得る）だったため、既存の `toJstDateStr()` によるJSTオフセット加算へ統一。`data[].time` の型チェックも追加。
- **その他の堅牢化**: 月齢のNaN/範囲外を不採用（`月齢: NaN` 表示の防止）、風向の負値・非数値・null正規化（`undefined` / 誤った「北」表示の防止）、`fetchTsunami` / `showToast` / `hideToast` / `calculateTide` の要素nullガード、`syncChartScroll` が要素未生成時に同期を恒久無効化する問題の修正。
- **データ生成スクリプト**: `extract_moon_today()` がNASA月齢JSONのキー欠落・非数値で `KeyError` を投げ、後続の `tide_widget.json` 生成まで巻き添えで落ちていたため、`None` を返してフォールバック経路に載せるよう修正（単体テスト3件追加）。
- **ESLint設定**: `npx eslint .` がLiquidテンプレート `assets/js/site-config.js` でパースエラーになっていたため、生成物・ベンダを `ignores` に追加（CIは `app.js` 個別指定のため従来から緑）。
- **PWA反映**: Service Workerのキャッシュ名を `chigalog-v12` → `chigalog-v13` へ更新し、キャッシュ優先の `app.min.js` / `index.html` が旧版のまま残らないようにした。
- **重複解消（自己レビュー対応）**: 追加した `formatJstHhMm()` と既存 `formatJstHm()` が同じJST変換を別実装で持ち、引数型も `Date` / `ms` で不揃いだったため、`JST_OFFSET_MS` 加算方式に統一し引数を `ms` へ揃えた。`formatJstHm()` の出力は従来と完全一致（グラフのツールチップ表示は不変）。

**検証（実ブラウザでの修正前/後 A/B を含む）**

- 静的チェック: pytest 48件、ESLint（`npx eslint .`）、Prettier `--check`、`node --check`、Worker単体テスト3件すべて成功。GitHub Actions の `test` / `ESLint + Prettier` / `pa11y (WCAG2AA)` も成功。
- **CSP**: 最小再現ページで、旧 `onload` 属性は実際にブラウザが拒否（`Refused to execute inline event handler`）し `media="print"` のままCSSが適用されないこと、新方式では `media="all"` に切り替わり適用されることを Chromium で確認。
- **実サイト A/B**: `jekyll build` + `terser` した実ページを Chromium で読み込み比較（fonts.googleapis.com は到達不能環境のためスタブ応答）。

  | 項目                        | 修正前(main)                     | 修正後             |
  | --------------------------- | -------------------------------- | ------------------ |
  | フォントCSS適用             | 適用されず                       | 適用される         |
  | 潮汐（TZ=Asia/Tokyo）       | 満潮 00:54 / 16:36               | 満潮 00:54 / 16:36 |
  | 潮汐（TZ=America/New_York） | 満潮 11:54 / 03:36（順序も崩壊） | 満潮 00:54 / 16:36 |

- **手動更新パス**: 更新日時を2回連続クリックし、`データを更新中... ⏳` → 完了トースト → 再更新成功、`pageerror` なしを確認（`_isFetching` が正しく解放される）。
- **JST整形の等価性**: `formatJstHm()` の新旧実装を40万件 × 4タイムゾーンで比較し差分0。

**判断: 変更しないこととした点**

- `item.time` が不正な場合に潮汐時刻が `NaN:NaN` になり得る点。部分的にフィルタすると壊れたデータを一部だけ表示することになる一方、現状は `fetchTideExtremes` の `catch` が「※潮汐データの取得に失敗しました」を表示する＝三原則1（ダミー値で誤読を誘発しない）に沿った挙動のため、意図的に据え置いた。

**関連ファイル**

- `index.html` / `assets/js/app.js` / `sw.js` / `eslint.config.js`
- `scripts/extract_daily_data.py` / `tests/test_extract_daily_data.py`

**残タスク**

- なし（管理者の手動作業も不要）。`assets/js/app.min.js` / `style.min.css` は main マージ時に `minify.yml` が生成する。`warning-worker/` は未変更のため Cloudflare への手動デプロイも不要。

## 完了済み（2026-07-16）

### 熱中症警戒アラートカード

- **配信元**: 環境省「熱中症特別警戒情報・熱中症警戒情報」公式CSV。神奈川県（都道府県コード `14`）の正式発表フラグ `1` / `3` のみ抽出し、事前判定 `2` は表示しない。
- **表示位置・条件**: 発表中だけ「注意報・警報」の直下、「天気予報」の直上へ表示。通常警戒は黄〜黄橙の枠、特別警戒は濃いオレンジ枠。未発表・対象日外・取得失敗時はカード全体を非表示。
- **Actions遅延対策**: 専用 `fetch-heatstroke-alert.yml` を公式発表（05:00 / 14:00 / 17:00 JST）の25分・15分・5分前に実行。CSVを先行取得しても `publishedAt` までは表示せず、既存30分ワークフローも安全網として維持。
- **ブラウザ反映**: `data/heatstroke_alert.json` を5分粒度のキャッシュバスター付きで再取得し、発表前の「発表なし」がsessionStorageへ30分残る問題を回避。
- **検証**: 取得・フラグ・発表時刻・先行取得候補のテストを追加。全45テスト、ESLint、JavaScript構文、差分チェック成功。

## 完了済み（2026-07-14）

### 注意報・警報をCloudflare Worker経由の閲覧時取得へ移行

- **背景**: GitHub Actionsの定期実行を直近100件で検証。定期処理50件は全件成功していた一方、設定上30分ごとの `Fetch Open-Meteo Data` は実績33件で最短約59分・平均約108分・最大約230分の間隔があり、GitHubのschedule遅延・欠落可能性から注意報・警報の最新性を保証できなかった。
- **採用方式**: CORS非対応の気象庁レガシーフィード（`VPWS50/JPTF_jp.json`）をCloudflare Worker `chiga-log-warning-api` が閲覧時に取得し、茅ヶ崎市（`1420700`）だけを返すBFFへ移行。
- **公開URL**: `https://chiga-log-warning-api.delay-bot.workers.dev/warning`。Cloudflareのログインメール・Account IDは公開リポジトリへ記録しない。
- **負荷・鮮度**: Workerとブラウザへ `Cache-Control: public, max-age=60, s-maxage=60` を返し、気象庁へのアクセスを60秒単位で集約。フロントはページ表示時および表示中5分ごとに注意報・警報と津波情報を再確認。
- **CORS**: 本番 `https://surf90.github.io` とローカル確認用 `http://localhost:4000` / `http://127.0.0.1:4000` のみ許可。サイト側CSPの `connect-src` にWorkerドメインを追加。
- **障害時**: Worker取得失敗時は、既存のGitHub Actionsが生成する同一オリジン `data/warning_chigasaki.json` へフォールバック。Actions側の取得・既存ファイル温存処理は安全網として継続。
- **PWA反映**: Service Workerのキャッシュ名を `chigalog-v10` から `chigalog-v11` へ更新し、既存利用者のキャッシュ済み `app.min.js` を更新対象にした。
- **検証**: デプロイ済みWorkerが200応答、GitHub Pages OriginへのCORS、60秒キャッシュ、対象コード`1420700`を返すことを確認。Worker単体テスト3件成功、Wrangler dry-run・ESLint・Prettier・Jekyll build成功。
- **実サイト反映確認**: GitHub Pagesのコミット `5a73ef1` に対するデプロイ（Actions run `29305777433`）が成功。実サイトがWorker URL入り `site-config.js`、Worker許可済みCSP、Worker取得・フォールバック・5分更新入り `app.min.js`、`chigalog-v11` を配信していることを確認。
- **実ブラウザ確認**: 公開URLで注意報・警報セクションのロード完了、「✅ 現在、注意報・警報はありません」表示、CSPエラー・Worker失敗・フォールバック警告なしを確認。実Workerは確認時点の気象庁発表（2026-07-14 13:20 JST）を200で返した。
- **必須残タスク**: なし。現時点で管理者が実施すべき手動反映作業もなし。
- **今後の手動タスク**: `warning-worker/` のソースを変更した場合、GitHubへのpushだけではWorkerは更新されない。`npm test` → `npm run check` → `npx wrangler deploy --minify` を `warning-worker/` で実行してCloudflareへ手動反映する。
- **任意の運用改善**: Cloudflareダッシュボードでエラー・利用量を定期確認、障害/利用量通知の設定、GitHub ActionsによるWorkerデプロイ自動化を必要に応じて検討。独自ドメイン追加時はWorkerのCORS許可OriginとサイトCSPを同時更新する。
- **既存PWA利用者**: 開きっぱなしの端末では旧JSが一時的に残る場合があるが、次回の再読み込みまたはPWA再起動で `chigalog-v11` へ切り替わる。管理者作業は不要。

**関連ファイル**

- `warning-worker/` / `_data/site.json`
- `assets/js/app.js` / `assets/js/app.min.js`
- `index.html` / `sw.js` / `README.md` / `progress.md`

---

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

## 完了済み（2026-08-18）

### Dependabot 脆弱性対応（undici / brace-expansion）

- PR #149（`claude/dependabot-security-alerts-72gh6a` → main）でマージ済み
- `warning-worker`: `wrangler` 4.114.0 → 4.123.0 に更新し、依存の `undici` を `7.28.0` → `7.29.0` へ引き上げ。alert #6/#7/#8/#9/#10（応答デシンク・キャッシュ情報漏洩・CRLFインジェクション・Cookie属性インジェクション）を解消
- root: `npm audit fix` で `brace-expansion` を修正版へ更新（ついでに検出された High）
- 変更は `package-lock.json` / `warning-worker/package-lock.json` の2ファイルのみ。ビルド成果物・cron・ワークフロー定義は無変更
- CI（ESLint+Prettier / pa11y WCAG2AA）green を確認しマージ

**未解消（申し送り）**

- alert #19 `extract-zip`（symlink path traversal, High）: 上流に修正版が存在しない（`npm audit` 上も脆弱範囲は `<=2.0.1` で最新含む全バージョン）。`npm audit fix --force` は `pa11y-ci` を 3.1.0 へダウングレードするだけで、同じ脆弱な `extract-zip` を同梱するため実質的な修正にならず見送り。`pa11y-ci`（a11y CI専用・devDependencies）経由の間接依存で、Puppeteer が公式Chromiumビルドを HTTPS 取得する用途のみのため実害は限定的。上流にパッチが出た時点で `npm audit` に検出されるので、その際に再対応。

**関連ファイル**

- `package-lock.json` / `warning-worker/package-lock.json`
