# chiga-log

茅ヶ崎ヘッドランド（Tバー）、サザンビーチ茅ヶ崎など、茅ヶ崎海岸周辺のコンディション（潮汐・波・水温・天気）を確認できるWebツールです。
スマートフォン（iPhone/Android）およびPCのブラウザから直接利用できます。

## 特徴

- **ホーム画面アプリ化**: iOS/Androidのブラウザから「ホーム画面に追加」するとスタンドアロンアプリとして起動。バックグラウンド復帰時に自動でデータを最新化します。
- **レスポンシブ対応**: スマートフォンでの閲覧に最適化された、屋外でも見やすいレイアウトを採用しています。
- **視覚的な潮汐グラフ**: Chart.jsを用いた滑らかな曲線により、満潮・干潮のタイミングを直感的に把握できます。
- **自動データ更新**: GitHub Actionsを利用して定期的にデータを取得・生成することで、APIの制限を回避しつつ、最新の天気予報（forecast.json）や潮汐情報（tide_widget.json）を安定して配信しています。
- **データ鮮度の明示**: 各データの生成時刻（`updated_at`）を基準に鮮度を判定し、更新が停止している（Actions停止・API障害等）場合や古いデータのときは、画面上に警告バナー・セクション別注記を表示します。誤って古い情報を最新と誤読させません（詳細は下記「データ鮮度の表示と堅牢化」）。

## 使い方（WEBでの確認方法：推奨）

以下のURLにアクセスするだけで、いつでも最新の情報を確認できます。

https://surf90.github.io/chiga-log/

## 参照している位置情報について

> 以下の地点固有の値（座標・各種コード・地名）は **`_data/site.json` 1ファイルに集約**しています。別の海岸へフォークする際の変更手順は [FORK.md](FORK.md) を参照してください。

### 潮汐情報
* **月齢**: NASA SVS（Scientific Visualization Studio）の全地球（グローバル）データを使用。
* **潮回り**: 気象庁の湘南港（江の島）潮位観測所のデータ（`tide_data.json`）を優先的に使用。
* **バックアップ**: エラー発生時のみ、Stormglass APIによる推計データ（約25km四方グリッド）を使用。

### 波情報
* **最大波高・周期**: 気象庁の関東地方南部（相模湾から外房まで）の有義波高のデータを使用。

### 海面状況
* **波の高さ・海水温**: 茅ヶ崎ヘッドランド（北緯: `35.3175` / 東経: `139.4151`）を基準点としたOpen-Meteo海洋モデル（25km〜50km四方のグリッドデータ）を使用。
  * 範囲: 指定座標周辺の「沖合」の推計値です。 地形や風の影響を強く受ける波打ち際（サーフゾーン）の実際のコンディションとは異なる場合があります。

