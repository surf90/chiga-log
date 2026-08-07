// ============================================================
// ちがログ フロントエンドアプリ
//
// セクション構成:
//   0. 定数 / モジュール状態
//   1. キャッシュヘルパー (sessionStorage/localStorage 統合)
//   2. ユーティリティ (風向き、JST日付など)
//   3. チャート共通 (X軸構築、スクロール同期、Nowライン)
//   4. 潮汐 (calculateTide, fetchTideExtremes, drawTideChart)
//   5. 波 (fetchWaveGuidance, drawWaveCombinedChart)
//   6. 警報・注意報 / 熱中症情報 (fetchJmaWarning, fetchHeatstrokeAlert)
//   7. 天気予報 (fetchJmaForecast)
//   8. 風予報 (fetchWindForecast)
//   9. 統合フェッチ (fetchWeatherData)
//  10. ダークモード追従
//  11. DOMイベントバインド (onclick除去後の置換)
// ============================================================

// ─── 0. 定数 / モジュール状態 ───────────────────────────────
// 地点設定: Jekyll が site-config.js に展開した window.SITE_CONFIG を参照。
// 未定義（生配信・CSP遮断・読込失敗）時は現行リテラルにフォールバックする。
const _cfg = window.SITE_CONFIG || {};
const _cfgJma = _cfg.jma || {};
const WAVE_GUID_AREA = _cfgJma.wave_guid_area ?? "20";
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
const STORAGE_PREFIX = "chigalog:v6:";
const _reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

let _isFetching = false;
let _toastShown = false;
let _lastFetchTime = Date.now();

let tideChartInstance = null;
let waveChartInstance = null;
let chartXMin = null;
const CHART_DAYS = 2;
const PX_PER_HOUR = 14;
const CHART_TOTAL_PX = PX_PER_HOUR * 24 * CHART_DAYS;
let chartScrollSynced = false;
let windForecastRange = "";
// 波グラフの描画元データ。潮汐が後着でx軸原点を確定させた場合に、
// 同じ原点で描き直すため保持する（下の drawTideChart 参照）。
let waveChartData = null;

// ─── 1. キャッシュヘルパー ──────────────────────────────────
/**
 * URLからJSONを取得し、指定ストレージにTTL付きでキャッシュする。
 * @param {string} url
 * @param {string} key
 * @param {{store?: 'session'|'local', ttlMs?: number}} [opts]
 */
async function fetchCached(
  url,
  key,
  { store = "session", ttlMs = 30 * 60 * 1000, force = false } = {},
) {
  const storage = store === "local" ? localStorage : sessionStorage;
  // 同オリジン内の他コードとのキー衝突を避けるためプレフィックスを付与する
  key = STORAGE_PREFIX + key;
  const cached = storage.getItem(key);
  // 手動更新(force)時はキャッシュ読み取りをスキップし常に再取得する
  if (!force && cached) {
    try {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < ttlMs) return data;
    } catch {
      storage.removeItem(key);
    }
  }
  const res = await fetchWithTimeout(url, { force });
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const data = await res.json();
  try {
    storage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // QuotaExceeded等は無視（取得済みデータはそのまま返す）
  }
  return data;
}

// ─── 1.5 データ鮮度（stale）判定 ──────────────────────────────
// 各データJSONの updated_at / fetchedAt を読み、更新停止や古いデータを
// UI上で明示する（三原則1: 誤読を誘発しない）。閾値は cron 頻度＋余裕で
// データ種別ごとに個別設定（数回のスキップは許容）。
const FRESHNESS = {
  marine: 3 * 3600e3, // weather_marine: */30 → 3時間で更新停止疑い
  wind: 3 * 3600e3, // wind_forecast: */30
  forecast: 18 * 3600e3, // forecast: 1日3回(~8h間隔)
  wave: 15 * 3600e3, // wave_guid: 1日3回(~6h間隔)
  warning: 3 * 3600e3, // warning: */30 (fetchedAt基準)
  tide: 30 * 3600e3, // tide_widget: 日次
};

/**
 * データJSONから生成時刻を種別非依存で取り出す（命名揺れ吸収）。
 * updated_at / fetchedAt / observed_at のいずれかを順にフォールバック。
 * @param {object|null|undefined} obj データオブジェクト
 * @returns {string|null} ISO日時文字列、なければ null
 */
function pickTimestamp(obj) {
  return obj?.updated_at ?? obj?.fetchedAt ?? obj?.observed_at ?? null;
}

/**
 * ISO日時文字列を epoch ミリ秒へ変換する。解釈不能なら null。
 * @param {string} s
 * @returns {number|null}
 */
function parseIso(s) {
  if (!s || typeof s !== "string") return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : ms;
}

/**
 * 経過ミリ秒を「12分前」「3時間前」「2日前」の日本語表記へ整形する。
 * @param {number} ageMs
 * @returns {string}
 */
function humanAge(ageMs) {
  const min = Math.max(0, Math.floor(ageMs / 60000));
  if (min < 60) return `${min}分前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}時間前`;
  return `${Math.floor(hour / 24)}日前`;
}

/**
 * updated_at と閾値から鮮度情報を返す。
 * @param {string} iso 生成時刻のISO文字列
 * @param {number} thresholdMs 古いと判定する経過ミリ秒
 * @returns {{ms: number|null, ageMs: number|null, isStale: boolean, label: string}}
 */
function freshness(iso, thresholdMs) {
  const ms = parseIso(iso);
  if (ms == null) return { ms: null, ageMs: null, isStale: false, label: "" };
  const ageMs = Date.now() - ms;
  return {
    ms,
    ageMs,
    isStale: ageMs > thresholdMs,
    label: humanAge(ageMs),
  };
}

/**
 * セクション別の stale 注記要素を鮮度に応じて出し分ける。
 * 古い場合のみ「最終更新 X前」を表示、新鮮なら hidden に戻す。
 * @param {string} noteElId 注記要素のid
 * @param {string} iso 生成時刻のISO文字列
 * @param {number} thresholdMs 閾値ミリ秒
 */
function markStale(noteElId, iso, thresholdMs) {
  const el = document.getElementById(noteElId);
  if (!el) return;
  const f = freshness(iso, thresholdMs);
  if (f.isStale) {
    el.textContent = `⚠ データが古い可能性（最終更新 ${f.label}）`;
    el.hidden = false;
  } else {
    el.hidden = true;
  }
}

/** ミリ秒(epoch)を JST の "HH:MM"（時をゼロ埋め）に整形する。ブラウザTZ非依存。 */
function formatJstHhMm(ms) {
  const jst = new Date(ms + JST_OFFSET_MS);
  return (
    String(jst.getUTCHours()).padStart(2, "0") +
    ":" +
    String(jst.getUTCMinutes()).padStart(2, "0")
  );
}

/** ミリ秒(epoch)を JST の "H:MM"（時は先頭ゼロなし）に整形する。ブラウザTZ非依存。 */
function formatJstHm(ms) {
  const jst = new Date(ms + JST_OFFSET_MS);
  return jst.getUTCHours() + ":" + String(jst.getUTCMinutes()).padStart(2, "0");
}

// ─── 2. ユーティリティ ──────────────────────────────────────
/**
 * タイムアウト付き fetch。既定10秒を超えると AbortError を投げる。
 * 回線ハング時にローディング表示が固着するのを防ぐ。
 * @param {string} url
 * @param {{timeoutMs?: number}} [opts]
 * @returns {Promise<Response>}
 */
function fetchWithTimeout(url, { timeoutMs = 10000, force = false } = {}) {
  const opts = { signal: AbortSignal.timeout(timeoutMs) };
  // 手動更新時はHTTPキャッシュを迂回しネットワークから再取得する
  if (force) opts.cache = "reload";
  return fetch(url, opts);
}

/**
 * id要素が存在すれば textContent を設定する（無ければ何もしない）。
 * @param {string} id
 * @param {string} text
 */
function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/**
 * `media="print"` で先読みしたCSS（Webフォント）を、読み込み完了後に
 * `data-media-onload` の値へ切り替えて適用する。
 *
 * CSP `script-src 'self'` 下ではインラインの onload 属性が実行されない
 * （script-src-attr は script-src にフォールバックする）ため、従来の
 * `onload="this.media='all'"` はブロックされフォントが当たらなかった。
 * defer 実行時点で既に読み込み済み（link.sheet あり）なら即時適用する。
 */
function applyDeferredStyles() {
  document.querySelectorAll("link[data-media-onload]").forEach((link) => {
    const media = link.dataset.mediaOnload;
    if (!media) return;
    if (link.sheet) {
      link.media = media;
      return;
    }
    link.addEventListener(
      "load",
      () => {
        link.media = media;
      },
      { once: true },
    );
  });
}

function getWindDirection16(degree) {
  // null/空文字は Number() で 0 になり「北」と誤表示されるため先に弾く。
  if (degree == null || degree === "") return "--";
  const deg = Number(degree);
  if (!Number.isFinite(deg)) return "--";
  const directions = [
    "北",
    "北北東",
    "北東",
    "東北東",
    "東",
    "東南東",
    "南東",
    "南南東",
    "南",
    "南南西",
    "南西",
    "西南西",
    "西",
    "西北西",
    "北西",
    "北北西",
  ];
  // 負値・360超も 0-15 に正規化する（負の剰余で undefined になるのを防ぐ）
  return directions[((Math.round(deg / 22.5) % 16) + 16) % 16];
}

