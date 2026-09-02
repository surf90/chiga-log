# DESIGN.md — ちがログ デザイン仕様書

> このファイルは AI エージェントが ちがログ（chiga-log）の UI を正確に生成・改修するためのデザイン仕様書です。
> 値はすべて `assets/css/style.css` の実測値に基づきます。CSS を変更した場合は本ファイルも追従させること。
> セクションヘッダーは英語、説明は日本語です。

---

## 1. Visual Theme & Atmosphere

- **デザイン方針**: 屋外（海辺）でスマホから一目で読める、明るく軽量な情報ダッシュボード。
- **密度**: モバイルファースト・単一カラム。最大幅 `600px` のセンタリングコンテナ。
- **キーワード**: 海・空（暖色→青のグラデ）、ガラス調カード（半透明＋影）、可読性優先、ダークモード対応。

---

## 2. Color Palette & Roles

カラーは CSS 変数（`:root`）で定義し、`prefers-color-scheme: dark` でダーク値に切り替わる。
`:root` に `color-scheme: light dark` を宣言し、スクロールバー等の UA 部品もダークに追従させる。

### CSS 変数（Light / Dark）

| 変数                 | Light                                             | Dark                                              | 用途                              |
| -------------------- | ------------------------------------------------- | ------------------------------------------------- | --------------------------------- |
| `--bg-gradient`      | `linear-gradient(160deg,#FFFBEB 0%,#EFF6FF 100%)` | `linear-gradient(160deg,#121212 0%,#1e1e1e 100%)` | ページ背景                        |
| `--text-main`        | `#222222`                                         | `#e2e8f0`                                         | 本文・見出し                      |
| `--text-sub`         | `#707070`                                         | `#94a3b8`                                         | 補足・ラベル                      |
| `--container-bg`     | `rgba(255,255,255,0.75)`                          | `rgba(30,30,30,0.85)`                             | 外枠コンテナ（ガラス調）          |
| `--container-shadow` | `0 4px 24px rgba(0,86,120,0.10)`                  | `0 4px 24px rgba(0,0,0,0.4)`                      | コンテナの影                      |
| `--box-bg`           | `#ffffff`                                         | `#2a2a2a`                                         | カード/ボックス背景               |
| `--box-border`       | `rgba(0,0,0,0.06)`                                | `rgba(255,255,255,0.08)`                          | ボックス境界                      |
| `--warning-bg`       | `#fff5f5`                                         | `#3f1d1d`                                         | 警報ボックス背景                  |
| `--warning-border`   | `#c0392b`                                         | `#ef4444`                                         | 警報ボックス枠                    |
| `--brand`            | `#0e7490`                                         | `#5ebdd8`                                         | 主要アクセント・リンク・操作色    |
| `--brand-strong`     | `#0284c7`                                         | `#7dd3fc`                                         | グラデーション終端・強アクセント  |
| `--brand-soft`       | `rgba(14,116,144,0.08)`                           | `rgba(94,189,216,0.12)`                           | ラベル/ボタンの薄い背景           |
| `--hairline`         | `rgba(14,116,144,0.12)`                           | `rgba(125,211,252,0.14)`                          | 薄い罫線・操作部品境界            |
| `--selection-bg`     | `rgba(14,116,144,0.16)`                           | `rgba(94,189,216,0.26)`                           | テキスト選択範囲（`::selection`） |

`:root` には `accent-color`（ライト `#0e7490` / ダーク `#5ebdd8`）も宣言し、UA 既定のフォーム部品色をブランドに合わせる。

### ブランド/アクセント（変数化されていない固定値）

