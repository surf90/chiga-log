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
//   6. 警報・注意報 (fetchJmaWarning)
//   7. 天気予報 (fetchJmaForecast)
//   8. 風予報 (fetchWindForecast)
//   9. 統合フェッチ (fetchWeatherData)
//  10. ダークモード追従
//  11. DOMイベントバインド (onclick除去後の置換)
// ============================================================

// ─── 0. 定数 / モジュール状態 ───────────────────────────────
const LAT = 35.3175;
const LON = 139.4151;
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
  { store = "session", ttlMs = 30 * 60 * 1000 } = {},
) {
  const storage = store === "local" ? localStorage : sessionStorage;
  // 同オリジン内の他コードとのキー衝突を避けるためプレフィックスを付与する
  key = STORAGE_PREFIX + key;
  const cached = storage.getItem(key);
  if (cached) {
    try {
      const { data, ts } = JSON.parse(cached);
      if (Date.now() - ts < ttlMs) return data;
    } catch {
      storage.removeItem(key);
    }
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch failed: ${url}`);
  const data = await res.json();
  try {
    storage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
  } catch {
    // QuotaExceeded等は無視（取得済みデータはそのまま返す）
  }
  return data;
}

/** ミリ秒(epoch)を JST の "H:MM" に整形する共通関数。 */
function formatJstHm(ms) {
  const h = (new Date(ms).getUTCHours() + 9) % 24;
  const m = new Date(ms).getUTCMinutes();
  return h + ":" + String(m).padStart(2, "0");
}

// ─── 2. ユーティリティ ──────────────────────────────────────
function getWindDirection16(degree) {
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
  return directions[Math.round(degree / 22.5) % 16];
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

function displayFetchTime() {
  const now = new Date();
  const options = {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  };
  const el = document.getElementById("current-time");
  el.textContent = `更新日時: ${now.toLocaleString("ja-JP", options)} 🔄`;
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
  chartScrollSynced = true;
  const tideScroll = document.getElementById("tide-chart-scroll");
  const waveScroll = document.getElementById("wave-chart-scroll");
  if (!tideScroll || !waveScroll) return;
  let syncing = false;
  tideScroll.addEventListener(
    "scroll",
    () => {
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
async function calculateTide() {
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
    const dayKey = new Date().toISOString().slice(0, 10);
    const resp = await fetch(`data/moon_today.json?d=${dayKey}`);
    if (resp.ok) {
      const moonToday = await resp.json();
      if (moonToday.age !== undefined) {
        age = parseFloat(moonToday.age);
        ageSource = "NASA";
      }
    }
  } catch (e) {
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
  container.innerHTML = "";
  const row = document.createElement("div");
  row.className = "data-row tide-error";
  row.textContent = "※潮汐データの取得に失敗しました。";
  container.appendChild(row);
  const chartContainer = document.getElementById("tide-chart-container");
  if (chartContainer) chartContainer.style.display = "none";
}

async function fetchTideExtremes() {
  document.getElementById("tide-status").textContent = "読み込み中...";

  if (!window.location.protocol.startsWith("http")) {
    showTideError();
    updateTideSource("file:// プロトコル非対応");
    return;
  }

  try {
    const dayKey = new Date().toISOString().slice(0, 10);
    const res = await fetch(`data/tide_widget.json?d=${dayKey}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const todayTides = data.today || [];
    const allTides = Object.values(data.forecast || {}).flat();

    if (allTides.length > 0) {
      displayTideData(todayTides, allTides);
      updateTideSource(data.source || "気象庁");
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
    const timeStr = dateObj.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
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
    const timeStr = dateObj.toLocaleTimeString("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
    });
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
  chartXMin = extremes[0].timeMs;
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

  tideChartInstance = new Chart(ctx, {
    type: "line",
    plugins: [nowLinePlugin],
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
          suggestedMin: hasHeightData
            ? Math.min(...dataPoints.map((d) => d.y)) - 0.2
            : -0.2,
          suggestedMax: hasHeightData
            ? Math.max(...dataPoints.map((d) => d.y)) + 0.2
            : 1.2,
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

  syncChartScroll();
  scrollChartsToNow();
}

// ─── 5. 波 ──────────────────────────────────────────────────
async function fetchWaveGuidance() {
  try {
    const hour3Buster = Math.floor(Date.now() / (3 * 60 * 60 * 1000));
    const resp = await fetch(`data/wave_guid_20.json?t=${hour3Buster}`);
    if (!resp.ok) throw new Error("wave_guid_20.json の読み込みに失敗");
    const json = await resp.json();

    const todayJst = new Date(
      new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }),
    );
    const dateStrs = [];
    for (let i = 0; i < CHART_DAYS; i++) {
      const d = new Date(todayJst);
      d.setDate(d.getDate() + i);
      dateStrs.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      );
    }
    const nextDayJst = new Date(todayJst);
    nextDayJst.setDate(nextDayJst.getDate() + CHART_DAYS);
    const nextDayStr = `${nextDayJst.getFullYear()}-${String(nextDayJst.getMonth() + 1).padStart(2, "0")}-${String(nextDayJst.getDate()).padStart(2, "0")}`;

    const todayData = (json.data || []).filter(
      (d) =>
        dateStrs.some((s) => d.time.startsWith(s)) ||
        d.time.startsWith(nextDayStr + "T00:00"),
    );
    if (todayData.length === 0) throw new Error("本日の波浪データがありません");

    waveChartInstance = drawWaveCombinedChart(
      "waveChart",
      waveChartInstance,
      todayData,
    );

    document.getElementById("wave-guid-loading").style.display = "none";
    document.getElementById("wave-guid-content").style.display = "block";
  } catch (e) {
    console.error("Wave guidance error:", e);
    document.getElementById("wave-guid-loading").style.display = "none";
    document.getElementById("wave-guid-error").style.display = "block";
  }
}