function getWindDirectionJma(num) {
  // 気象庁アメダスの風向: 1=北北東, 2=北東, ..., 16=北, 0=静穏
  if (num == null) return "--";
  if (num === 0) return "静穏";
  const directions = [
    "北北東",
    "北東",
    "東北東",
    "東",
    "東南東",
    "南東",
    "南南東",
    "南",
    "南南西",
    "南西",
    "西南西",
    "西",
    "西北西",
    "北西",
    "北北西",
    "北",
  ];
  return directions[(num - 1) % 16] || "--";
}

/** Dateを「JST基準のYYYY-MM-DD」文字列に変換する。 */
function toJstDateStr(date) {
  return new Date(date.getTime() + JST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 「更新日時」表示を更新する。
 * リロード・手動更新でデータを参照できた時点の現在時刻を表示する
 * （Actions側のデータ生成を待たず、参照の成功を示す）。
 * データ生成時刻(iso)が閾値超過なら「（データ: X前）⚠」を併記して
 * 古いデータであることを警告する。
 * @param {string|null} [iso] weather_marine 等の updated_at
 * @param {number} [thresholdMs] 古いと判定する閾値
 */
function displayFetchTime(iso = null, thresholdMs = FRESHNESS.marine) {
  const el = document.getElementById("current-time");
  if (!el) return;
  const options = {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  const dt = new Date().toLocaleString("ja-JP", options);
  const f = iso ? freshness(iso, thresholdMs) : null;
  if (f && f.isStale) {
    el.textContent = `更新日時: ${dt}（データ: ${f.label}）⚠`;
    el.classList.add("is-stale");
  } else {
    el.textContent = `更新日時: ${dt} 🔄`;
    el.classList.remove("is-stale");
  }
}

// ─── 3. チャート共通 ────────────────────────────────────────
const nowLinePlugin = {
  id: "nowLine",
  afterDraw(chart) {
    const now = Date.now();
    const xScale = chart.scales.x;
    if (now < xScale.min || now > xScale.max) return;
    const x = xScale.getPixelForValue(now);
    const ctx = chart.ctx;
    const { top, bottom } = chart.chartArea;
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#ff6600";
    ctx.fillRect(x - 3, top, 6, bottom - top);
    ctx.restore();
  },
};

/**
 * Y軸をスクロールに追従させず、常に表示領域の端に貼り付けて描画する。
 *
 * グラフは2日分(672px)を横スクロールで見せるため、「今」の位置へ寄せると
 * キャンバス左端に描かれたY軸（潮位m・波高m）が画面外へ出てしまう。
 * スクロール量ぶん平行移動した位置へ、カード背景で下地を塗ってから
 * Chart.js の scale 自身に再描画させることで、目盛りの見た目を保ったまま
 * 軸だけを固定する。右側の軸（周期）は表示領域の右端へ貼り付ける。
 */
const stickyYAxisPlugin = {
  id: "stickyYAxis",
  afterDraw(chart) {
    const scroller = chart.canvas.closest(".chart-scroll");
    if (!scroller) return;
    const maxScroll = scroller.scrollWidth - scroller.clientWidth;
    if (maxScroll <= 0) return;
    const bg =
      getComputedStyle(chart.canvas).getPropertyValue("--box-bg").trim() ||
      "#ffffff";
    Object.values(chart.scales).forEach((scale) => {
      if (scale.axis !== "y" || scale.options.display === false) return;
      const dx =
        scale.position === "right"
          ? scroller.scrollLeft - maxScroll
          : scroller.scrollLeft;
      if (dx === 0) return; // 端まで戻っていれば元の位置で既に見えている
      const ctx = chart.ctx;
      ctx.save();
      ctx.translate(dx, 0);
      // データ線とX軸ラベルの断片が目盛りの下に透けないよう、
      // 軸の幅ぶんをキャンバス全高で塗りつぶしてから軸を描く。
      ctx.fillStyle = bg;
      ctx.fillRect(scale.left, 0, scale.width, chart.height);
      scale.draw(chart.chartArea);
      ctx.restore();
    });
  },
};

/**
 * 横スクロール中にY軸の貼り付け位置を追従させる。
 * スクロールイベントごとではなく1フレームに1回へ間引く。
 */
let _axisRedrawQueued = false;
function redrawChartAxesForScroll() {
  if (_axisRedrawQueued) return;
  _axisRedrawQueued = true;
  requestAnimationFrame(() => {
    _axisRedrawQueued = false;
    if (tideChartInstance) tideChartInstance.draw();
    if (waveChartInstance) waveChartInstance.draw();
  });
}

function buildChartXTicks(xMin, xMax) {
  const h4ms = 4 * 60 * 60 * 1000;
  const ticks = [{ value: xMin }];
  const xMinJst = xMin + JST_OFFSET_MS;
  const firstBoundary = Math.ceil(xMinJst / h4ms) * h4ms - JST_OFFSET_MS;
  for (let t = firstBoundary; t <= xMax; t += h4ms) {
    if (t > xMin + 60000) ticks.push({ value: t });
  }
  return ticks;
}

function chartXTickCallback(value, index) {
  const d = new Date(value + JST_OFFSET_MS);
  const jstH = d.getUTCHours();
  const jstM = d.getUTCMinutes();
  const timeStr =
    jstM === 0 ? jstH + ":00" : jstH + ":" + String(jstM).padStart(2, "0");
  if (jstH === 0 && jstM === 0 && index > 0) {
    return d.getUTCMonth() + 1 + "/" + d.getUTCDate() + " " + timeStr;
  }
  return timeStr;
}

function setChartContainerWidth(containerId, px) {
  const el = document.getElementById(containerId);
  if (el) el.style.width = px + "px";
}

function syncChartScroll() {
  if (chartScrollSynced) return;
  const tideScroll = document.getElementById("tide-chart-scroll");
  const waveScroll = document.getElementById("wave-chart-scroll");
  // 片方が未生成の段階で呼ばれても恒久的に同期を無効化しないよう、
  // 両要素が揃ってから「登録済み」フラグを立てる。
  if (!tideScroll || !waveScroll) return;
  chartScrollSynced = true;
  let syncing = false;
  tideScroll.addEventListener(
    "scroll",
    () => {
      redrawChartAxesForScroll();
      if (syncing) return;
      syncing = true;
      waveScroll.scrollLeft = tideScroll.scrollLeft;
      syncing = false;
    },
    { passive: true },
  );
  waveScroll.addEventListener(
    "scroll",
    () => {
      redrawChartAxesForScroll();
      if (syncing) return;
      syncing = true;
      tideScroll.scrollLeft = waveScroll.scrollLeft;
      syncing = false;
    },
    { passive: true },
  );
}

function scrollChartsToNow() {
  if (chartXMin === null) return;
  const nowMs = Date.now();
  const pxPerMs = PX_PER_HOUR / (60 * 60 * 1000);
  const scrollLeft = Math.max(0, (nowMs - chartXMin) * pxPerMs - 80);
  const tideScroll = document.getElementById("tide-chart-scroll");
  const waveScroll = document.getElementById("wave-chart-scroll");
  if (tideScroll) tideScroll.scrollLeft = scrollLeft;
  if (waveScroll) waveScroll.scrollLeft = scrollLeft;
}

// ─── 4. 潮汐 ────────────────────────────────────────────────
async function calculateTide(force = false) {
  const synodicMonth = 29.530588853;
  const knownNewMoon = new Date("2000-01-06T18:14:00+09:00").getTime();
  const targetDate = new Date();
  targetDate.setHours(12, 0, 0, 0);

  let age =
    ((targetDate.getTime() - knownNewMoon) / (1000 * 60 * 60 * 24)) %
    synodicMonth;
  if (age < 0) age += synodicMonth;
  let ageSource = "計算値";

  try {
    // 日付キーはJST基準。toISOString()(UTC)だと 0-9時JSTの間だけ前日キーのまま
    // となり、日次ジョブ(JST 0:05)が更新した月齢を最大9時間拾えない。
    const dayKey = toJstDateStr(new Date());
    const resp = await fetchWithTimeout(`data/moon_daily.json?d=${dayKey}`, {
      force,
    });
    if (resp.ok) {
      const moonToday = await resp.json();
      const nasaAge = parseFloat(moonToday.age);
      // NaN や範囲外は採用せず計算値のまま（"月齢: NaN" 表示を防ぐ）
      if (Number.isFinite(nasaAge) && nasaAge >= 0 && nasaAge < 30) {
        age = nasaAge;
        ageSource = "NASA";
      }
    }
  } catch {
    // フォールバック：数式の計算値を使用
  }

  const r = Math.round(age) % 30;
  let tideType;
  if (r === 29 || r <= 2 || (r >= 14 && r <= 16)) tideType = "大潮";
  else if (
    (r >= 3 && r <= 6) ||
    (r >= 12 && r <= 13) ||
    (r >= 17 && r <= 20) ||
    (r >= 26 && r <= 28)
  )
    tideType = "中潮";
  else if ((r >= 7 && r <= 9) || (r >= 21 && r <= 23)) tideType = "小潮";
  else if (r === 10 || r === 24) tideType = "長潮";
  else if (r === 11 || r === 25) tideType = "若潮";
  else tideType = "不明";

  const ageLabel =
    ageSource === "NASA"
      ? `月齢: ${age.toFixed(1)}`
      : `月齢: ${age.toFixed(1)} / 計算値`;
  const tideTypeEl = document.getElementById("tide-type");
  if (!tideTypeEl) return;
  tideTypeEl.textContent = "";
  tideTypeEl.appendChild(document.createTextNode(tideType + " "));
  const ageSpan = document.createElement("span");
  ageSpan.className = "tide-age-label";
  ageSpan.textContent = `(${ageLabel})`;
  tideTypeEl.appendChild(ageSpan);
}

function updateTideSource(sourceName) {
  const el = document.getElementById("tide-source-label");
  if (el) el.textContent = sourceName;
}

function showTideError() {
  // 三原則1: 取得失敗時はダミー値を出さず、UI上で明示する。
  const container = document.getElementById("tide-extremes-container");
  if (!container) return;
  container.innerHTML = "";
  const row = document.createElement("div");
  row.className = "data-row tide-error";
  row.textContent = "※潮汐データの取得に失敗しました。";
  container.appendChild(row);
  const chartContainer = document.getElementById("tide-chart-container");
  if (chartContainer) chartContainer.style.display = "none";
}

async function fetchTideExtremes(force = false) {
  setText("tide-status", "読み込み中...");

  if (!window.location.protocol.startsWith("http")) {
    showTideError();
    updateTideSource("file:// プロトコル非対応");
    return;
  }

  try {
    // 月齢と同じくJST基準。UTC日付だと日替わり直後の潮汐表を取り逃がす。
    const dayKey = toJstDateStr(new Date());
    const res = await fetchWithTimeout(`data/tide_widget.json?d=${dayKey}`, {
      force,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const todayTides = data.today || [];
    const allTides = Object.values(data.forecast || {}).flat();

    if (allTides.length > 0) {
      displayTideData(todayTides, allTides);
      updateTideSource(data.source || "気象庁");
      markStale("tide-stale", pickTimestamp(data), FRESHNESS.tide);
      return;
    }
    throw new Error("tide_widget.json にデータがありません");
  } catch (e) {
    console.error("tide_widget.json 取得失敗:", e);
    showTideError();
    updateTideSource("取得失敗");
  }
}

// extremes: 当日のみ（テキスト表示用）、chartExtremes: 複数日（グラフ用）
function displayTideData(extremes, chartExtremes) {
  const container = document.getElementById("tide-extremes-container");
  container.innerHTML = "";

  if (!extremes || extremes.length === 0) {
    const row = document.createElement("div");
    row.className = "data-row";
    const l = document.createElement("dt");
    l.textContent = "満潮・干潮:";
    const v = document.createElement("dd");
    v.textContent = "データなし";
    row.append(l, " ", v);
    container.appendChild(row);
    return;
  }

  const highTides = [],
    lowTides = [];
  extremes.forEach((item) => {
    const dateObj = new Date(item.time);
    // 潮汐データはJST基準。閲覧端末のTZに引きずられないよう固定で整形する。
    const timeStr = formatJstHhMm(dateObj.getTime());
    (item.type === "high" ? highTides : lowTides).push({
      timeStr,
      height: item.height,
    });
  });

  const addRow = (label, list, cssClass) => {
    const row = document.createElement("div");
    row.className = "data-row";
    const labelSpan = document.createElement("dt");
    labelSpan.textContent = label + ":";
    const valueSpan = document.createElement("dd");
    valueSpan.className = cssClass;
    list.forEach((entry, idx) => {
      if (idx > 0) {
        const sep = document.createElement("span");
        sep.className = "tide-sep";
        sep.textContent = " , ";
        valueSpan.appendChild(sep);
      }
      valueSpan.appendChild(document.createTextNode(entry.timeStr));
      if (entry.height != null) {
        const h = document.createElement("span");
        h.className = "tide-height";
        h.textContent = ` (${parseFloat(entry.height).toFixed(1)} m)`;
        valueSpan.appendChild(h);
      }
    });
    row.append(labelSpan, " ", valueSpan);
    container.appendChild(row);
  };
  if (highTides.length > 0) addRow("満潮", highTides, "tide-high");
  if (lowTides.length > 0) addRow("干潮", lowTides, "tide-low");

  const chartData = chartExtremes || extremes;
  const chartDataPoints = [];
  let hasHeightData = false;
  chartData.forEach((item) => {
    const dateObj = new Date(item.time);
    const timeStr = formatJstHhMm(dateObj.getTime());
    let heightValue = item.type === "high" ? 1 : 0;
    if (item.height != null) {
      hasHeightData = true;
      heightValue = parseFloat(item.height);
    }
    chartDataPoints.push({
      timeMs: dateObj.getTime(),
      timeStr,
      type: item.type,
      height: heightValue,
    });
  });
  drawTideChart(chartDataPoints, hasHeightData);
}

function drawTideChart(extremes, hasHeightData) {
  const chartContainer = document.getElementById("tide-chart-container");
  chartContainer.style.display = "block";
  setChartContainerWidth("tide-chart-container", CHART_TOTAL_PX);

  const canvas = document.getElementById("tideChart");
  canvas.width = CHART_TOTAL_PX;
  canvas.height = 160;
  const ctx = canvas.getContext("2d");

  extremes.sort((a, b) => a.timeMs - b.timeMs);
  // 潮汐と波は Promise.allSettled で並行取得するため到着順が不定。波が先着
  // した場合、波グラフは暫定原点(当日4時)で軸を作っている。ここで原点が
  // 動くと、scrollLeft を同期している2つのグラフの時刻軸がずれるため、
  // ずれた場合だけ波グラフを同じ原点で描き直す。
  const prevXMin = chartXMin;
  chartXMin = extremes[0].timeMs;
  const needWaveRedraw =
    waveChartInstance !== null &&
    waveChartData !== null &&
    prevXMin !== null &&
    prevXMin !== chartXMin;
  const xMax = chartXMin + CHART_DAYS * 24 * 60 * 60 * 1000;

  const dataPoints = [],
    pointRadii = [],
    pointColors = [];
  if (extremes.length >= 2) {
    const step = 30 * 60 * 1000;
    for (let i = 0; i < extremes.length - 1; i++) {
      const pt1 = extremes[i],
        pt2 = extremes[i + 1];
      dataPoints.push({ x: pt1.timeMs, y: pt1.height });
      pointRadii.push(5);
      pointColors.push(pt1.type === "high" ? "#0275d8" : "#d9534f");
      for (let t = pt1.timeMs + step; t < pt2.timeMs; t += step) {
        const norm = (t - pt1.timeMs) / (pt2.timeMs - pt1.timeMs);
        const cosV = (1 - Math.cos(Math.PI * norm)) / 2;
        dataPoints.push({
          x: t,
          y: pt1.height + (pt2.height - pt1.height) * cosV,
        });
        pointRadii.push(0);
        pointColors.push("#0056b3");
      }
    }
    const last = extremes[extremes.length - 1];
    dataPoints.push({ x: last.timeMs, y: last.height });
    pointRadii.push(5);
    pointColors.push(last.type === "high" ? "#0275d8" : "#d9534f");
  }

  if (tideChartInstance) {
    tideChartInstance.destroy();
    tideChartInstance = null;
  }
  const xTicks = buildChartXTicks(chartXMin, xMax);
  // 極値が1件しか無い日は補間点が作れず dataPoints が空になる。
  // Math.min(...[]) は Infinity のため、そのまま軸へ渡すと目盛りが壊れる。
  const ys = dataPoints.map((d) => d.y);
  const yMin = ys.length ? Math.min(...ys) - 0.2 : -0.2;
  const yMax = ys.length ? Math.max(...ys) + 0.2 : 1.2;

  tideChartInstance = new Chart(ctx, {
    type: "line",
    plugins: [nowLinePlugin, stickyYAxisPlugin],
    data: {
      datasets: [
        {
          label: hasHeightData ? "潮位 (m)" : "潮位イメージ",
          data: dataPoints,
          borderColor: "#0056b3",
          backgroundColor: "rgba(0,86,179,0.15)",
          borderWidth: 2,
          pointBackgroundColor: pointColors,
          pointBorderColor: "#fff",
          pointRadius: pointRadii,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              return items.length ? formatJstHm(items[0].parsed.x) : "";
            },
            label: (c) =>
              hasHeightData ? c.parsed.y.toFixed(2) + " m" : "潮位イメージ",
          },
        },
      },
      scales: {
        y: {
          display: hasHeightData,
          suggestedMin: hasHeightData ? yMin : -0.2,
          suggestedMax: hasHeightData ? yMax : 1.2,
          ticks: { callback: (v) => v.toFixed(1) + " m" },
          afterFit: (scale) => {
            scale.width = 55;
          },
        },
        x: {
          type: "linear",
          min: chartXMin,
          max: xMax,
          afterBuildTicks(axis) {
            axis.ticks = xTicks;
          },
          ticks: { maxRotation: 0, callback: chartXTickCallback },
          grid: { display: false },
        },
      },
    },
  });

  if (needWaveRedraw) {
    waveChartInstance = drawWaveCombinedChart(
      "waveChart",
      waveChartInstance,
      waveChartData,
    );
  }

  syncChartScroll();
  scrollChartsToNow();
}

// ─── 5. 波 ──────────────────────────────────────────────────
async function fetchWaveGuidance(force = false) {
  try {
    const hour3Buster = Math.floor(Date.now() / (3 * 60 * 60 * 1000));
    const resp = await fetchWithTimeout(
      `data/wave_guid_${WAVE_GUID_AREA}.json?t=${hour3Buster}`,
      { force },
    );
    if (!resp.ok)
      throw new Error(`wave_guid_${WAVE_GUID_AREA}.json の読み込みに失敗`);
    const json = await resp.json();

    // ロケール文字列の再パース（実装依存でInvalid Dateになり得る）を避け、
    // JSTオフセット加算による日付算出で統一する。
    // グラフのx軸は「当日最初の干満潮時刻」を原点に48時間ぶんなので、右端は
    // 翌々日の未明まで伸びる。日付は CHART_DAYS+1 日ぶん丸ごと拾っておき、
    // 実際の表示範囲での切り出しは drawWaveCombinedChart 側に任せる
    // （原点が確定するのは潮汐の到着後のため）。
    const dateStrs = [];
    for (let i = 0; i <= CHART_DAYS; i++) {
      dateStrs.push(toJstDateStr(new Date(Date.now() + i * 86400000)));
    }

    const todayData = (json.data || []).filter(
      (d) =>
        typeof d?.time === "string" &&
        dateStrs.some((s) => d.time.startsWith(s)),
    );
    if (todayData.length === 0) throw new Error("本日の波浪データがありません");

    waveChartData = todayData;
    waveChartInstance = drawWaveCombinedChart(
      "waveChart",
      waveChartInstance,
      todayData,
    );

    document.getElementById("wave-guid-loading").classList.add("hidden");
    document.getElementById("wave-guid-content").classList.remove("hidden");
    markStale("wave-stale", pickTimestamp(json), FRESHNESS.wave);
  } catch (e) {
    console.error("Wave guidance error:", e);
    document.getElementById("wave-guid-loading").classList.add("hidden");
    document.getElementById("wave-guid-error").style.display = "block";
  }
}

// 波高軸が取りうる最小の表示幅 [m]。下限をデータに追従させると凪の日に
// 0.1m の差が画面全高に引き伸ばされ大波と誤読されるため、この幅までは
// 必ず軸を広げて変動の小ささが見た目に残るようにする。
const WAVE_MIN_SPAN_M = 1.0;

// 気象庁 波浪ガイダンスの時間刻み。表示範囲の前後にこの1コマぶんを含めて
// 線を端まで届かせる。
const WAVE_STEP_MS = 3 * 60 * 60 * 1000;

/**
 * 波高軸の下限・上限・目盛り間隔を決める。
 *
 * データ範囲を含む 0.5 の倍数へ丸めた下限・上限を取り、目盛りは常に
 * 0.5 の倍数刻みにする。Chart.js の自動スケールに任せると凪の日
 * （例: 1.5〜1.6m）に 0.03 刻みの目盛りが作られ、0.1m 単位の表示で
 * 同じラベルが並ぶ。下限は 0 を下回らない。
 *
 * @param {number[]} values 波高の配列 [m]
 * @returns {{min: number, max: number, stepSize: number}} 軸設定
 */
function waveAxisBounds(values) {
  const round = (v) => Math.round(v * 100) / 100;
  const valid = values.filter((v) => Number.isFinite(v));
  if (valid.length === 0)
    return { min: 0, max: WAVE_MIN_SPAN_M, stepSize: 0.5 };

  const dataMin = Math.min(...valid);
  const dataMax = Math.max(...valid);
  const span = Math.max(dataMax - dataMin, WAVE_MIN_SPAN_M);
  const stepSize = [0.5, 1, 2, 5].find((s) => span <= s * 4) ?? 10;

  let min = Math.max(0, Math.floor(dataMin / stepSize) * stepSize);
  let max = Math.ceil(dataMax / stepSize) * stepSize;
  // 最小表示幅を満たすまで広げる。0 に近い側を優先して伸ばし、
  // 下限が 0 に達したら上限側へ回す。
  while (max - min < WAVE_MIN_SPAN_M - 1e-9) {
    if (min > 0) min = Math.max(0, min - stepSize);
    else max += stepSize;
  }
  return { min: round(min), max: round(max), stepSize };
}

function drawWaveCombinedChart(canvasId, existingInstance, data) {
  if (existingInstance) {
    existingInstance.destroy();
    existingInstance = null;
  }

  const todayJstStartMs =
    Math.floor((Date.now() + JST_OFFSET_MS) / 86400000) * 86400000 -
    JST_OFFSET_MS;
  const xMin =
    chartXMin !== null ? chartXMin : todayJstStartMs + 4 * 60 * 60 * 1000;
  // 潮汐取得が失敗した場合でも scrollChartsToNow() が波グラフを
  // 「今」へ寄せられるよう、共有の基準時刻を確定させる。
  if (chartXMin === null) chartXMin = xMin;
  const xMax = xMin + CHART_DAYS * 24 * 60 * 60 * 1000;

  // 表示範囲で切り出す。ガイダンスは3時間刻みなので前後1コマぶんを含めて
  // おき、線が両端まで届くようにする（含めないと右端に最大3時間の空白が
  // 残る）。範囲外を除くことで、画面に出ていない値が波高軸のスケールを
  // 引き伸ばすのも防ぐ。
  const visible = data.filter((d) => {
    const t = new Date(d.time).getTime();
    return t >= xMin - WAVE_STEP_MS && t <= xMax + WAVE_STEP_MS;
  });

  const heightData = visible.map((d) => ({
    x: new Date(d.time).getTime(),
    y: d.wave_height,
  }));
  const waveAxis = waveAxisBounds(heightData.map((d) => d.y));
  const periodData = visible.map((d) => ({
    x: new Date(d.time).getTime(),
    y: d.period,
  }));

  setChartContainerWidth("wave-chart-container", CHART_TOTAL_PX);
  const waveXTicks = buildChartXTicks(xMin, xMax);

  const waveCanvas = document.getElementById(canvasId);
  waveCanvas.width = CHART_TOTAL_PX;
  waveCanvas.height = 200;
  const ctx = waveCanvas.getContext("2d");
  const chart = new Chart(ctx, {
    type: "line",
    plugins: [nowLinePlugin, stickyYAxisPlugin],
    data: {
      datasets: [
        {
          label: "最大波高 [m]",
          data: heightData,
          borderColor: "#0275d8",
          backgroundColor: "#0275d826",
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: "#0275d8",
          pointBorderColor: "#fff",
          pointHoverRadius: 7,
          fill: true,
          tension: 0.3,
          yAxisID: "yWave",
        },
        {
          label: "周期 [秒]",
          data: periodData,
          borderColor: "#27ae60",
          backgroundColor: "transparent",
          borderWidth: 2,
          pointRadius: 5,
          pointBackgroundColor: "#27ae60",
          pointBorderColor: "#fff",
          pointHoverRadius: 7,
          fill: false,
          tension: 0.3,
          yAxisID: "yPeriod",
        },
      ],
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      layout: { padding: { top: 0, left: 0, right: 0, bottom: 24 } },
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              return items.length ? formatJstHm(items[0].parsed.x) : "";
            },
            label(c) {
              return c.dataset.yAxisID === "yWave"
                ? `最大波高: ${c.parsed.y.toFixed(1)} m`
                : `周期: ${c.parsed.y.toFixed(0)} 秒`;
            },
          },
        },
      },
      scales: {
        x: {
          type: "linear",
          min: xMin,
          max: xMax,
          afterBuildTicks(axis) {
            axis.ticks = waveXTicks;
          },
          ticks: { maxRotation: 0, callback: chartXTickCallback },
          grid: { display: false },
        },
        yWave: {
          type: "linear",
          position: "left",
          title: { display: false },
          min: waveAxis.min,
          max: waveAxis.max,
          ticks: {
            padding: 0,
            stepSize: waveAxis.stepSize,
            callback: (v) => v.toFixed(1),
          },
          grid: { color: "rgba(0,0,0,0.05)", drawTicks: false, tickLength: 0 },
          afterFit: (scale) => {
            scale.width = 55;
          },
        },
        yPeriod: {
          type: "linear",
          position: "right",
          title: { display: false },
          ticks: {
            padding: 0,
            maxTicksLimit: 4,
            stepSize: 1,
            callback: (v) => (Number.isInteger(v) ? v : null),
          },
          grid: { display: false, drawTicks: false, tickLength: 0 },
        },
      },
    },
  });

  // カスタムHTML凡例を生成（イベント委譲でdataset表示切替）
  let legendDiv = document.getElementById(canvasId + "-custom-legend");
  if (!legendDiv) {
    legendDiv = document.createElement("div");
    legendDiv.id = canvasId + "-custom-legend";
    legendDiv.className = "wave-legend";
    // 横スクロール領域の内側に置くと凡例も一緒にスクロールし、
    // 2つ目の項目が画面外へ出てしまうため、スクロールしない親へ挿入する。
    const anchor = waveCanvas.closest(".chart-scroll") || waveCanvas;
    anchor.parentNode.insertBefore(legendDiv, anchor);
  }

  legendDiv.textContent = "";
  const legendItems = [
    { color: "#0275d8", label: "最大波高 [m]" },
    { color: "#27ae60", label: "周期 [秒]" },
  ];
  legendItems.forEach((meta, idx) => {
    // キーボード操作・支援技術対応のため button 要素で生成
    const item = document.createElement("button");
    item.type = "button";
    item.className = "wave-legend-item";
    item.dataset.index = String(idx);
    item.setAttribute("aria-pressed", "true");
    // テキストは可読な既定色（--text-main）を使い、系列色はスウォッチ（丸）で示す。
    // 系列色を文字色にするとコントラスト比が WCAG2AA 未満になるため（緑 #27ae60 で 2.87:1）。
    const swatch = document.createElement("span");
    swatch.className = "wave-legend-swatch";
    swatch.style.backgroundColor = meta.color;
    item.append(swatch, meta.label);
    legendDiv.appendChild(item);
  });

  legendDiv.querySelectorAll(".wave-legend-item").forEach((item) => {
    item.addEventListener("click", () => {
      const idx = Number(item.dataset.index);
      const isVisible = chart.isDatasetVisible(idx);
      chart.setDatasetVisibility(idx, !isVisible);
      chart.update();
      item.classList.toggle("disabled", isVisible);
      item.setAttribute("aria-pressed", String(!isVisible));
    });
  });

  syncChartScroll();
  scrollChartsToNow();

  return chart;
}