- **ブランドグラデ**: `linear-gradient(135deg,#0e7490 0%,#0284c7 100%)`（ティール→ブルー）。ヒーロータイトル文字（`background-clip:text`）とヒーローカード背景に使用。ヒーローカードは白の薄いハイライトを重ねて、屋外でも押せる面として認識しやすくする。グラデ文字は `-webkit-background-clip` と**標準 `background-clip` を必ず併記**する。接頭辞のみだと、将来の接頭辞廃止時に `-webkit-text-fill-color:transparent` だけが残りロゴが不可視になる。
- **アクセント文字/リンク**: `--brand`（ライトは `#0e7490`、ダークは `#5ebdd8`）。数値ハイライト・リンク・点線下線・アウトラインボタン枠。
- **警報系**: 通常警報 `#c0392b`、特別警報 `#7c3aed`（紫）、注意報レベルは橙系（`#e67e22` / `#d97706`）。注意報バッジは橙背景で白文字だとコントラスト不足になるため、文字色は `#222222`。
- **ダーク時の明色置換**: 固定色の文字はダーク背景で沈むため、ダークでは満潮 `#0275d8→#60a5fa`、干潮 `#ce4844→#f87171`、エラー文字 `#c0392b→#ef4444` に切替（`@media (prefers-color-scheme: dark)` で上書き。Chart.js のグラフ色は変更しない）。補足灰色（潮位・区切り・「警報なし」）は固定値でなく `var(--text-sub)` を使う。
- **テキストのコントラスト（WCAG2AA・pa11y ゲート）**: 本文テキスト色は白背景で 4.5:1 以上を満たすこと。干潮文字は `#d9534f`(3.96:1) では不足のため **`#ce4844`(4.5:1)** を使用。系列色をテキスト色に用いない（波グラフ凡例の緑 `#27ae60` は 2.87:1 で不足）——**凡例の系列色は文字ではなくスウォッチ（丸）で示し、文字は既定色**にする。Chart.js の線・点・スウォッチ（＝グラフィック要素）は 1.4.3 の対象外のため従来色のまま。

> **原則**: 純黒 `#000000` は使わず `#222222`。新規色の追加は避け、上記変数/アクセントを再利用する。

---

## 3. Typography

### font-family

```css
/* 本文・見出し（欧文優先の和欧混植） */
font-family: Inter, "Zen Kaku Gothic New", sans-serif;

/* 数値・ラベル等（等幅） */
font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
```

- 欧文を Inter、和文を Zen Kaku Gothic New にフォールバック。
- `body` に `-webkit-font-smoothing:antialiased` / `-moz-osx-font-smoothing:grayscale` を指定し、macOS/iOS での過剰な太りを抑える。
- フォントは可変フォント＋サブセットで最小化（三原則2）。Web フォント追加は要相談。

### サイズ・ウェイト階層（実測）

| Role                 | Size         | Weight  | 備考                                                         |
| -------------------- | ------------ | ------- | ------------------------------------------------------------ |
| ヒーロータイトル     | 2.4rem       | 900     | ブランドグラデ文字                                           |
| セクション数値（大） | 1.6rem       | 700     | カード主数値                                                 |
| 見出し（中）         | 1.2rem〜1rem | 600     | サブ見出し                                                   |
| ラベル               | 12px         | 600     | カードラベル                                                 |
| データ行の値         | 15px         | 700     | 既定は右寄せ。長文で折り返す天気（`#jma-weather`）のみ左寄せ |
| 本文                 | 15px (body)  | 400     | 既定                                                         |
| 補足・キャプション   | 11px         | 400/700 | 単位・注記（等幅多用、小型端末の可読性確保のため最小11px）   |

---

## 4. Components

### 背景 / コンテナ

- `body::before` で白〜水色の控えめなラジアル光と下部の海色フェードを重ねる。ダークモードでは低彩度の青い光に置換する。装飾は固定背景で、コンテンツを遮らない（`pointer-events:none`, `z-index:-1`）。
- コンテナ: `max-width:600px` / `padding:34px 24px 28px` / `border-radius:16px` / `background:var(--container-bg)` / `box-shadow:var(--container-shadow)` / 上端に 4px のブランドグラデーションバー。
- ヘッダー: `--brand-soft` と半透明の白を重ねた軽量なグラデーション面、`1px solid var(--hairline)`、`border-radius:12px`、薄い影でコンテンツから穏やかに分離する。追加の画像や JavaScript は使わない。
- フッター: カード面（背景・枠・角丸・影）は持たず、上端の `1px solid var(--hairline)` の区切り線のみでコンテンツから分離するテキスト形式。リンクの重要度は低いため、装飾やチップ化はしない。