function drawWaveCombinedChart(canvasId, existingInstance, data) {
  if (existingInstance) {
    existingInstance.destroy();
    existingInstance = null;
  }

  const heightData = data.map((d) => ({
    x: new Date(d.time).getTime(),
    y: d.wave_height,
  }));
  const periodData = data.map((d) => ({
    x: new Date(d.time).getTime(),
    y: d.period,
  }));

  const todayJstStartMs =
    Math.floor((Date.now() + JST_OFFSET_MS) / 86400000) * 86400000 -
    JST_OFFSET_MS;
  const xMin =
    chartXMin !== null ? chartXMin : todayJstStartMs + 4 * 60 * 60 * 1000;
  const xMax = xMin + CHART_DAYS * 24 * 60 * 60 * 1000;

  setChartContainerWidth("wave-chart-container", CHART_TOTAL_PX);
  const waveXTicks = buildChartXTicks(xMin, xMax);

  const waveCanvas = document.getElementById(canvasId);
  waveCanvas.width = CHART_TOTAL_PX;
  waveCanvas.height = 200;
  const ctx = waveCanvas.getContext("2d");
  const chart = new Chart(ctx, {
    type: "line",
    plugins: [nowLinePlugin],
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
          ticks: {
            padding: 0,
            maxTicksLimit: 4,
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
    const container = document.getElementById(canvasId).parentNode;
    container.insertBefore(legendDiv, document.getElementById(canvasId));
  }

  legendDiv.textContent = "";
  const legendItems = [
    { color: "#0275d8", label: "最大波高 [m]" },
    { color: "#27ae60", label: "周期 [秒]" },
  ];
  legendItems.forEach((meta, idx) => {
    const item = document.createElement("div");
    item.className = "wave-legend-item";
    item.dataset.index = String(idx);
    item.style.color = meta.color;
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
    });
  });

  syncChartScroll();
  scrollChartsToNow();

  return chart;
}

// ─── 6. 警報・注意報 ────────────────────────────────────────
// 注: JMA bosai の警報JSON(140000.json)は神奈川で更新停止が確認されたため、
// GitHub Actions側(BFF)が最新のレガシーフィードから抽出した同一オリジンの
// data/warning_chigasaki.json を読む。クライアントからJMAは直接叩かない。

