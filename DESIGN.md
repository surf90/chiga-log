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

### CSS 変数（Light / Dark）

| 変数 | Light | Dark | 用途 |
|------|-------|------|------|
| `--bg-gradient` | `linear-gradient(160deg,#FFFBEB 0%,#EFF6FF 100%)` | `linear-gradient(160deg,#121212 0%,#1e1e1e 100%)` | ページ背景 |
| `--text-main` | `#222222` | `#e2e8f0` | 本文・見出し |
| `--text-sub` | `#707070` | `#94a3b8` | 補足・ラベル |
| `--container-bg` | `rgba(255,255,255,0.75)` | `rgba(30,30,30,0.85)` | 外枠コンテナ（ガラス調） |
| `--container-shadow` | `0 4px 24px rgba(0,86,120,0.10)` | `0 4px 24px rgba(0,0,0,0.4)` | コンテナの影 |
| `--box-bg` | `#ffffff` | `#2a2a2a` | カード/ボックス背景 |
| `--box-border` | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.08)` | ボックス境界 |
| `--warning-bg` | `#fff5f5` | `#3f1d1d` | 警報ボックス背景 |
| `--warning-border` | `#c0392b` | `#ef4444` | 警報ボックス枠 |

### ブランド/アクセント（変数化されていない固定値）

- **ブランドグラデ**: `linear-gradient(135deg,#0e7490 0%,#0284c7 100%)`（ティール→ブルー）。ヒーロータイトル文字（`background-clip:text`）とヒーローカード背景に使用。
- **アクセント文字/リンク**: `#0e7490`（ティール）。数値ハイライト・リンク・点線下線・アウトラインボタン枠。
- **警報系**: 通常警報 `#c0392b`、特別警報 `#7c3aed`（紫）、注意報レベルは橙系（`#e67e22` / `#d97706`）。

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
- フォントは可変フォント＋サブセットで最小化（三原則2）。Web フォント追加は要相談。

### サイズ・ウェイト階層（実測）

| Role | Size | Weight | 備考 |
|------|------|--------|------|
| ヒーロータイトル | 2.4rem | 900 | ブランドグラデ文字 |
| セクション数値（大） | 1.6rem | 700 | カード主数値 |
| 見出し（中） | 1.2rem〜1rem | 600 | サブ見出し |
| ラベル | 12px | 600 | カードラベル |
| 本文 | 15px (body) | 400 | 既定 |
| 補足・キャプション | 11px | 400/700 | 単位・注記（等幅多用、小型端末の可読性確保のため最小11px） |

---

## 4. Components

### コンテナ
- `max-width:600px` / `padding:32px 24px` / `border-radius:16px` / `background:var(--container-bg)` / `box-shadow:var(--container-shadow)`。

### カード / ボックス
- ヒーローカード: ブランドグラデ背景・文字 `#fff`・`border-radius:12px`・`padding:14px 8px 12px`。
- 情報ボックス: `background:var(--box-bg)`・`border:1px solid var(--box-border)`・`border-radius:10px`・`padding:20px 24px`。

### ボタン
- アウトライン型: `border:1px solid #0e7490` / `color:#0e7490` / 背景透明。

### 警報バッジ / フローティングアラート
- `.floating-alert.level-tokubetsu { background:#7c3aed; }`（特別警報）。通常警報は `#c0392b` 系、注意報は橙系。

### 津波カード（`#tsunami-box`）
- 相模湾・三浦半島（予報区330）に津波注意報/警報発表時のみ、ページ最上部に表示（通常は `hidden`）。`.warning-active` の赤枠・赤背景を流用。
- バッジ配色: 大津波警報 `.badge-tsunami-major` `#7c3aed`（紫）／津波警報 `.badge-tsunami-warn` `#c0392b`（赤）／津波注意報 `.badge-tsunami-adv` `#d97706`（橙）。

### データ鮮度の警告表示
- 目的: 更新停止（Actions 停止・API 障害）や古いデータを閲覧者に明示し、誤読を防ぐ（三原則1）。閾値はデータ種別ごとに個別（`app.js` の `FRESHNESS`）。
- `.stale-banner`（`#stale-banner`）: 更新パイプライン停止時にコンテンツ最上部へ表示。`--warning-bg`/`--warning-border` を流用、`border-radius:8px`、中央寄せ。通常は `hidden`。
- `.stale-note`（各セクション見出し直下）/ `.stale-inline`（`#tsunami-error`）: 該当データが閾値超で古い/取得失敗時に小さく赤字（`--warning-border`, 12px）で注記。通常は `hidden`。
- `.current-time.is-stale`: データが古い場合に「更新日時」の下線・文字色を `--warning-border` に切替（データ生成時刻＋経過時間を表示）。
- トグルは `hidden` 属性で行うため、これらは `display` を指定しない。

### 角丸スケール
| 用途 | radius |
|------|--------|
| コンテナ | 16px |
| カード | 12px |
| ボックス | 10px |
| 小要素 | 6px |

---

## 5. Layout & Responsive

- **レイアウト**: 単一カラム、中央寄せ（`max-width:600px`）。明示的なブレークポイントは持たず（モバイル幅基準で PC でも 600px 固定）、唯一のメディアクエリは `prefers-color-scheme: dark`。
- **余白/gap**: カード間 `gap:10px`、要素内 `gap:4〜7px`、body `padding:24px 16px`。
- **タッチターゲット**: 屋外・指操作前提で十分な高さを確保（最小 44px 目安）。

---

## 6. Do's / Don'ts

### Do
- 色は CSS 変数とブランドアクセント `#0e7490` / グラデ `#0e7490→#0284c7` を再利用する。
- ダークモード（`prefers-color-scheme: dark`）の見え方を必ず確認する。
- 数値・単位・ラベルは等幅フォントで揃える。
- テキスト色は `#222222`（ライト）/ `#e2e8f0`（ダーク）。

### Don't
- 純黒 `#000000` を使わない。
- JS ライブラリ・Web フォントを安易に追加しない（三原則2、要相談）。
- データ未取得時にダミー値を入れない。取得失敗を UI で明示する（三原則1）。
- 新規カラートークンの乱立を避ける。