### サイトバー（スクロール追従、`#site-bar`）

- 目的: 縦に長い1ページ構成でヒーローヘッダー（サイト名）が画面外に出た後も、サイト名を見失わせないための最小限のバー。
- 配置: `.container` は `overflow:hidden` のため `position:sticky` は効かない。コンテナの**外**（`body` 直下）に `position:fixed; inset:0 0 auto; z-index:900` で配置する（`.skip-link` の 1000 より下、`#toast` の 9999 より下）。
- 見た目: 高さ 44px 目安、背景 `rgba(255,255,255,0.82)`（ダーク `rgba(30,30,30,0.88)`）＋ `backdrop-filter:blur(12px) saturate(150%)`（背後の色を保ったまま曇らせる）、下端 `1px solid var(--hairline)`。内容は「サイト名｜地域ラベル」のみ（更新日時・進捗・トップへ戻るは置かない＝情報過多にしない）。
- サイト名は `.logo-text` と同じブランドグラデ文字（フォントサイズのみ差し替え）。
- 表示制御: 既定で `transform:translateY(-100%); opacity:0` の非表示。`IntersectionObserver` が `<header>` の可視性を監視し、非表示になったら `.is-visible` を付与してスライドイン（`app.js`）。scroll イベント購読は使わない。IntersectionObserver 非対応・要素欠如時は常に非表示のまま（安全側の劣化）。
- `h1` と同一内容の再掲のため `aria-hidden="true"`。
- アンカー移動先の見出しがバーに隠れないよう、`.weather-box` の `scroll-margin-top` は `56px`。

### カード / ボックス

- ヒーローカード: ブランドグラデ背景の上に**上辺へ寄せたラジアルのハイライト**（`radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.2), transparent 58%)`）を重ね、画像もJSも使わずに面のわずかな湾曲を出す。文字 `#fff`・`border-radius:var(--radius-md)`・`padding:13px 8px 11px`（`max-width:420px` で `11px 5px 9px`）・薄い白境界・`--shadow-hero`。hover は `translateY(-2px)` と `--shadow-hero-hover`。**ハイライトは強めすぎない**（白文字ラベルのコントラストが落ちる。pa11y WCAG2AA を必ず通すこと）。
- 情報ボックス: `background:var(--box-bg)`・`border:1px solid var(--box-border)`・`border-radius:var(--radius-sm)`・`padding:16px 24px`（`max-width:420px` で `14px 16px`）・`--shadow-card`・左端 3px のブランドグラデーションバー。**hover ではカードを浮かせず**（操作対象ではないため）、影を `--shadow-card-hover`、枠を `--hairline` へ変えるだけにする。警報カード・熱中症カードは色で意味を持つため除外する。
- 初期表示: ヘッダー、データカード、フッターを `opacity` と `translateY(8px)` のみで短くフェードアップする。カードは上から `0.03s` 刻みで遅らせ、**5枚目以降は `0.12s` で頭打ち**にして待ち時間を作らない。`prefers-reduced-motion: reduce` では既存の全体ルールにより実質無効化する。

### ボタン

- アウトライン型（`.toggle-btn`）: `border:1px solid #0e7490` / `color:#0e7490` / 背景透明 / `min-height:44px`。
- 全ボタン共通: `touch-action:manipulation`・`-webkit-tap-highlight-color:transparent`。`:hover` スタイルは必ず `@media (hover: hover)` 内に置く（タッチ端末でタップ後にホバー状態が残るのを防ぐ）。押下時は `:active`（`scale(0.97〜0.98)` または opacity 低下）、キーボード時は `:focus-visible`（2px アウトライン）で必ずフィードバックする。
- タップターゲット: `.toggle-btn` / `#toast` / `.current-time` は `min-height:44px`。`.wave-legend-item`（グラフ凡例トグル、`<button aria-pressed>`）は padding＋負マージンでヒット領域を拡張。
- セクションへのスクロール移動先（`.weather-box`）は `scroll-margin-top:56px` でサイトバー下に余白を確保。
- 「更新日時」ボタン（`.current-time`）の右寄せは、親 `.float-alert-wrap` の `display:flex; justify-content:flex-end` で行う。`float`＋`overflow:hidden` のクリアフィックスは使わない（`overflow:hidden` が `outline-offset` のフォーカスリングを欠けさせる）。

