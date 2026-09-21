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
| `--wind-bar-avg`     | `rgba(14,116,144,0.55)`                           | `rgba(94,189,216,0.6)`                            | 風予報バーの平均側（濃）          |
| `--wind-bar-gust`    | `rgba(14,116,144,0.18)`                           | `rgba(94,189,216,0.22)`                           | 風予報バーの最大側（薄）          |
| `--moon-dark`        | `#cfe3ea`                                         | `#3c4a50`                                         | 月相アイコンの影側（**不透明**）  |
| `--divider`          | `#cbd5e1`                                         | `#475569`                                         | 区切り記号（サイトバー・見出し）  |
| `--skeleton-base`    | `#e2e8f0`                                         | `#2a2a2a`                                         | スケルトンの地                    |
| `--skeleton-sheen`   | `#f1f5f9`                                         | `#3a3a3a`                                         | スケルトンの走査光                |

`:root` には `accent-color`（ライト `#0e7490` / ダーク `#5ebdd8`）も宣言し、UA 既定のフォーム部品色をブランドに合わせる。

### ブランド/アクセント（変数化されていない固定値）

- **ブランドグラデ**: `linear-gradient(135deg,#0e7490 0%,#0284c7 100%)`（ティール→ブルー）。ヒーロータイトル文字（`background-clip:text`）とヒーローカード背景に使用。ヒーローカードは白の薄いハイライトを重ねて、屋外でも押せる面として認識しやすくする。グラデ文字は `-webkit-background-clip` と**標準 `background-clip` を必ず併記**する。接頭辞のみだと、将来の接頭辞廃止時に `-webkit-text-fill-color:transparent` だけが残りロゴが不可視になる。
- **アクセント文字/リンク**: `--brand`（ライトは `#0e7490`、ダークは `#5ebdd8`）。数値ハイライト・リンク・点線下線・アウトラインボタン枠。
- **警報系**: 通常警報 `#c0392b`、特別警報 `#7c3aed`（紫）、注意報レベルは橙系（`#e67e22` / `#d97706`）。注意報バッジは橙背景で白文字だとコントラスト不足になるため、文字色は `#222222`。
- **ダーク時の明色置換**: 固定色の文字はダーク背景で沈むため、ダークでは満潮 `#0275d8→#60a5fa`、干潮 `#ce4844→#f87171`、エラー文字 `#c0392b→#ef4444`、ライフセービングリンク `#b4453a→#f0857a` に切替（`@media (prefers-color-scheme: dark)` で上書き。Chart.js のグラフ色は変更しない）。補足灰色（潮位・区切り・「警報なし」）は固定値でなく `var(--text-sub)` を使う。
- **テキストのコントラスト（WCAG2AA・pa11y ゲート）**: 本文テキスト色は白背景で 4.5:1 以上を満たすこと。干潮文字は `#d9534f`(3.96:1) では不足のため **`#ce4844`(4.5:1)** を使用。系列色をテキスト色に用いない（波グラフ凡例の緑 `#27ae60` は 2.87:1 で不足）——**凡例の系列色は文字ではなくスウォッチ（丸）で示し、文字は既定色**にする。Chart.js の線・点・スウォッチ（＝グラフィック要素）は 1.4.3 の対象外のため従来色のまま。
- **エラー文字色は `var(--warning-border)` に集約**する（`.error` / `.section-error` / `.tide-error` /
  `.typhoon-notice`）。同じ赤を各セレクタへ直書きすると、ダーク用の上書きを別途並べる必要が生じる。
  一方で**バッジ/バーの背景色は固定値のまま**にする（`.badge-keiho` / `.floating-alert.level-keiho` の
  `#c0392b` 等）。ダークの `--warning-border`(`#ef4444`) を背景にすると白文字のコントラストが 4.5:1 を割る。

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