// ─── 6. 警報・注意報 ────────────────────────────────────────
// JMA bosai の警報JSON(140000.json)は神奈川で更新停止が確認されたため、
// Cloudflare Worker が最新のレガシーフィードから茅ヶ崎市分を閲覧時に抽出する。
// Worker障害時はActions生成済みJSONへフォールバックし、可用性を確保する。

const WARNING_API_URL = _cfgJma.warning_api_url ?? "";

/** 警報名からバッジ用レベルを判定する。危険警報(レベル4)も「警報」を含むためkeiho。 */
function warningLevelFromName(name) {
  if (name.includes("特別警報")) return "tokubetsu";
  if (name.includes("警報")) return "keiho";
  return "chuiho";
}

async function fetchJmaWarning(force = false) {
  try {
    const bust = Math.floor(Date.now() / (15 * 60000));
    let res;
    if (WARNING_API_URL) {
      try {
        const separator = WARNING_API_URL.includes("?") ? "&" : "?";
        res = await fetchWithTimeout(
          `${WARNING_API_URL}${separator}t=${bust}`,
          {
            force,
          },
        );
        if (!res.ok) throw new Error(`warning API returned ${res.status}`);
      } catch (apiError) {
        console.warn("Live warning API failed; using snapshot", apiError);
        res = await fetchWithTimeout(`data/warning_chigasaki.json?t=${bust}`, {
          force,
        });
      }
    } else {
      res = await fetchWithTimeout(`data/warning_chigasaki.json?t=${bust}`, {
        force,
      });
    }
    if (!res.ok) throw new Error("warning_chigasaki.json fetch failed");
    const data = await res.json();

    const listEl = document.getElementById("jma-warning-list");
    const warningBox = document.getElementById("jma-warning-box");
    const floatingBar = document.getElementById("floating-alert-bar");
    if (!listEl || !warningBox || !floatingBar) return;
    listEl.innerHTML = "";

    const activeWarnings = (data.warnings ?? []).filter((w) => w && w.name);

    if (activeWarnings.length === 0) {
      const none = document.createElement("div");
      none.className = "warning-none";
      none.textContent = "✅ 現在、注意報・警報はありません";
      listEl.appendChild(none);
      warningBox.classList.remove("warning-active");
      floatingBar.style.display = "none";
      floatingBar.className = "floating-alert";
    } else {
      warningBox.classList.add("warning-active");
      const order = { tokubetsu: 0, keiho: 1, chuiho: 2 };
      activeWarnings.sort(
        (a, b) =>
          (order[warningLevelFromName(a.name)] ?? 9) -
          (order[warningLevelFromName(b.name)] ?? 9),
      );
      activeWarnings.forEach((w) => {
        const level = warningLevelFromName(w.name);
        const levelLabel =
          level === "tokubetsu"
            ? "特別警報"
            : level === "keiho"
              ? "警報"
              : "注意報";
        const item = document.createElement("div");
        item.className = "warning-item";
        const badge = document.createElement("span");
        badge.className = `warning-badge badge-${level}`;
        badge.textContent = levelLabel;
        const name = document.createElement("span");
        name.className = "warning-name";
        name.textContent = w.name;
        item.append(badge, name);
        listEl.appendChild(item);
      });

      const topLevel = warningLevelFromName(activeWarnings[0].name);
      if (topLevel === "tokubetsu" || topLevel === "keiho") {
        const hasTokubetsu = activeWarnings.some(
          (w) => warningLevelFromName(w.name) === "tokubetsu",
        );
        const severeList = activeWarnings.filter((w) => {
          const lv = warningLevelFromName(w.name);
          return lv === "tokubetsu" || lv === "keiho";
        });
        const barText =
          severeList.length === 1
            ? `⚠ ${severeList[0].name} 発令中`
            : `⚠ ${hasTokubetsu ? "特別警報・警報" : "警報"} 発令中`;
        floatingBar.textContent = barText;
        floatingBar.className = `floating-alert level-${hasTokubetsu ? "tokubetsu" : "keiho"}`;
        floatingBar.style.display = "block";
      } else {
        floatingBar.style.display = "none";
        floatingBar.className = "floating-alert";
      }
    }

    const contentEl = document.getElementById("jma-warning-content");
    let headlineEl = document.getElementById("jma-warning-headline");
    if (!headlineEl) {
      headlineEl = document.createElement("p");
      headlineEl.id = "jma-warning-headline";
      headlineEl.className = "warning-headline";
      contentEl.appendChild(headlineEl);
    }
    if (activeWarnings.length > 0 && data.reportDateTime) {
      headlineEl.textContent = `気象庁発表（${data.reportDateTime}）`;
      headlineEl.style.display = "block";
    } else {
      headlineEl.style.display = "none";
    }

    document.getElementById("jma-warning-loading").classList.add("hidden");
    contentEl.classList.remove("hidden");
    markStale("warning-stale", pickTimestamp(data), FRESHNESS.warning);
  } catch (e) {
    console.error("JMA warning error:", e);
    document.getElementById("jma-warning-loading").classList.add("hidden");
    document.getElementById("jma-warning-error").style.display = "block";
  }
}

