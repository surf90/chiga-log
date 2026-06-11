# フォーク手順（別の海岸に対応させる）

このサイトの地点固有設定は **`_data/site.json` 1ファイルに集約**されています。
JS・Python・HTML（Jekyll）の3者がここを参照するため、基本は **このファイルだけ**
編集すれば別地点に切り替えられます（読み込み失敗時は本家の値にフォールバック）。

## 1. `_data/site.json` を編集

| キー | 意味 | 例（茅ヶ崎） | 調べ方 |
|---|---|---|---|
| `name` / `short_name` | サイト名・ロゴ文字 | ちがログ | 任意 |
| `title` / `description` | `<title>`・meta・OGP・JSON-LD | — | 任意（SEO文言） |
| `tagline` / `area_label` | 見出し下のキャッチ・サブ見出し | 茅ヶ崎の海のログが… | 任意 |
| `location.display_name` | 地点名（風予報注記・JSON-LD・出力JSON） | 茅ヶ崎ヘッドランド | 任意 |
| `location.lat` / `lon` | 表示・Open-Meteo 用座標 | 35.3175 / 139.4151 | 地図アプリ |
| `location.tide_lat` / `tide_lon` | 潮汐(Stormglass)用座標（別値可） | 35.318 / 139.41 | 地図アプリ |
| `location.tide_table_label` | 潮位表リンクの表示名 | 湘南港 | 最寄りの潮位観測所名 |
| `jma.forecast_code` | 天気予報JSON（県）コード | 140000 | 下記「JMAコードの調べ方」 |
| `jma.forecast_area_code` | 予報区（東部等）・警報リンクの `code` | 140010 | 同上 |
| `jma.pref_code` | アメダスリンクの `area_code` | 140000 | 同上 |
| `jma.city_warning_code` | 市区町村の警報コード（`selected_code`） | 1420700 | 同上 |
| `jma.city_warning_name` | 警報JSON出力の地域名 | 茅ヶ崎市 | 任意 |
| `jma.warning_office` | VPWS50 県官署署名 | JPTF | 下記 |
| `jma.amedas_code` | アメダス官署コード（観測値取得） | 46141（辻堂） | アメダス地点表 |
| `jma.amedas_link_no` | アメダス画面リンクの `amdno` | 46141 | アメダスURL |
| `jma.tide_station` | 気象庁潮汐テキストの観測点コード | D8 | 下記 |
| `jma.wave_guid_area` | 波浪ガイダンスのエリア番号 | 20 | 下記 |
| `jma.wave_guid_link_area` | 波浪ガイダンスHTMLリンクの `area` | 19 | 気象庁サイト |
| `jma.tsunami_area_code` | 津波予報区コード | 330 | 下記 |

> 座標 `tide_lon` の末尾ゼロ（139.410）は JSON では 139.41 になりますが数値は同一です。

## 2. JMAコードの調べ方

- **予報/予報区コード**: `https://www.jma.go.jp/bosai/common/const/area.json` の
  `offices`（県=`forecast_code`）/ `class10s`（`forecast_area_code`）を参照。
- **市区町村 警報コード**: 気象庁「警報・注意報」ページで対象市町村を選択し、URL の
  `selected_code` を確認。`warning_office`（VPWS50 の `JPxx`）は発表官署。
- **アメダス**: `https://www.jma.go.jp/bosai/amedas/` で地点を開き、URL の `amdno`
  （`amedas_link_no`）を取得。観測値取得用の `amedas_code` は官署番号（5桁）。
- **潮汐観測点**: 気象庁 潮位表（`.../kaiyou/db/tide/suisan/`）で最寄り観測点の
  コード（例 `D8`）を確認。
- **波浪ガイダンス**: `https://www.data.jma.go.jp/waveinf/...` の対象エリア番号。
- **津波予報区**: 気象庁 津波予報区一覧の区域コード。

## 3. 編集後にやること

```powershell
# 1) フロントの定数は site-config.js（Jekyll 生成）経由なので追加作業は基本不要。
#    app.js を直接いじった場合のみ minify 再生成:
npx --yes terser assets/js/app.js -c -m -o assets/js/app.min.js

# 2) ローカル確認（Jekyll 推奨。無い場合は raw 配信でフォールバック動作になる）
bundle exec jekyll serve          # 推奨（Liquid 展開＆設定反映を確認）
# または
python -m http.server 8000        # raw 配信: 設定は反映されず本家フォールバック値で表示
```

`bundle exec jekyll serve` で `window.SITE_CONFIG` が `assets/js/site-config.js`
に展開され、HTML のタイトル・JSON-LD・各リンクが新地点の値になることを確認します。

## 4. このファイルだけでは変わらない箇所（手動）

- `_config.yml` の `url` / `baseurl` / `google_analytics`（公開先・解析ID）。
- `site.webmanifest`（PWA 名称・説明）。
- `assets/og/ogp.png` / `assets/og/ogp.webp`（OGP 画像）。
- ロゴ用フォントサブセット（`index.html` の `&text=ちがログ` 部分）。
- フッターの外部 SNS リンク（例: ライフセービングの Instagram）。
- 潮汐/警報の出力ファイル名 `data/warning_chigasaki.json`・`data/tide_data.json` は
  そのままでも動作します（地名はファイル名のみ）。

## 仕組み（参考）

- `_data/site.json` … 単一の設定ソース。
- `assets/js/site-config.js` … Jekyll が `{{ site.data.site | jsonify }}` を展開し
  `window.SITE_CONFIG` を供給（CSP `script-src 'self'` 適合のため外部JS）。
- `scripts/_common.py` の `load_site_config()` … Python 側が同ファイルを読む。
  いずれも**読み込み失敗時は各所のリテラルへフォールバック**するため、設定が無くても
  本家の挙動で動作します。