- ヒーローカード: ブランドグラデ背景の上に**上辺へ寄せたラジアルのハイライト**（`radial-gradient(120% 100% at 50% 0%, rgba(255,255,255,0.2), transparent 58%)`）を重ね、画像もJSも使わずに面のわずかな湾曲を出す。文字 `#fff`・`border-radius:var(--radius-md)`・`padding:13px 8px 11px`（`max-width:420px` で `11px 5px 9px`）・薄い白境界・`--shadow-hero`。hover は `translateY(-2px)` と `--shadow-hero-hover`。`:active` は `scale(0.98)` ＋ `--shadow-card`（影を `none` にすると「沈む」ではなく「消える」印象になる）。**ハイライトは強めすぎない**（白文字ラベルのコントラストが落ちる。pa11y WCAG2AA を必ず通すこと）。
- 情報ボックス: `background:var(--box-bg)`・`border:1px solid var(--box-border)`・`border-radius:var(--radius-sm)`・`padding:16px 24px`（`max-width:420px` で `14px 16px`）・`--shadow-card`・左端 3px のブランドグラデーションバー。**hover ではカードを浮かせず**（操作対象ではないため）、影を `--shadow-card-hover`、枠を `--hairline` へ変えるだけにする。警報カード・熱中症カードは色で意味を持つため除外する。
- 初期表示: ヘッダー、データカード、フッターを `opacity` と `translateY(8px)` のみで短くフェードアップする。カードは上から `0.03s` 刻みで遅らせ、**5枚目以降は `0.12s` で頭打ち**にして待ち時間を作らない。`prefers-reduced-motion: reduce` では既存の全体ルールにより実質無効化する。
- **ローディングのスケルトンはカード型**（`.skeleton-card`、既定 132px / `.tall` 196px を3枚）にする。実レイアウトはカードの連なりなので、細い線（旧 `.skeleton-line`）を並べると読込完了で高さが急増し、レイアウトシフトになる。ヒーロー3枚ぶん（`.skeleton-hero-card`）は据え置き。

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
- **キャンバス高**: 潮汐 134px / 波高・周期 140px。`layout.padding` は両グラフとも 0（下パディングを入れるとX軸ラベルの下に空白が残り、直下の注記との間が間延びする）。`responsive:false` のため **CSS（`.tide-chart-area` / `.wave-chart-area`）と JS（`canvas.height`）の両方に同じ値**を持つ。変更時は必ず2箇所を揃える。
- **凡例**: 波グラフのカスタム凡例（`.wave-legend`）は **`.chart-scroll` の外側**に置く。内側に入れると凡例も一緒にスクロールし、2項目目が画面外へ出る。 項目は2つだけなので `justify-content:flex-start` ＋ `gap:16px` で左に寄せる（`space-between` で左右端へ離すと視線移動が無駄に大きい）。

### 風予報（`#wind-forecast-box`）

- 直近 **3件（`WIND_VISIBLE_COUNT`）は常時表示**し、4件目以降を `#wind-forecast-more`（`.wind-grid-more`、既定 `display:none`）へ入れて `.toggle-btn` で開閉する。開かなくても直近の風が読める状態にする。
- 残りが0件のときはトグルボタンごと隠す（`hidden`）。押しても何も出ないボタンを見せない。
- トグルのラベルは折りたたむ側の時間帯を示す（例: `残りの予想風（12:00-23:00）を表示 ▼`）。
- **列構成**: `時刻 / 風向 / 平均 / 最大` の4列。見出し行 `.wind-head` とデータ行 `.wind-row` は
  **同じ `grid-template-columns`**（既定 `48px 1fr 52px 52px`、`max-width:420px` で `46px 1fr 46px 46px`）
  を共有する。ずらすと数値の縦位置が揃わなくなるため、変更時は必ず2箇所を揃える。
- **単位と「平均/最大」の別は見出し行に1度だけ出し、データ行は数値のみ**にする。行ごとに
  `m/s` を繰り返すと狭幅端末で値が折り返し、行高が倍になる。見出しとの対応は支援技術へは
  伝わらないので、各値に `.visually-hidden` の語（`平均 ` / `最大 ` / ` m/s`）を添えて補う。
  見出し行自体は視覚専用として `aria-hidden="true"`（行側が語と単位を持つため、対応の取れない
  見出しを二重に読ませない）。