### 注意報・警報
* **注意報・警報**: 気象庁が発表する「茅ヶ崎市（コード: `1420700`）」の個別データを参照。
  * 取得元は気象庁レガシーフィード（`data.jma.go.jp` の `VPWS50/JPTF`、神奈川県）。bosai の警報JSON（`warning/140000.json`）は神奈川で更新が停止する事象が確認されたため使用しません。
  * レガシーフィードはCORS非対応のため、閲覧者のブラウザから [Cloudflare Worker](https://chiga-log-warning-api.delay-bot.workers.dev/warning)（`chiga-log-warning-api`）を経由して気象庁へアクセスします。Workerは閲覧時に茅ヶ崎分を抽出し、応答を60秒キャッシュします。
  * ページ表示時と表示中5分ごとに注意報・警報を再取得するため、GitHub Actionsのschedule遅延に依存せず最新発表へアクセスできます。
  * Worker障害時は `fetch-openmeteo.yml` が生成する `data/warning_chigasaki.json` へフォールバックします。`scripts/fetch_warning.py` が取得失敗した場合も既存ファイルを温存し、誤って「なし」表示にしません。

### 津波注意報・警報
* **津波情報**: 気象庁の津波予報区「相模湾・三浦半島（コード: `330`）」に**津波注意報・津波警報・大津波警報が発表されている時だけ**、ページ最上部に専用カードを表示します（津波予報のみ・解除時は非表示）。
  * 取得元は気象庁 bosai 津波フィード（一覧 `bosai/tsunami/data/list.json` → 詳細JSON）。**CORS対応のためクライアントから直接取得**します（警報と異なりBFF不要・GitHub Actions追加なし）。
  * 表示内容: 種別バッジ（大津波警報=紫 / 津波警報=赤 / 津波注意報=橙）・予報区名・予想の高さ・第一波到達時刻。取得失敗時はダミーを出さずカード非表示（三原則1）。

### 天気予報
* **天気予報**: 気象庁が発表する「神奈川県東部（コード: `140010`）」の予報区データを使用。
  * `scripts/fetch_forecast.py` は取得失敗・気象庁の仕様変更（想定外の構造）を検知した場合、`null` で既存ファイルを上書きせず**前回の有効データを温存**します（誤読防止・三原則1）。

### 風予報（時間別）
* **風速・風向・最大瞬間風速（翌日まで1時間ごと、昼間帯）**: 茅ヶ崎ヘッドランド（北緯: `35.3175` / 東経: `139.4151`）を基準点としたOpen-Meteo気象モデルを使用。参照時刻の1時間以内から20:00までを表示。

### 現在の天気
* **気温・湿度・風速・風向・降水量（現在値）**: 気象庁アメダス辻堂観測所（コード: `46141`）のデータを使用。

### データ鮮度の表示と堅牢化

外部ソースの障害やGitHub Actionsの停止（例: リポジトリオーナーのアカウント一時停止）でデータ更新が止まった際、古い情報を最新と誤読させないための仕組みです。

* **更新日時の是正**: 画面下部の「更新日時」は、閲覧者が取得した時刻ではなく**データの実際の生成時刻**（`weather_marine.json` の `updated_at`）と経過時間を表示します。
* **更新停止バナー**: 最も高頻度に更新されるデータ（`weather_marine.json`、30分ごと）が3時間以上古い、または取得できない場合、ページ最上部に「データ更新が停止している可能性があります」と表示します。
* **セクション別の鮮度注記**: 潮汐・波・天気・風・警報の各データが、種別ごとの閾値（更新頻度に応じて個別設定）を超えて古い場合に「データが古い可能性」を各セクションに注記します。生成時刻フィールドの表記差（`updated_at` / `fetchedAt` / `observed_at`）は内部で吸収するため、データ種別によらず同一ロジックで鮮度を判定します。
* **取得失敗の明示**: 津波・現況の取得失敗を「情報なし（平常）」と区別して明示します。
* **バックエンド温存**: データ取得スクリプトは取得失敗・仕様変更時に既存の有効データを温存し、`null`・空データでの上書きを防ぎます（`fetch_forecast.py` / `fetch_warning.py` / `fetch_openmeteo.py` ほか）。

> 注: オーナーのアカウント停止時はGitHub Actions自体が停止するため、リポジトリ内の監視では検知できません。上記の閲覧者側の鮮度表示が実質的な安全網です。


## 開発者・管理者向け情報
<details>
<summary><b>（クリックで展開）</b></summary>

## GitHub Actions シークレット

フォークして使う場合は以下のリポジトリシークレットを「Settings → Secrets and variables → Actions → New repository secret」で設定してください。

| 名前 | 用途 | 必須 |
|---|---|:-:|
| `STORMGLASS_API_KEY` | 気象庁潮汐データ欠損時のフォールバック（`scripts/extract_daily_data.py`） | 任意 |

未設定の場合、Stormglassフォールバックはスキップされ、気象庁データが取得できなければ「取得失敗」が表示されます（誤読防止のためダミー潮汐は表示しません）。

## Cloudflare Worker（注意報・警報API）

気象庁レガシーフィードのCORS制約を回避するため、`warning-worker/` のWorkerを使用します。公開URLや地点変更時に使用するAPI URLは `_data/site.json` の `jma.warning_api_url` で管理します。

処理経路:

```text
閲覧者のブラウザ → chiga-log-warning-api → 気象庁 VPWS50/JPTF
```

Cloudflareダッシュボードでは、対象アカウントを選択して **Workers & Pages → chiga-log-warning-api** からデプロイ状況・ログ・メトリクスを確認できます。ログインメールやAccount IDはリポジトリへ記録しません。

ローカルでのテストとデプロイ:

```bash
cd warning-worker
npm install
npm test
npm run check                 # wrangler deploy --dry-run
npx wrangler deploy --minify  # Cloudflareへ反映
```

Workerは `https://surf90.github.io`、`http://localhost:4000`、`http://127.0.0.1:4000` のOriginを許可しています。許可Originを変更する場合は `warning-worker/src/index.js` の一覧を更新し、テストとdry-run後に再デプロイしてください。

## 地点設定の一元化（フォーク時の変更箇所）

地点固有の値（緯度経度・JMA各種コード・地名）は **`_data/site.json` に集約**され、フロント（JS）・データ取得（Python）・HTML（Jekyll）の3者がここを参照します。別の海岸へ切り替える場合は基本このファイルだけを編集します。

- **JS**: Jekyll が `assets/js/site-config.js`（`_data/site.json` から生成）で `window.SITE_CONFIG` を供給。CSP `script-src 'self'` 適合のため外部JSとして読み込みます。
- **Python**: `scripts/_common.py` の `load_site_config()` が同ファイルを読み込み。
- いずれも**読み込み失敗時は各所のリテラルにフォールバック**するため、設定が無くても本家の挙動で動作します。

各フィールドの意味・JMAコードの調べ方・編集後の手順は [FORK.md](FORK.md) を参照してください。

## ローカル動作確認チェックリスト

`python -m http.server 8000` 起動後、ブラウザで http://localhost:8000 を開いて以下を確認:

> `localhost:8000` はWorkerのCORS許可対象外なので、注意報・警報はActions生成済みの `warning_chigasaki.json` へフォールバックします。Workerからのライブ取得を確認する場合は、Jekyllを `localhost:4000` で起動してください。

- [ ] ヒーローカード3枚（SEA / AIR / WIND）に `--` ではなく実数値が表示される
- [ ] 潮汐セクションに「大潮/中潮/...」と月齢が出る（「NASA」または「計算値」のラベル）
- [ ] 潮汐グラフと波グラフが2つとも描画され、スクロールが同期する
- [ ] 警報セクションが「✅ 現在、注意報・警報はありません」または該当バッジ
- [ ] 天気予報「天気/降水確率/最高最低」が `--` でない
- [ ] 風予報トグルを開くと時刻別の風速一覧が出る
- [ ] DevTools Console にエラーが出ていない

## 使い方（ローカルでの開発・確認方法）

本アプリは静的なHTML/JavaScriptで構築されていますが、潮汐データ（tide_widget.json）の読み込みに fetch APIを使用しています。
そのため、HTMLファイルを直接ブラウザで開いた場合（file:// プロトコル）、セキュリティ制限により実際のデータが読み込めず、プレビュー用のダミー波形が表示されます。

実際のデータを含めてローカルで動作確認をしたい場合:
簡易的なローカルサーバーを立ち上げて確認してください。ターミナルで本ディレクトリに移動し、以下のコマンドを実行します。
```
# Pythonがインストールされている場合
python -m http.server 8000
```

起動後、ブラウザで http://localhost:8000 にアクセスしてください。

## 🌕 月齢データ（mooninfo_YYYY.json）の年間更新手順

NASA SVS（Scientific Visualization Studio）が毎年公開している公式月齢データを手動で取得し、配置する手順です。

**推奨実行時期:** 毎年12月下旬〜1月上旬（翌年版のページとJSONファイルへのリンクが公開されたタイミング）

### 手順

**1. NASA SVSのページにアクセス**

ブラウザで以下のURLを開き、対象年の "Moon Phase and Libration YYYY" のページへ進みます：

```
https://svs.gsfc.nasa.gov/gallery/moonphase/
```

**2. JSONファイルのダウンロード**

各年のページ内に "the data in the table for all of YYYY can be downloaded as a **JSON file**" というリンクがあります。そこから `mooninfo_YYYY.json` をダウンロードします。

参考URLパターン（毎年パス内の数字が変わるため、必ず公式ページから取得してください）：
```
https://svs.gsfc.nasa.gov/vis/a000000/a005500/a005587/mooninfo_2026.json
```

**3. ファイルの配置**

ダウンロードしたファイルを `data/` ディレクトリに配置します。ファイル名は変更不要です：

```
data/
├── mooninfo_2026.json  ← 配置するファイル
└── tide_data.json
```

**4. コミット・プッシュ**

```bash
git add data/mooninfo_YYYY.json
git commit -m "Update: mooninfo_YYYY.json を追加"
git push
```

**補足**

- `mooninfo_YYYY.json`（約2MB）は `scripts/extract_daily_data.py` 専用の元データで、フロントは日次抽出後の `moon_daily.json` のみ参照します。容量削減のため `_config.yml` の `exclude:` で**公開ビルドから除外**（リポジトリには保持、Actions/スクリプトはリポジトリ直読みのため影響なし）。
- データはUTC（協定世界時）基準で1時間ごとに記録されています（1年分 = 8,760〜8,784エントリ）
- 日本時間（JST = UTC+9）の1月1日 0〜8時は、前年のJSONが参照されます。前年ファイルが存在しない場合は数式による概算値で自動補完されます
- 月齢の表示に "NASA" と出ていれば正常にNASAデータを参照中、"計算値" と出ていればフォールバック中です

---

## 🌊 潮汐データ（tide_data.json）の年間更新手順

気象庁のサイトから1年分の潮汐テキストデータを取得し、アプリ用のJSONファイルに変換する手順です。

**推奨実行時期:** 毎年12月下旬〜1月上旬（翌年分のデータが公開されたタイミング）

### 準備
本リポジトリの実行系スクリプト（`scripts/*.py`）は Python 3.10+ の**標準ライブラリのみ**で動作するため、追加のインストールは不要です。

`scripts/requirements.txt` には**開発時に任意で使う**ツール（テスト実行用の `pytest`）を記載しています。テストを走らせる場合のみ:

```bash
pip install -r scripts/requirements.txt
pytest tests
```

### 手順

**1. スクリプトの実行**

ターミナルを開き、スクリプトが保存されているディレクトリで以下のコマンドを実行します。
（※ファイル名は実際のPythonファイル名に読み替えてください）

```bash
python generate_tide.py
```

**2. 対象年の入力**

ターミナルに以下のプロンプトが表示されます。取得したい年を半角数字で入力し、Enterキーを押してください。
```
取得する年を西暦で入力してください（例: 2027）:
```
**3. 生成されたファイルの確認と配置**

処理が完了すると、同じディレクトリ内に tide_data.json が上書き（または新規作成）されます。
このファイルを、Webアプリの `data/` ディレクトリ内に配置して更新完了です。

**補足**

データの取得元: 気象庁 潮汐観測資料（湘南港・観測所コード `D8`）

```
https://www.data.jma.go.jp/kaiyou/data/db/tide/suisan/txt/<year>/D8.txt
```

`scripts/generate_tide.py` の `JMA_TIDE_URL` 定数で参照しています。気象庁側でパス構造が変更された場合は当該定数を更新してください。

`tide_data.json`（約150KB）は潮汐極値抽出（`extract_daily_data.py`）の元データで、フロントは抽出後の `tide_widget.json` のみ参照します。容量削減のため `_config.yml` の `exclude:` で**公開ビルドから除外**（リポジトリには保持）。

---

## 📊 Chart.js（自ホスト版）の更新手順

サードパーティCDN通信を排除するため、Chart.js は `assets/vendor/chart.umd.min.js` に自ホストしています。アップデート時は以下を実行：

```bash
curl -sL "https://cdn.jsdelivr.net/npm/chart.js@<VERSION>/dist/chart.umd.min.js" \
  -o assets/vendor/chart.umd.min.js
```

`<VERSION>` は更新したいバージョン（例: `4.4.7`）。配置後、ローカルサーバーで潮汐・波グラフが正常に描画されることを確認してからコミット。

---

## 🛠 minify ファイルの再生成手順

`assets/js/app.min.js` と `assets/css/style.min.css` は `app.js` / `style.css` を編集後に再生成が必要です。push すると `minify.yml` が自動で再生成しますが、ローカルで確認する場合は**CI と同じツール**（JS: `terser` / CSS: `csscompressor`）で生成してください（別ツールだと CI と出力が一致せず差分が発生します）：

```bash
# JS（minify.yml と同じ terser）
npx --yes terser assets/js/app.js -c -m -o assets/js/app.min.js
# CSS（minify.yml と同じ csscompressor。要 pip install csscompressor）
python -c "import csscompressor, pathlib as P; P.Path('assets/css/style.min.css').write_text(csscompressor.compress(P.Path('assets/css/style.css').read_text(encoding='utf-8')), encoding='utf-8')"
```

---

## ✅ フロントエンド品質チェック（ESLint / Prettier / pa11y）

JS/CSS/HTML には自動品質ゲートを用意しています。設定は公開ビルドに含めません（`eslint.config.js` は `_config.yml` の `exclude:`、`.prettierignore`/`.pa11yci` は dotfile のため Jekyll 既定除外）。

**ローカル実行:**
```bash
# 静的検査（手書きソース assets/js/app.js のみ。*.min.js は対象外）
npx --yes eslint assets/js/app.js
# 整形チェック（生成物・data・vendor は .prettierignore で除外）
npx --yes prettier --check "**/*.{html,css,js,json}"
# アクセシビリティ（WCAG2AA）。要ローカルサーバー
bundle exec jekyll build
# baseurl(/chiga-log) 配下で配信する。http-server はルート配信のため、
# _site を _serve/chiga-log に写して /chiga-log/ を解決可能にする（.pa11yci の URL と一致させる）。
mkdir -p _serve/chiga-log && cp -r _site/. _serve/chiga-log/
npx --yes http-server _serve -p 4000 &
npx --yes wait-on -t 60000 http://localhost:4000/chiga-log/
npx --yes pa11y-ci
```

**CI:** `.github/workflows/frontend-ci.yml` が `assets/js`・`assets/css`・`*.html` 変更時の push/PR で `lint`（ESLint+Prettier）と `a11y`（Jekyll build → pa11y-ci）を自動実行します。**cron は追加していません**（三原則3: API/Actions節約）。

</details>

## 使用技術・API

- **フロントエンド**: HTML5 / CSS3 / JavaScript (ES6+)
- **SEO・構造化データ**: OGP / Twitter Card / canonical に加え、JSON-LD（`@graph`: Person・WebSite・WebPage・WebApplication）で著者・地理情報・公開/更新日を宣言。サイト名の表記ゆれ（ちがろぐ／チガログ／chigalog 等）は `alternateName` で網羅。`jekyll-sitemap` で sitemap.xml 自動生成。
- **グラフ描画**: Chart.js（自ホスト版 `assets/vendor/chart.umd.min.js`。CDN通信を排除し、サードパーティ依存を最小化）
- **品質ゲート**: ESLint（`eslint.config.js`）/ Prettier / pa11y-ci（WCAG2AA）を `frontend-ci.yml` で push・PR 時に自動実行
- **自動化・ホスティング**: GitHub Actions / GitHub Pages / Cloudflare Workers（注意報・警報の閲覧時取得BFF）
- **気象庁データ (天気予報・注意報・潮汐)**: 気象庁公式データ（注意報・警報はCloudflare Worker経由で閲覧時取得、その他はGitHub ActionsによるJSON定期取得および年次更新データを利用）
- **月齢データ**: NASA SVS (年次更新のJSONデータを利用)
- **海面・現在の気象データ**: Open-Meteo API (登録不要・無料で利用可能)
- **潮汐データ (サブ)**: Stormglass API (気象庁データ欠損時のみ日次バッチ内でフォールバック取得)