/** 発表対象日を「今日」「明日」または月日で表示する。 */
function heatstrokeDateLabel(date) {
  const today = toJstDateStr(new Date());
  const tomorrow = toJstDateStr(new Date(Date.now() + 24 * 3600e3));
  if (date === today) return "今日";
  if (date === tomorrow) return "明日";
  const [, month, day] = (date || "").split("-");
  return month && day ? `${Number(month)}月${Number(day)}日` : date;
}

async function fetchHeatstrokeAlert(force = false) {
  const box = document.getElementById("heatstroke-box");
  const list = document.getElementById("heatstroke-list");
  const title = document.getElementById("heatstroke-title");
  const source = document.getElementById("heatstroke-source");
  if (!box || !list || !title || !source) return;
  try {
    // 発表時刻（5時・14時・17時）直後に、発表前のsessionStorageが
    // 最大30分残らないよう、5分粒度のURLで同一オリジンJSONを直接取得する。
    const bust = Math.floor(Date.now() / (5 * 60 * 1000));
    const response = await fetchWithTimeout(
      `data/heatstroke_alert.json?t=${bust}`,
      { force },
    );
    if (!response.ok)
      throw new Error(`heatstroke alert returned ${response.status}`);
    const data = await response.json();
    const today = toJstDateStr(new Date());
    const tomorrow = toJstDateStr(new Date(Date.now() + 24 * 3600e3));
    const now = Date.now();
    const alerts = (data.alerts ?? []).filter(
      (alert) =>
        (alert.level === "warning" || alert.level === "special") &&
        (alert.date === today || alert.date === tomorrow) &&
        (!alert.publishedAt || Date.parse(alert.publishedAt) <= now),
    );
    if (alerts.length === 0) {
      box.classList.add("hidden");
      box.classList.remove("heatstroke-special");
      return;
    }

    const hasSpecial = alerts.some((alert) => alert.level === "special");
    title.textContent = hasSpecial
      ? "熱中症特別警戒アラート"
      : "熱中症警戒アラート";
    source.textContent = hasSpecial ? "環境省" : "環境省・気象庁";
    box.classList.toggle("heatstroke-special", hasSpecial);
    list.innerHTML = "";
    alerts.forEach((alert) => {
      const item = document.createElement("div");
      item.className = "heatstroke-item";
      const date = document.createElement("div");
      date.className = "heatstroke-date";
      date.textContent = `${heatstrokeDateLabel(alert.date)}（${alert.date}） 神奈川県に発表中`;
      const message = document.createElement("p");
      message.className = "heatstroke-message";
      message.textContent =
        alert.level === "special"
          ? "危険な暑さから、自分と周りの人の命を守る行動をしてください。"
          : "涼しい環境で過ごし、こまめに水分・塩分を補給してください。";
      item.append(date, message);
      list.appendChild(item);
    });
    box.classList.remove("hidden");
  } catch (error) {
    console.warn("Heatstroke alert fetch failed", error);
    box.classList.add("hidden");
    box.classList.remove("heatstroke-special");
  }
}