- **データが無い時は見出し行ごと隠す**（`#wind-head` の `hidden`）。空欄だけが列に残ると
  「0 m/s」と読み違える余地が出る（三原則1）。`.wind-head` は `display:grid` を持つため、
  `.wind-head[hidden]{display:none}` で UA 既定を明示的に打ち消すこと。
- **平均/最大バー**: 行の下端に 4px の帯（`background-size:100% 4px` / `background-position:0 100%`）を
  敷き、濃い側（`--wind-bar-avg`）が平均、その先の薄い側（`--wind-bar-gust`）が最大（ガスト）。
  ガストは常に平均以上なので「伸びた先が最大」と読める。**文字の背面ではなく帯にする**こと
  （行全体を塗ると本文コントラストが落ち、面が重く見える）。最大が欠測の行は平均と同じ位置で
  止め、伸ばさない（三原則1: 無い値を描かない）。
- **正規化は固定上限**（`app.js` の `WIND_BAR_MAX_MS` = 15 m/s、超過は 100% にクランプ）。
  行ごとの最大値で正規化すると行同士を比較できなくなる。
- **風向矢印**（`.wind-arrow`）: `--icon-wind-arrow`（インライン SVG の data URI）を `mask` で
  敷き、`background-color: var(--brand)` で着色する（13px 角）。絵文字・記号フォントには依存
  させない。**軸と鏃を持つ非対称な矢印**にすること。border 方式の正三角形は上下がほぼ対称で
  先端がどちらか読めず、22.5°刻みの回転差も判別できなかった。
  `--deg` は**風が向かう方位**（風向 + 180°）で、気象アプリ一般の慣習に合わせる。角度は
  隣のテキストと同じ **16方位（22.5°刻み）に丸めてから**渡す（生の度数だと「北 4°」と
  「北北東 14°」が同じ向きに見え、テキストと矛盾する）。
  方位そのものは隣のテキストが示すため、矢印は `aria-hidden="true"`。

### 注記アイコン（絵文字の代替）

- **UI に絵文字（⚠ / ✅ / 🔄 など）を使わない**。端末のフォントで字形・サイズ・色がばらつき、
  ダークモードでは絵文字だけが浮く。`:root` の `--icon-warning` / `--icon-check` / `--icon-refresh`
  （インライン SVG の data URI）を `mask` で敷き、`background-color:currentColor` で文字色に追従させる。
- 付与先は `::before` / `::after`。**文言そのものはテキストが持ち**、アイコンは装飾に留める
  （JS 側の文字列に記号を混ぜない）。
- 対象: `.stale-note` / `.stale-inline` / `.typhoon-notice` / `.floating-alert`（警告）、
  `.warning-none` / `#refresh-toast`（チェック）、`#toast`（更新）、
  `.current-time`（通常＝更新／`.is-stale`＝警告）。
- `.current-time` は JS が文言を入れるまで空。`:empty::after { content: none }` でアイコンだけが浮くのを防ぐ。
- `.typhoon-notice` は `.data-row`（`space-between`）と併用するため、`justify-content:flex-start` を
  上書きする。上書きしないとアイコンと文言が左右に割れる。
- CSP は `img-src 'self' data:` のため data URI の mask は通る。外部アイコンフォントは追加しない（三原則2）。

### 潮汐の満潮・干潮チップ（`.tide-chips` / `.tide-chip`）

- 時刻と潮位の対ごとに小さなピルへ分ける。読点区切りで1行に詰めると等幅でも縦に揃わず、
  屋外で目的の時刻を拾いにくい。
- `dd` を `display:flex; flex-wrap:wrap; justify-content:flex-end` にし、狭幅では自然に折り返す。
- チップの枠は `--hairline`、地は `--brand-soft`。満潮/干潮の色分け（`.tide-high` / `.tide-low`）は
  `dd` 側のクラスで継承させ、チップ自体には色を持たせない。