### チャート（潮汐・波高/周期）

- **横スクロール**: 2日分（`CHART_DAYS=2` × `PX_PER_HOUR=14` = 672px）を `.chart-scroll` の横スクロールで見せる。潮汐と波のスクロール位置は相互に同期する。
- **初期位置**: 読み込み時は「今」の少し手前（`now - 80px`）へ寄せ、画面の大半を今後の予測に使う。`display:none` の状態では `scrollLeft` 代入が無効になるため、`#weather-content` を表示した後に `requestAnimationFrame` で寄せ直す。
- **現在時刻ライン**: `nowLinePlugin` がオレンジ（`#ff6600`, `globalAlpha:0.35`）の縦帯を描く。
- **Y軸の固定表示**: `stickyYAxisPlugin` が、スクロール量ぶん平行移動した位置に軸幅ぶんの下地（`--box-bg`）をキャンバス全高で塗り、Chart.js の scale を再描画する。左軸（潮位 m・波高 m）は表示領域の左端、右軸（周期 秒）は右端へ貼り付く。スクロール中は `requestAnimationFrame` で1フレーム1回に間引いて再描画する。
- **右端フェード**: `.chart-scroll` に `mask-image` を当て、右端20pxを不透明度 `0.45` まで落として「横に続きがある」ことを示す（モバイルはスクロールバーが出ないため）。固定表示の周期軸が重なるので、完全な透明までは落とさない。
- **キャンバス高**: 潮汐 144px / 波高・周期 180px。`responsive:false` のため **CSS（`.tide-chart-area` / `.wave-chart-area`）と JS（`canvas.height`）の両方に同じ値**を持つ。変更時は必ず2箇所を揃える。
- **凡例**: 波グラフのカスタム凡例（`.wave-legend`）は **`.chart-scroll` の外側**に置く。内側に入れると凡例も一緒にスクロールし、2項目目が画面外へ出る。

### 風予報（`#wind-forecast-box`）

- 直近 **3件（`WIND_VISIBLE_COUNT`）は常時表示**し、4件目以降を `#wind-forecast-more`（`.wind-grid-more`、既定 `display:none`）へ入れて `.toggle-btn` で開閉する。開かなくても直近の風が読める状態にする。
- 残りが0件のときはトグルボタンごと隠す（`hidden`）。押しても何も出ないボタンを見せない。
- トグルのラベルは折りたたむ側の時間帯を示す（例: `残りの予想風（12:00-23:00）を表示 ▼`）。

### 警報バッジ / フローティングアラート

- `.floating-alert.level-tokubetsu { background:#7c3aed; }`（特別警報）。通常警報は `#c0392b` 系、注意報は橙系。
- 表示/非表示は `setFloatingAlert()`（`app.js`）に集約する。`className` と `style.display` を呼び出し側で個別に触ると状態がずれる。
- **バーは `position:fixed` で画面下端に重なるため、表示中は逃がしぶんの余白を確保する**。`setFloatingAlert()` が `body.has-floating-alert` を付け外しし、`padding-bottom: calc(64px + env(safe-area-inset-bottom))` でフッター最終行が隠れるのを防ぐ。`#toast` / `#refresh-toast` も同クラス配下で `bottom` を上げてバーと重ならないようにする。

### 熱中症警戒アラートカード