// ─── 6.5 津波注意報・警報（相模湾・三浦半島） ──────────────────
// 注: 気象庁 bosai 津波フィードはCORS対応のためクライアントから直接取得する。
// 相模湾・三浦半島(予報区コード330)に津波注意報/警報が出ている時だけカード表示。
const TSUNAMI_AREA_CODE = _cfgJma.tsunami_area_code ?? "330"; // 相模湾・三浦半島
const TSUNAMI_LIST_URL = "https://www.jma.go.jp/bosai/tsunami/data/list.json";
const TSUNAMI_BASE_URL = "https://www.jma.go.jp/bosai/tsunami/data/";

/** Kind.Codeから津波バッジのレベルを判定する。52:大津波警報 53:津波警報 62:津波注意報。*/
function tsunamiLevelFromCode(code) {
  if (code === "52") return { cls: "badge-tsunami-major", show: true };
  if (code === "53") return { cls: "badge-tsunami-warn", show: true };
  if (code === "62") return { cls: "badge-tsunami-adv", show: true };
  return { cls: "", show: false }; // 71:津波予報 や解除相当は非表示
}

/** ISO日時を JST の HH:MM 形式に整形する。失敗時は空文字。*/
function formatTsunamiTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  // 気象庁の到達予想時刻はJST。閲覧端末のTZで表示すると誤読を招くため固定。
  return formatJstHhMm(d.getTime());
}