/** 警報名からバッジ用レベルを判定する。危険警報(レベル4)も「警報」を含むためkeiho。 */
function warningLevelFromName(name) {
  if (name.includes("特別警報")) return "tokubetsu";
  if (name.includes("警報")) return "keiho";
  return "chuiho";
}

async function fetchJmaWarning() {
  try {
    const bust = Math.floor(Date.now() / 60000);
    const res = await fetch(`data/warning_chigasaki.json?t=${bust}`);
    if (!res.ok) throw new Error("warning_chigasaki.json fetch failed");
    const data = await res.json();

    const listEl = document.getElementById("jma-warning-list");
    listEl.innerHTML = "";

    const activeWarnings = (data.warnings ?? []).filter((w) => w && w.name);

    const warningBox = document.getElementById("jma-warning-box");
    const floatingBar = document.getElementById("floating-alert-bar");
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

    document.getElementById("jma-warning-loading").style.display = "none";
    contentEl.style.display = "block";
  } catch (e) {
    console.error("JMA warning error:", e);
    document.getElementById("jma-warning-loading").style.display = "none";
    document.getElementById("jma-warning-error").style.display = "block";
  }
}

// ─── 6.5 津波注意報・警報（相模湾・三浦半島） ──────────────────
// 注: 気象庁 bosai 津波フィードはCORS対応のためクライアントから直接取得する。
// 相模湾・三浦半島(予報区コード330)に津波注意報/警報が出ている時だけカード表示。
const TSUNAMI_AREA_CODE = "330"; // 相模湾・三浦半島
const TSUNAMI_LIST_URL = "https://www.jma.go.jp/bosai/tsunami/data/list.json";
const TSUNAMI_BASE_URL = "https://www.jma.go.jp/bosai/tsunami/data/";

/** Kind.Codeから津波バッジのレベルを判定する。52:大津波警報 53:津波警報 62:津波注意報。*/
function tsunamiLevelFromCode(code) {
  if (code === "52") return { cls: "badge-tsunami-major", show: true };
  if (code === "53") return { cls: "badge-tsunami-warn", show: true };
  if (code === "62") return { cls: "badge-tsunami-adv", show: true };
  return { cls: "", show: false }; // 71:津波予報 や解除相当は非表示
}

/** ISO日時を HH:MM 形式に整形する。失敗時は空文字。*/
function formatTsunamiTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

async function fetchTsunami() {
  const box = document.getElementById("tsunami-box");
  try {
    const bust = Math.floor(Date.now() / 60000);
    const listRes = await fetch(`${TSUNAMI_LIST_URL}?t=${bust}`);
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

    const detRes = await fetch(`${TSUNAMI_BASE_URL}${latest.json}`);
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
    document.getElementById("tsunami-title").textContent = kind.Name ?? "津波注意報";

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
    box.classList.add("hidden"); // 失敗時はダミーを出さず非表示
  }
}

// ─── 7. 天気予報 ────────────────────────────────────────────
async function fetchJmaForecast() {
  const hour8Buster = Math.floor(Date.now() / (8 * 60 * 60 * 1000));
  try {
    const res = await fetch(`data/forecast_data.json?t=${hour8Buster}`);
    if (!res.ok) throw new Error("forecast_data.json fetch failed");
    const data = await res.json();

    const shortTerm = data?.forecast?.[0];
    const timeSeries0 = shortTerm?.timeSeries?.[0];
    const timeSeries1 = shortTerm?.timeSeries?.[1];
    const timeSeries2 = shortTerm?.timeSeries?.[2];
    if (!timeSeries0 || !timeSeries1 || !timeSeries2) {
      throw new Error("forecast_data.json の構造が不正です");
    }
    const areaWeather =
      timeSeries0.areas?.find((a) => a.area?.code === "140010") ||
      timeSeries0.areas?.[0];
    const areaPop =
      timeSeries1.areas?.find((a) => a.area?.code === "140010") ||
      timeSeries1.areas?.[0];
    const areaTemp =
      timeSeries2.areas?.find((a) => a.area?.code === "46106") ||
      timeSeries2.areas?.[0];
    if (!areaWeather || !areaPop || !areaTemp) {
      throw new Error("forecast_data.json に対象エリアがありません");
    }

    document.getElementById("jma-weather").textContent =
      areaWeather.weathers?.[0] ?? "--";
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

    document.getElementById("jma-loading").style.display = "none";
    document.getElementById("jma-forecast-content").style.display = "block";
  } catch (e) {
    console.error("JMA forecast error:", e);
    document.getElementById("jma-loading").style.display = "none";
    document.getElementById("jma-error").style.display = "block";
  }
}