- `#heatstroke-box`: 神奈川県に正式発表中の場合だけ、「注意報・警報」カードの直下かつ「天気予報」カードの直上へ表示。未発表・取得失敗・対象日外はカードごと非表示。
- 通常の熱中症警戒アラートは `.heatstroke-box` で黄〜黄橙の枠（ライト `#eab308`／ダーク `#facc15`）と薄い黄色背景を付ける。
- 熱中症特別警戒アラートは `.heatstroke-special` を追加し、濃い橙枠（ライト `#d97706`／ダーク `#f59e0b`）と薄い橙背景へ切り替える。

### 津波カード（`#tsunami-box`）

- 相模湾・三浦半島（予報区330）に津波注意報/警報発表時のみ、ページ最上部に表示（通常は `hidden`）。`.warning-active` の赤枠・赤背景を流用。
- バッジ配色: 大津波警報 `.badge-tsunami-major` `#7c3aed`（紫）／津波警報 `.badge-tsunami-warn` `#c0392b`（赤）／津波注意報 `.badge-tsunami-adv` `#d97706`（橙）。

### データ鮮度の警告表示

- 目的: 更新停止（Actions 停止・API 障害）や古いデータを閲覧者に明示し、誤読を防ぐ（三原則1）。閾値はデータ種別ごとに個別（`app.js` の `FRESHNESS`）。
- **警告はカード単位で出し、ページ全体のバナーは使わない**。GitHub Actions のスケジュール遅延・スキップはデータ種別ごとに独立して起きるため、1ソースの遅延で全体バナーを出すと、更新できている他の情報まで古いと誤認させてしまう。旧 `.stale-banner`（`#stale-banner`）は本方針により廃止。
- `.stale-note`（各セクション見出し直下）/ `.stale-inline`（`#tsunami-error`）: 該当データが閾値超で古い/取得失敗時に小さく赤字（`--warning-border`, 12px）で注記。通常は `hidden`。対象は潮汐・波・警報・天気予報・風（`markStale()`）、現在の気温･風（`#marine-stale`、アメダス観測時刻の鮮度・取得失敗）、水温･波高（`#sea-stale`、表示中の値の時刻）。
- **判定軸はデータの性質で分ける**。実測値（アメダス）は観測時刻の年齢で判定し、予報値（風・波高・海水温）は「時系列が現在時刻をカバーしているか」を主判定にする。予報は未来の行を含むため、ファイル生成が数時間前でも表示行は妥当であり、年齢だけで警告すると誤警告になる（`FRESHNESS.wind` / `FRESHNESS.seaState` は更新完全停止の検知用）。系列が現在時刻に届いていない場合は、生成時刻が読めなくても必ず警告する（表示できる予報が無い状態のため）。
- **警告の閾値（`FRESHNESS.marine` = 2時間）とライブ補完のトリガ（`LIVE_AMEDAS.staleAfterMs` = 45分）は別物**。トリガは「取り直す価値があるか」、警告は「利用者に伝える価値があるほど古いか」で、同じ値にすると、ライブ取得が使えない環境（CORS遮断・オフライン）では通常運用の cron 間隔でも警告が出続けて誤読を招く。
- `#amedas-observed`（`.note-fine`、NOWカードの注釈内）: アメダスの観測時刻を「（10:20 観測）」の形で常時表示。多少古くても「いつの実測値か」が分かれば閲覧者が自分で判断できる（三原則1）。取得時刻が不明なら `hidden`。
- `.current-time.is-stale`: データが古い場合に「更新日時」の下線・文字色を `--warning-border` に切替（データ生成時刻＋経過時間を表示）。
- トグルは `hidden` 属性で行うため、これらは `display` を指定しない。
- `.section-error`（各カードの「取得に失敗しました」）は**成功時に必ず消す**。`setSectionError(id, show)`（`app.js`）を使い、失敗時 `true` / 成功時 `false` を対で呼ぶ。3時間ごとの自動更新・手動更新で復旧しても消えないと、正常なデータの横にエラーが残り続けて誤読を招く（三原則1）。
- 全面エラー（`#error`）は**初期表示前に限る**。`_showGlobalError()` は `#weather-content` が表示済みなら何もしない。描画後の想定外の例外で、正常に出ているデータの上にエラーを被せないため。カード単位のエラー・鮮度注記が本来の受け口。