async function fetchTsunami(force = false) {
  const box = document.getElementById("tsunami-box");
  if (!box) return;
  const errEl = document.getElementById("tsunami-error");
  if (errEl) errEl.hidden = true; // 平常時・成功時は失敗注記を消す
  try {
    const bust = Math.floor(Date.now() / 60000);
    const listRes = await fetchWithTimeout(`${TSUNAMI_LIST_URL}?t=${bust}`, {
      force,
    });
    if (!listRes.ok) throw new Error("tsunami list.json fetch failed");
    const list = await listRes.json();

    // 「津波警報・注意報・予報」系の最新エントリ（満潮時刻情報VTSE51は除外）
    const latest = (list ?? []).find(
      (e) =>
        e &&
        typeof e.ttl === "string" &&
        e.ttl.includes("津波") &&
        !e.ttl.includes("満潮") &&
        !e.ttl.includes("到達予想時刻") &&
        e.json,
    );
    if (!latest) {
      box.classList.add("hidden");
      return;
    }

    const detRes = await fetchWithTimeout(`${TSUNAMI_BASE_URL}${latest.json}`, {
      force,
    });
    if (!detRes.ok) throw new Error("tsunami detail fetch failed");
    const det = await detRes.json();

    const items = det?.Body?.Tsunami?.Forecast?.Item ?? [];
    const area = items.find((it) => it?.Area?.Code === TSUNAMI_AREA_CODE);
    const kind = area?.Category?.Kind;
    const level = tsunamiLevelFromCode(kind?.Code);
    if (!area || !level.show) {
      box.classList.add("hidden");
      return;
    }

    // タイトルとバッジ
    document.getElementById("tsunami-title").textContent =
      kind.Name ?? "津波注意報";

    const listEl = document.getElementById("tsunami-list");
    listEl.innerHTML = "";

    const item = document.createElement("div");
    item.className = "warning-item";
    const badge = document.createElement("span");
    badge.className = `warning-badge ${level.cls}`;
    badge.textContent = kind.Name ?? "";
    const name = document.createElement("span");
    name.className = "warning-name";
    name.textContent = area.Area.Name ?? "相模湾・三浦半島";
    item.append(badge, name);
    listEl.appendChild(item);

    // 予想高さ・第一波到達（数値高さには m を付与。"巨大"等の文言やConditionはそのまま）
    const rawHeight = area?.MaxHeight?.TsunamiHeight;
    const height = /^[\d.]+$/.test(rawHeight ?? "")
      ? `${rawHeight}m`
      : (rawHeight ?? area?.MaxHeight?.Condition);
    const arrival =
      formatTsunamiTime(area?.FirstHeight?.ArrivalTime) ||
      area?.FirstHeight?.Condition ||
      "";
    const detail = document.createElement("p");
    detail.className = "warning-headline";
    const parts = [];
    if (height) parts.push(`予想の高さ: ${height}`);
    if (arrival) parts.push(`第一波到達: ${arrival}`);
    detail.textContent = parts.join("　");
    if (parts.length) listEl.appendChild(detail);

    box.classList.remove("hidden");
  } catch (e) {
    console.error("Tsunami fetch error:", e);
    // 失敗時はダミー(津波警報)を出さず本体は非表示。ただし「取得できていない」
    // ことは小さく明示し、平常(津波なし)との誤認を避ける。
    box.classList.add("hidden");
    if (errEl) errEl.hidden = false;
  }
}

// ─── 7. 天気予報 ────────────────────────────────────────────
// 予報区コード（天気・降水確率の timeSeries）と、気温の timeSeries が使う
// 代表地点コード。フォーク時に _data/site.json を書き換えれば追従する。
const FORECAST_AREA_CODE = _cfgJma.forecast_area_code ?? "140010";
const FORECAST_TEMP_CODE = _cfgJma.forecast_temp_code ?? "46106";

async function fetchJmaForecast(force = false) {
  const hour8Buster = Math.floor(Date.now() / (8 * 60 * 60 * 1000));
  try {
    const res = await fetchWithTimeout(`data/forecast.json?t=${hour8Buster}`, {
      force,
    });
    if (!res.ok) throw new Error("forecast.json fetch failed");
    const data = await res.json();

    const shortTerm = data?.forecast?.[0];
    const timeSeries0 = shortTerm?.timeSeries?.[0];
    const timeSeries1 = shortTerm?.timeSeries?.[1];
    const timeSeries2 = shortTerm?.timeSeries?.[2];
    if (!timeSeries0 || !timeSeries1 || !timeSeries2) {
      throw new Error("forecast.json の構造が不正です");
    }
    const areaWeather =
      timeSeries0.areas?.find((a) => a.area?.code === FORECAST_AREA_CODE) ||
      timeSeries0.areas?.[0];
    const areaPop =
      timeSeries1.areas?.find((a) => a.area?.code === FORECAST_AREA_CODE) ||
      timeSeries1.areas?.[0];
    const areaTemp =
      timeSeries2.areas?.find((a) => a.area?.code === FORECAST_TEMP_CODE) ||
      timeSeries2.areas?.[0];
    if (!areaWeather || !areaPop || !areaTemp) {
      throw new Error("forecast.json に対象エリアがありません");
    }

    // 気象庁の天気文は全角スペース区切り。風と同じ扱いで半角に正規化する。
    document.getElementById("jma-weather").textContent = (
      areaWeather.weathers?.[0] || "--"
    ).replace(/　/g, " ");
    document.getElementById("jma-pop").textContent = areaPop.pops?.[0]
      ? areaPop.pops[0] + "%"
      : "--";

    // 配列順依存をやめ、timeDefines の HH時刻で最高/最低を判定する
    const nowJstDate = toJstDateStr(new Date());
    const tomorrowJstDate = toJstDateStr(new Date(Date.now() + 86400000));
    const findTemp = (datePrefix, hour) => {
      const idx = (timeSeries2.timeDefines || []).findIndex((t) =>
        t.startsWith(`${datePrefix}T${hour}:`),
      );
      const v = idx >= 0 ? areaTemp.temps?.[idx] : null;
      return v !== "" && v != null ? v : null;
    };
    const tempMax =
      findTemp(nowJstDate, "09") ?? findTemp(tomorrowJstDate, "09");
    const todayMinRaw = findTemp(nowJstDate, "00");
    const tomorrowMin = findTemp(tomorrowJstDate, "00");
    const tempMin =
      todayMinRaw != null && todayMinRaw !== tempMax
        ? todayMinRaw
        : (tomorrowMin ?? todayMinRaw);
    document.getElementById("jma-temp").textContent =
      `${tempMax ?? "--"}℃ / ${tempMin ?? "--"}℃`;

    document.getElementById("jma-wind").textContent = (
      areaWeather.winds?.[0] || "--"
    ).replace(/　/g, " ");
    const overviewText = data?.overview?.text ?? "";
    document.getElementById("jma-overview-body").textContent = overviewText;
    const hasTyphoon = overviewText.includes("台風");
    document.getElementById("jma-typhoon-notice").style.display = hasTyphoon
      ? "flex"
      : "none";

    document.getElementById("jma-loading").classList.add("hidden");
    document.getElementById("jma-forecast-content").classList.remove("hidden");
    markStale("forecast-stale", pickTimestamp(data), FRESHNESS.forecast);
  } catch (e) {
    console.error("JMA forecast error:", e);
    document.getElementById("jma-loading").classList.add("hidden");
    document.getElementById("jma-error").style.display = "block";
  }
}