function toggleOverview() {
  const el = document.getElementById("jma-overview-text");
  const btn = document.getElementById("jma-overview-toggle");
  const isHidden = el.style.display === "none" || !el.style.display;
  el.style.display = isHidden ? "block" : "none";
  btn.textContent = isHidden ? "概況を閉じる ▲" : "概況を表示 ▼";
}

// ─── 8. 風予報 ──────────────────────────────────────────────
function renderWindForecast(entries) {
  const grid = document.getElementById("wind-forecast-list");
  grid.innerHTML = "";
  if (!entries || entries.length === 0) {
    const row = document.createElement("div");
    row.className = "wind-row";
    const mkSpan = (cls, text) => {
      const s = document.createElement("span");
      s.className = cls;
      s.textContent = text;
      return s;
    };
    row.append(
      mkSpan("wind-time", "--:--"),
      mkSpan("wind-dir", "データなし"),
      mkSpan("wind-speed", "-"),
    );
    grid.appendChild(row);
    return;
  }
  entries.forEach(({ time, dir, speed }) => {
    const row = document.createElement("div");
    row.className = "wind-row";
    const t = document.createElement("span");
    t.className = "wind-time";
    t.textContent = time;
    const d = document.createElement("span");
    d.className = "wind-dir";
    d.textContent = dir || "データなし";
    const s = document.createElement("span");
    s.className = "wind-speed";
    s.textContent = `${speed ?? "-"} m/s`;
    row.append(t, d, s);
    grid.appendChild(row);
  });
}

function updateWindForecastToggleLabel(isOpen) {
  const btn = document.getElementById("wind-forecast-toggle");
  if (!btn) return;
  const range = windForecastRange || "昼間";
  btn.textContent = isOpen
    ? `予想風（${range}）を閉じる ▲`
    : `予想風（${range}）を表示 ▼`;
}

function toggleWindForecast() {
  const el = document.getElementById("wind-forecast-list");
  const isHidden = el.style.display === "none" || !el.style.display;
  el.style.display = isHidden ? "block" : "none";
  updateWindForecastToggleLabel(isHidden);
}