### 角丸スケール

CSS 変数として定義し、各コンポーネントは変数を参照する（実数値の直書きは避ける）。

| 変数          | radius | 用途                                     |
| ------------- | ------ | ---------------------------------------- |
| `--radius-lg` | 16px   | コンテナ                                 |
| `--radius-md` | 12px   | カード（ヘッダー・ヒーローカード）       |
| `--radius-sm` | 10px   | 情報ボックス                             |
| `--radius-xs` | 6px    | 小要素（ボタン・凡例トグル・スケルトン） |

※ `max-width:420px` ではコンテナのみ 14px に縮める。

### 影（エレベーション）

影は**「接地影（近距離・濃い）＋環境影（遠距離・薄い）」の2枚重ね**で定義する。1枚の大きなぼかしより輪郭が締まり、面の高さが読み取りやすい。値は CSS 変数化し、ダークでは黒を強めた値に差し替える。

| 変数                  | 用途                                 |
| --------------------- | ------------------------------------ |
| `--shadow-card`       | 情報ボックス（`.weather-box`）の既定 |
| `--shadow-card-hover` | 同上、ポインタが乗っているとき       |
| `--shadow-hero`       | ヒーローカードの既定                 |
| `--shadow-hero-hover` | 同上、hover 時                       |

コンテナは従来どおり `--container-shadow`、ヘッダーは固定値の単層影を使う。

### モーション

- **イージング**: `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`。終端がゆっくり止まるため、短い duration でも動きが安っぽくならない。フェードイン・トースト・hover・ボタン押下はこれに揃える。
- **duration**: hover/影 `0.18〜0.24s`、押下 `0.12s`、トースト `0.32s`、サイトバー `0.28s`、初期表示 `0.42〜0.55s`。
- `prefers-reduced-motion: reduce` では既存の全体ルールで実質無効化される（個別対応は不要）。

### フォーカスリング

`--focus-ring: 2px solid var(--brand)` を定義し、全ての `:focus-visible` は `outline: var(--focus-ring)` ＋ `outline-offset: 2px` で統一する（ヒーローカードのみ白 `#fff` を使う）。

---

## 5. Layout & Responsive

- **レイアウト**: 単一カラム、中央寄せ（`max-width:600px`）。PC でも 600px 固定。`max-width:420px` で小型端末向けに余白・ロゴ・カード数値を縮小し、タイトルの地域ラベルと情報源ラベルを折り返す。
- **余白/gap**: カード間は `.weather-box` の `margin-bottom:12px`（`max-width:420px` で `10px`）、要素内 `gap:4〜7px`、body `padding:24px 16px`。
- **タッチターゲット**: 屋外・指操作前提で十分な高さを確保（最小 44px 目安）。

---

## 6. Do's / Don'ts

### Do

- 色は CSS 変数とブランドアクセント `#0e7490` / グラデ `#0e7490→#0284c7` を再利用する。
- 角丸・影・イージング・フォーカスリングは `--radius-*` / `--shadow-*` / `--ease-out` / `--focus-ring` を参照する。
- ダークモード（`prefers-color-scheme: dark`）の見え方を必ず確認する。
- 数値・単位・ラベルは等幅フォントで揃える。
- テキスト色は `#222222`（ライト）/ `#e2e8f0`（ダーク）。
- 装飾記号（見出し・フッターの `|` など）には `aria-hidden="true"` を付ける。

### Don't

- 純黒 `#000000` を使わない。
- JS ライブラリ・Web フォントを安易に追加しない（三原則2、要相談）。
- データ未取得時にダミー値を入れない。取得失敗を UI で明示する（三原則1）。
- 新規カラートークンの乱立を避ける。
- 角丸・影・イージングの実数値を各セレクタへ直書きしない（トークンを増やすか、既存を再利用する）。