function toggleOverview() {
  const el = document.getElementById("jma-overview-text");
  const btn = document.getElementById("jma-overview-toggle");
  const isHidden = el.style.display === "none" || !el.style.display;
  el.style.display = isHidden ? "block" : "none";
  btn.textContent = isHidden ? "概況を閉じる ▲" : "概況を表示 ▼";
  btn.setAttribute("aria-expanded", String(isHidden));
}

// ─── 8. 風予報 ──────────────────────────────────────────────
// 折りたたまずに常時表示する件数。開かなくても直近の風が読めるようにする。
const WIND_VISIBLE_COUNT = 3;

/** 風予報1行（時刻・風向・風速）を生成する。 */
function createWindRow({ time, dir, speed }) {
  const row = document.createElement("div");
  row.className = "wind-row";
  const mkSpan = (cls, text) => {
    const s = document.createElement("span");
    s.className = cls;
    s.textContent = text;
    return s;
  };
  row.append(
    mkSpan("wind-time", time),
    mkSpan("wind-dir", dir || "データなし"),
    mkSpan("wind-speed", `${speed ?? "-"} m/s`),
  );
  return row;
}

/**
 * 風予報を描画する。先頭 WIND_VISIBLE_COUNT 件は常時表示し、
 * 残りは折りたたみ側へ入れる。残りが無ければトグル自体を隠す
 * （押しても何も出ないボタンを見せない）。
 */
function renderWindForecast(entries) {
  const grid = document.getElementById("wind-forecast-list");
  const moreGrid = document.getElementById("wind-forecast-more");
  const toggle = document.getElementById("wind-forecast-toggle");
  if (!grid) return;
  grid.innerHTML = "";
  if (moreGrid) moreGrid.innerHTML = "";

  if (!entries || entries.length === 0) {
    grid.appendChild(
      createWindRow({ time: "--:--", dir: "データなし", speed: null }),
    );
    if (toggle) toggle.hidden = true;
    return;
  }

  entries
    .slice(0, WIND_VISIBLE_COUNT)
    .forEach((entry) => grid.appendChild(createWindRow(entry)));

  const rest = entries.slice(WIND_VISIBLE_COUNT);
  if (moreGrid) {
    rest.forEach((entry) => moreGrid.appendChild(createWindRow(entry)));
    // 折りたたみは常に閉じた状態から始める
    moreGrid.style.display = "none";
  }
  if (toggle) toggle.hidden = rest.length === 0;
}

function updateWindForecastToggleLabel(isOpen) {
  const btn = document.getElementById("wind-forecast-toggle");
  if (!btn) return;
  const range = windForecastRange ? `（${windForecastRange}）` : "";
  btn.textContent = isOpen
    ? `残りの予想風${range}を閉じる ▲`
    : `残りの予想風${range}を表示 ▼`;
  btn.setAttribute("aria-expanded", String(isOpen));
}

function toggleWindForecast() {
  const el = document.getElementById("wind-forecast-more");
  if (!el) return;
  const isHidden = el.style.display === "none" || !el.style.display;
  el.style.display = isHidden ? "block" : "none";
  updateWindForecastToggleLabel(isHidden);
}

async function fetchWindForecast(force = false) {
  try {
    const hourBuster = Math.floor(Date.now() / (60 * 60 * 1000));
    const res = await fetchWithTimeout(
      `data/wind_forecast.json?t=${hourBuster}`,
      { force },
    );
    if (!res.ok) throw new Error("wind_forecast.json fetch failed");
    const data = await res.json();
    const now = new Date();
    const cutoff = now.getTime() - 60 * 60 * 1000;
    // JST基準の日付文字列で比較（ブラウザTZがJST以外でも安定）
    const todayJst = toJstDateStr(now);
    const items = (data.items || [])
      .map((item) => {
        // item.time は TZ無しISO（例: "2026-06-03T00:00"）。JST固定で解釈する。
        const tzSuffix = /[zZ]|[+-]\d{2}:?\d{2}$/.test(item.time)
          ? ""
          : "+09:00";
        const dt = new Date(item.time + tzSuffix);
        // ブラウザTZ非依存にJST時刻を抽出
        const jstMs = dt.getTime() + JST_OFFSET_MS;
        const jstDate = new Date(jstMs);
        const hh = jstDate.getUTCHours();
        const mm = jstDate.getUTCMinutes();
        return {
          h: hh,
          ts: dt.getTime(),
          dateJst: toJstDateStr(dt),
          time: String(hh).padStart(2, "0") + ":" + String(mm).padStart(2, "0"),
          dir:
            item.wind_direction_text ||
            (item.wind_direction_deg != null
              ? getWindDirection16(Number(item.wind_direction_deg))
              : "データなし"),
          speed:
            item.wind_speed_ms != null
              ? Number(item.wind_speed_ms).toFixed(1)
              : null,
        };
      })
      .filter(
        (item) =>
          item.h >= 4 &&
          item.h <= 23 &&
          item.ts >= cutoff &&
          item.dateJst === todayJst,
      )
      .slice(0, 21);

    // ラベルは折りたたむ側（4件目以降）の時間帯を示す。
    // 1件しか残らない時に "23:00-23:00" とならないよう分岐する。
    const rest = items.slice(WIND_VISIBLE_COUNT);
    windForecastRange =
      rest.length === 0
        ? ""
        : rest.length === 1
          ? rest[0].time
          : `${rest[0].time}-${rest[rest.length - 1].time}`;
    renderWindForecast(items);
    updateWindForecastToggleLabel(false);
    document.getElementById("wind-forecast-loading").classList.add("hidden");
    document.getElementById("wind-forecast-content").classList.remove("hidden");
    markStale("wind-stale", pickTimestamp(data), FRESHNESS.wind);
  } catch (e) {
    console.error("Wind forecast error:", e);
    document.getElementById("wind-forecast-loading").classList.add("hidden");
    document.getElementById("wind-forecast-error").style.display = "block";
  }
}