### 月相アイコン（`.moon-phase`）

- 潮汐カードの「潮回り」の直後、月齢テキストの手前に 12px で控えめに置く。画像も JS ライブラリも
  使わず、**円（影側）＋右半分の明側＋明暗境界（ターミネータ）の楕円**の3層で満ち欠けを描く。
- `--term` = `|1 − 2 × 照度|`（0 = 上弦/下弦、1 = 新月/満月）を JS が付与する。照度が 0.5 を超えたら
  楕円を明側の色にする（`.is-gibbous`）。朔望月の後半は `.is-waning` で左右反転（北半球基準で明側が左）。
- 照度は `moon_daily.json` の `phase`(%) を優先し、無ければ月齢から近似する（`buildMoonPhase`）。
- **影側 `--moon-dark` は必ず不透明色**にする。明側の半円を楕円で塗り消す描き方のため、
  半透明だと新月が塗り潰せず、半月のように見えてしまう。
- 月齢はテキストで併記されるため、アイコン自体は `aria-hidden="true"`。

### 警報バッジ / フローティングアラート

- `.floating-alert.level-tokubetsu { background:#7c3aed; }`（特別警報）。通常警報は `#c0392b` 系、注意報は橙系。
- 表示/非表示は `setFloatingAlert()`（`app.js`）に集約する。`className` と `style.display` を呼び出し側で個別に触ると状態がずれる。
- **バーは `<button>`**（`data-scroll-to="jma-warning-box"` で該当カードへスクロール）。`div` +
  `tabindex="0"` にしない（Enter/Space を自前で拾う必要があり、役割も支援技術に伝わらない）。
  ブラウザ既定のボタン外観は打ち消し、フォーカスリングは画面最下端で切れないよう
  `outline-offset:-4px` と内側に引く。
- **警報文は内側の `#floating-alert-text`（`role="alert"`）に入れ、バー本体に `aria-label` を
  付けない**。`aria-label` は要素の中身より優先されるため、付けると読み上げが操作の説明に
  化け、肝心の警報内容（例:「大雨警報 発令中」）が支援技術へ一切届かない。操作の説明は
  `.visually-hidden` の一文で添える。
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
- **`max-width:360px`（320px 級端末）**: `.weather-box h2` を `flex-wrap:wrap` にし、情報源ラベル
  （`.section-source`）を2行目へ逃がす。逃がさないと `.section-source` が `flex-shrink:0` のまま
  残るため、見出し本体だけが潰れて「風予 / 報」のように語中で折れる。ラベル自体は消さない
  （どのソースの値かは三原則1の要）。
- **`prefers-contrast: more`**: 追加の UI は出さず、`--text-sub` / `--box-border` / `--hairline` /
  `--brand-soft` / `--wind-bar-gust` を強めた値へ差し替えるだけにする。砂浜の照り返し環境を想定した
  申告への応答で、配色の意味（ブランド＝ティール、警報＝赤）は変えない。

### 404 ページ（`404.html`）

- 本体と同じ `.container` ＋ ロゴ付き `<header>` を使い、外観の連続性を保つ。
- **Web フォントは読み込まない**。エラーページにリクエストを増やさず、ロゴは system sans の
  weight 900 へフォールバックさせる（グラデ文字はそのまま成立する／三原則2）。
- ページ固有のスタイル（`.nf-*`）は `<style>` にインラインで持ち、`style.css` を膨らませない。
  色・角丸・フォーカスリングは本体のトークンを参照する。

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
- **UI に絵文字を使わない**（⚠ / ✅ / 🔄 など）。`--icon-*` の mask アイコンを使う。
- 補足・注記を 11px 未満にしない（屋外・直射日光下で読めない）。
- JS ライブラリ・Web フォントを安易に追加しない（三原則2、要相談）。
- データ未取得時にダミー値を入れない。取得失敗を UI で明示する（三原則1）。
- 新規カラートークンの乱立を避ける。
- 角丸・影・イージングの実数値を各セレクタへ直書きしない（トークンを増やすか、既存を再利用する）。