async function fetchWindForecast() {
  try {
    const hourBuster = Math.floor(Date.now() / (60 * 60 * 1000));
    const res = await fetch(`data/wind_forecast.json?t=${hourBuster}`);
    if (!res.ok) throw new Error("wind_forecast.json fetch failed");
    const data = await res.json();
    const now = new Date();
    const cutoff = now.getTime() - 60 * 60 * 1000;
    // JST基準の日付文字列で比較（ブラウザTZがJST以外でも安定）
    const todayJst = toJstDateStr(now);
    const items = (data.items || [])
      .map((item) => {
        // item.time は TZ無しISO（例: "2026-06-03T00:00"）。JST固定で解釈する。
        const tzSuffix = /[zZ]|[+-]\d{2}:?\d{2}$/.test(item.time) ? "" : "+09:00";
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

    windForecastRange =
      items.length > 0
        ? `${items[0].time}-${items[items.length - 1].time}`
        : "";
    renderWindForecast(items);
    updateWindForecastToggleLabel(false);
    document.getElementById("wind-forecast-loading").style.display = "none";
    document.getElementById("wind-forecast-content").style.display = "block";
  } catch (e) {
    console.error("Wind forecast error:", e);
    document.getElementById("wind-forecast-loading").style.display = "none";
    document.getElementById("wind-forecast-error").style.display = "block";
  }
}

// ─── 9. 統合フェッチ ────────────────────────────────────────
async function fetchWeatherData(isManual = false) {
  if (_isFetching) return;
  _isFetching = true;
  const timeEl = document.getElementById("current-time");
  if (timeEl.textContent !== "") {
    timeEl.textContent = "データを更新中... ⏳";
    const wc = document.getElementById("weather-content");
    wc.classList.add("is-updating");
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
  try {
    await calculateTide();
    await Promise.allSettled([
      fetchTideExtremes(),
      fetchJmaForecast(),
      fetchJmaWarning(),
      fetchTsunami(),
    ]);
    await fetchWaveGuidance();
    await fetchWindForecast();

    const wmData = await fetchCached(
      "data/weather_marine.json",
      "cache_weather_marine",
    );
    const jma = wmData?.jma_amedas;
    const cw = wmData?.current_weather;
    const tempEl = document.getElementById("temp");
    const humEl = document.getElementById("humidity");
    const windEl = document.getElementById("wind");
    const windDirEl = document.getElementById("wind-dir");
    const precipEl = document.getElementById("precip-1h");
    const heroTempEl = document.getElementById("hero-temp");
    const heroWindEl = document.getElementById("hero-wind");

    if (jma) {
      tempEl.textContent = jma.temp != null ? `${jma.temp}℃` : "--℃";
      humEl.textContent = jma.humidity != null ? `${jma.humidity} %` : "-- %";
      windEl.textContent = jma.wind != null ? `${jma.wind} m/s` : "-- m/s";
      windDirEl.textContent = getWindDirectionJma(jma.windDirection);
      precipEl.textContent =
        jma.precipitation1h != null ? `${jma.precipitation1h} mm` : "0 mm";
      heroTempEl.textContent = jma.temp != null ? jma.temp : "--";
      heroWindEl.textContent = jma.wind != null ? jma.wind : "--";
    } else if (cw) {
      tempEl.textContent = `${cw.temperature}℃`;
      humEl.textContent = "-- %";
      windEl.textContent = `${cw.windspeed} m/s`;
      windDirEl.textContent = getWindDirection16(cw.winddirection);
      precipEl.textContent = "-- mm";
      heroTempEl.textContent = cw.temperature;
      heroWindEl.textContent = cw.windspeed;
    } else {
      tempEl.textContent = "データなし";
      humEl.textContent = "--";
      windEl.textContent = "データなし";
      windDirEl.textContent = "--";
      precipEl.textContent = "--";
      heroTempEl.textContent = "--";
      heroWindEl.textContent = "--";
    }

    const cur = wmData?.marine?.current;
    document.getElementById("wave-height").textContent =
      cur?.wave_height != null ? `${cur.wave_height} m` : "データなし";
    if (cur?.sea_surface_temperature != null) {
      document.getElementById("sea-temp").textContent =
        `${cur.sea_surface_temperature}℃`;
      document.getElementById("hero-sea-temp").textContent =
        cur.sea_surface_temperature;
    } else {
      document.getElementById("sea-temp").textContent = "データなし";
      document.getElementById("hero-sea-temp").textContent = "--";
    }

    document.getElementById("skeleton-loading").style.display = "none";
    document.getElementById("weather-content").style.display = "block";
    document.getElementById("weather-content").classList.remove("is-updating");
    _lastFetchTime = Date.now();
    displayFetchTime();
  } catch (error) {
    console.error("Fetch error:", error);
    document.getElementById("skeleton-loading").style.display = "none";
    document.getElementById("error").style.display = "block";
    document.getElementById("weather-content").classList.remove("is-updating");
    if (timeEl.textContent.includes("更新中")) displayFetchTime();
  } finally {
    _isFetching = false;
  }
}

function showToast() {
  if (_toastShown) return;
  _toastShown = true;
  const t = document.getElementById("toast");
  t.style.display = "block";
  setTimeout(() => t.classList.add("show"), 10);
  setTimeout(() => hideToast(), 8000);
}

function hideToast() {
  const t = document.getElementById("toast");
  t.classList.remove("show");
  setTimeout(() => {
    t.style.display = "none";
    _toastShown = false;
  }, 400);
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

document.addEventListener("DOMContentLoaded", () => {
  fetchWeatherData();
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