// ─── 9. 統合フェッチ ────────────────────────────────────────
async function fetchWeatherData(isManual = false) {
  if (_isFetching) return;
  _isFetching = true;
  const timeEl = document.getElementById("current-time");
  try {
    // 事前UI更新は try 内で行う。ここで例外が出ると finally を経ずに
    // _isFetching が true のまま残り、以降の更新が全て無視されるため。
    if (timeEl && timeEl.textContent !== "") {
      timeEl.textContent = "データを更新中... ⏳";
      const wc = document.getElementById("weather-content");
      if (wc) wc.classList.add("is-updating");
      if (isManual) {
        if (_reducedMotion.matches) {
          window.scrollTo(0, 0);
        } else {
          (function smoothTop() {
            const start = window.scrollY,
              t0 = performance.now();
            function step(t) {
              const p = Math.min((t - t0) / 500, 1);
              window.scrollTo(0, start * (1 - p * p * (3 - 2 * p)));
              if (p < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
          })();
        }
      }
    }

    // 各セクションは相互依存がないため全fetchを並行実行（初期表示を高速化）。
    // 部分失敗はセクション単位のエラーUIで吸収する。
    const [, , , , , , , , wmResult] = await Promise.allSettled([
      calculateTide(isManual),
      fetchTideExtremes(isManual),
      fetchJmaForecast(isManual),
      fetchJmaWarning(isManual),
      fetchTsunami(isManual),
      fetchHeatstrokeAlert(isManual),
      fetchWaveGuidance(isManual),
      fetchWindForecast(isManual),
      fetchCached("data/weather_marine.json", "cache_weather_marine", {
        force: isManual,
      }),
    ]);
    const wmData = wmResult.status === "fulfilled" ? wmResult.value : null;
    const jma = wmData?.jma_amedas;
    const cw = wmData?.current_weather;

    // 鮮度の警告はページ上部にまとめず、影響を受けるカード内にのみ出す。
    // Actions のスケジュール遅延は種別ごとに独立して起きるため、全体バナーだと
    // 更新できている他の情報まで古いと誤認させてしまう（三原則1: 誤読を防ぐ）。
    const marineFresh = freshness(pickTimestamp(wmData), FRESHNESS.marine);
    const marineStale = wmData == null || marineFresh.isStale;
    const marineNote = document.getElementById("marine-stale");
    if (marineNote) {
      if (marineStale) {
        marineNote.textContent = marineFresh.ms
          ? `⚠ データが古い可能性（最終更新 ${marineFresh.label}）`
          : "⚠ 最新データを取得できませんでした（表示中の値は古い可能性）";
        marineNote.hidden = false;
      } else {
        marineNote.hidden = true;
      }
    }

    // アメダスstale(前回値引き継ぎ)またはweather_marine取得失敗時に注記を点灯。
    const staleEl = document.getElementById("amedas-stale");
    if (staleEl)
      staleEl.hidden = !((jma && jma.stale === true) || wmData == null);

    if (jma) {
      setText("temp", jma.temp != null ? `${jma.temp}℃` : "--℃");
      setText("humidity", jma.humidity != null ? `${jma.humidity} %` : "-- %");
      setText("wind", jma.wind != null ? `${jma.wind} m/s` : "-- m/s");
      setText("wind-dir", getWindDirectionJma(jma.windDirection));
      setText(
        "precip-1h",
        jma.precipitation1h != null ? `${jma.precipitation1h} mm` : "0 mm",
      );
      setText("hero-temp", jma.temp != null ? jma.temp : "--");
      setText("hero-wind", jma.wind != null ? jma.wind : "--");
    } else if (cw) {
      setText("temp", `${cw.temperature}℃`);
      setText("humidity", "-- %");
      setText("wind", `${cw.windspeed} m/s`);
      setText("wind-dir", getWindDirection16(cw.winddirection));
      setText("precip-1h", "-- mm");
      setText("hero-temp", cw.temperature);
      setText("hero-wind", cw.windspeed);
    } else {
      setText("temp", "データなし");
      setText("humidity", "--");
      setText("wind", "データなし");
      setText("wind-dir", "--");
      setText("precip-1h", "--");
      setText("hero-temp", "--");
      setText("hero-wind", "--");
    }

    const cur = wmData?.marine?.current;
    setText(
      "wave-height",
      cur?.wave_height != null ? `${cur.wave_height} m` : "データなし",
    );
    if (cur?.sea_surface_temperature != null) {
      setText("sea-temp", `${cur.sea_surface_temperature}℃`);
      setText("hero-sea-temp", cur.sea_surface_temperature);
    } else {
      setText("sea-temp", "データなし");
      setText("hero-sea-temp", "--");
    }

    const skeletonEl = document.getElementById("skeleton-loading");
    if (skeletonEl) skeletonEl.style.display = "none";
    const contentEl = document.getElementById("weather-content");
    if (contentEl) {
      contentEl.classList.remove("hidden");
      contentEl.classList.remove("is-updating");
      // グラフ描画時点では #weather-content が display:none のため、
      // そこでの scrollLeft 代入は 0 にクランプされて捨てられる。
      // レイアウト確定後に改めて「今」の位置へ寄せる。
      requestAnimationFrame(scrollChartsToNow);
    }
    _lastFetchTime = Date.now();
    displayFetchTime(pickTimestamp(wmData));
    // 手動更新時はデータが同一でも完了フィードバックを表示する
    if (isManual) showRefreshDone();
  } catch (error) {
    console.error("Fetch error:", error);
    _showGlobalError();
    const wc = document.getElementById("weather-content");
    if (wc) wc.classList.remove("is-updating");
    if (timeEl && timeEl.textContent.includes("更新中")) displayFetchTime();
  } finally {
    _isFetching = false;
  }
}

function showToast() {
  if (_toastShown) return;
  const t = document.getElementById("toast");
  if (!t) return;
  _toastShown = true;
  t.style.display = "block";
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => hideToast(), 8000);
}

function hideToast() {
  const t = document.getElementById("toast");
  if (!t) return;
  t.classList.remove("show");
  setTimeout(() => {
    t.style.display = "none";
    _toastShown = false;
  }, 400);
}

let _refreshToastTimer = null;
/**
 * 手動更新の完了トーストを約2秒表示する。
 * 更新プロンプト用 #toast とは別要素のため状態・タイマーが競合しない。
 */
function showRefreshDone() {
  const t = document.getElementById("refresh-toast");
  if (!t) return;
  clearTimeout(_refreshToastTimer);
  t.textContent = "✓ 最新の情報に更新しました";
  t.style.display = "block";
  requestAnimationFrame(() => t.classList.add("show"));
  _refreshToastTimer = setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => {
      t.style.display = "none";
    }, 400);
  }, 2000);
}

// ─── 10. ダークモード追従 ───────────────────────────────────
const _prefersDark = window.matchMedia("(prefers-color-scheme: dark)");

function _updateChartsTheme(e) {
  const isDark = e.matches;
  const tickColor = isDark ? "#94a3b8" : "#707070";
  const gridColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.05)";
  if (window.Chart) {
    Chart.defaults.font.family = 'Inter, "Zen Kaku Gothic New", sans-serif';
    Chart.defaults.color = tickColor;
    Chart.defaults.borderColor = gridColor;
  }
  if (tideChartInstance) {
    tideChartInstance.options.scales.x.ticks.color = tickColor;
    tideChartInstance.options.scales.y.ticks.color = tickColor;
    tideChartInstance.update();
  }
  if (waveChartInstance) {
    waveChartInstance.options.scales.x.ticks.color = tickColor;
    waveChartInstance.options.scales.yWave.ticks.color = tickColor;
    waveChartInstance.options.scales.yPeriod.ticks.color = tickColor;
    waveChartInstance.update();
  }
}

_prefersDark.addEventListener("change", _updateChartsTheme);
_updateChartsTheme(_prefersDark);

// ─── 11. DOMイベントバインド ────────────────────────────────
function _onUserInteraction() {
  if (Date.now() - _lastFetchTime >= 3 * 60 * 60 * 1000) showToast();
}

// defer 実行時点でDOMは構築済みのため、フォントCSSは即時に適用開始する。
applyDeferredStyles();

document.addEventListener("DOMContentLoaded", () => {
  fetchWeatherData();
  // 災害情報は通常データより高頻度に再確認する。Worker/JMA側の60秒
  // キャッシュにより、閲覧者数に比例して取得元へ負荷を掛けない。
  const ALERT_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
  setInterval(() => {
    if (document.visibilityState === "visible") {
      Promise.allSettled([
        fetchJmaWarning(),
        fetchTsunami(),
        fetchHeatstrokeAlert(),
      ]);
    }
  }, ALERT_REFRESH_INTERVAL_MS);
  // 背景タブで間引かれるsetIntervalを避け、経過時間を見て再帰実行
  const REFRESH_INTERVAL_MS = 3 * 60 * 60 * 1000;
  const scheduleNextFetch = () => {
    setTimeout(() => {
      const elapsed = Date.now() - _lastFetchTime;
      if (elapsed >= REFRESH_INTERVAL_MS) {
        fetchWeatherData().finally(scheduleNextFetch);
      } else {
        scheduleNextFetch();
      }
    }, REFRESH_INTERVAL_MS);
  };
  scheduleNextFetch();

  // 旧インライン onclick の置換
  document.querySelectorAll("[data-scroll-to]").forEach((el) => {
    el.addEventListener("click", () => {
      const target = document.getElementById(el.dataset.scrollTo);
      if (!target) return;
      const behavior = _reducedMotion.matches ? "auto" : "smooth";
      target.scrollIntoView({ behavior, block: "start" });
    });
  });
  const overviewBtn = document.getElementById("jma-overview-toggle");
  if (overviewBtn) overviewBtn.addEventListener("click", toggleOverview);
  const windBtn = document.getElementById("wind-forecast-toggle");
  if (windBtn) windBtn.addEventListener("click", toggleWindForecast);
  const toast = document.getElementById("toast");
  if (toast)
    toast.addEventListener("click", () => {
      fetchWeatherData();
      hideToast();
    });
  const currentTime = document.getElementById("current-time");
  if (currentTime)
    currentTime.addEventListener("click", () => fetchWeatherData(true));

  // ヘッダーが画面外に出たら簡易サイトバーを表示
  const siteBar = document.getElementById("site-bar");
  const headerEl = document.querySelector("header");
  if (siteBar && headerEl && "IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) =>
        siteBar.classList.toggle("is-visible", !entry.isIntersecting),
      { rootMargin: "-8px 0px 0px 0px", threshold: 0 },
    ).observe(headerEl);
  }
});

["click", "touchstart"].forEach((ev) =>
  document.addEventListener(ev, _onUserInteraction),
);

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  const elapsed = Date.now() - _lastFetchTime;
  if (elapsed >= 10 * 60 * 1000) {
    fetchWeatherData();
  } else if (elapsed >= 3 * 60 * 1000) {
    showToast();
  }
});

window.addEventListener("pageshow", (e) => {
  if (e.persisted) fetchWeatherData();
});

// ─── グローバルエラー境界 ───────────────────────────────────
// 想定外の例外・未処理Promiseでも、骨組み残り/白画面を避けてエラーUIを表示する。
function _showGlobalError() {
  const sk = document.getElementById("skeleton-loading");
  if (sk) sk.style.display = "none";
  const err = document.getElementById("error");
  if (err) {
    err.classList.remove("hidden");
    err.style.display = "block";
  }
}

window.addEventListener("error", _showGlobalError);
window.addEventListener("unhandledrejection", _showGlobalError);
