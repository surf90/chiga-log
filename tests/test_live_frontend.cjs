// フロントのデータ鮮度まわり（アメダスのライブ補完・波高の時系列選択・
// 風予報のカバレッジ判定）の回帰テスト。
// GitHub Actions の schedule 発火遅延（2026-08 実測で最大12時間）に対して、
// 「必要な時だけ外部取得する」「予報は誤警告しない」ことを固定する。
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const APP_SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "assets", "js", "app.js"),
  "utf8",
);

// 2026-08-29T10:30 JST 固定。アメダスの3時間ブロックは 09、直近スロットは 10:20。
const NOW_ISO = "2026-08-29T01:30:00Z";
const NOW_MS = Date.parse(NOW_ISO);

function makeElement() {
  const el = {
    className: "",
    textContent: "",
    innerHTML: "",
    hidden: false,
    children: [],
    style: {},
    attributes: {},
    classList: {
      _set: new Set(),
      add(c) {
        this._set.add(c);
      },
      remove(c) {
        this._set.delete(c);
      },
      contains(c) {
        return this._set.has(c);
      },
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    append(...nodes) {
      this.children.push(...nodes);
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    addEventListener() {},
  };
  return el;
}

function buildContext({ fetchImpl } = {}) {
  const elements = new Map();
  const getElementById = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement());
    return elements.get(id);
  };

  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : [NOW_ISO]));
    }
    static now() {
      return NOW_MS;
    }
  }

  const calls = [];
  const context = {
    AbortSignal,
    Chart: function Chart() {},
    Date: FixedDate,
    Intl,
    URL,
    console,
    fetch: async (url) => {
      calls.push(String(url));
      if (fetchImpl) return fetchImpl(String(url));
      return { ok: true, json: async () => ({}) };
    },
    localStorage: { getItem: () => null, removeItem() {}, setItem() {} },
    navigator: {},
    performance,
    requestAnimationFrame() {},
    sessionStorage: { getItem: () => null, removeItem() {}, setItem() {} },
    setInterval() {},
    setTimeout() {},
    clearInterval() {},
    clearTimeout() {},
    window: {
      SITE_CONFIG: {},
      addEventListener() {},
      location: { protocol: "https:" },
      matchMedia: () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      }),
    },
    document: {
      addEventListener() {},
      createElement: () => makeElement(),
      createTextNode: (textContent) => ({ textContent }),
      currentScript: null,
      getElementById,
      querySelectorAll: () => [],
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(APP_SOURCE, context);
  return { context, elements, calls, getElementById };
}

const jsonResponse = (payload) => ({ ok: true, json: async () => payload });

// ─── アメダス値の品質管理フラグ ────────────────────────────────
test("amedasQcValue mirrors the Python _qc_value rules", () => {
  const { context } = buildContext();
  const run = (expr) => vm.runInContext(expr, context);
  assert.equal(run("amedasQcValue([25.3, 0])"), 25.3);
  assert.equal(run("amedasQcValue([25.3, 1])"), null);
  assert.equal(run("amedasQcValue([null, 0])"), null);
  assert.equal(run("amedasQcValue([25.3])"), null);
  assert.equal(run("amedasQcValue(25.3)"), null);
  assert.equal(run("amedasQcValue(undefined)"), null);
});

// ─── 地点別JSONのURL（JSTの3時間ブロック） ────────────────────
test("amedasPointRef builds the JST 3-hour block URL", () => {
  const { context } = buildContext();
  const ref = vm.runInContext("amedasPointRef(Date.now())", context);
  assert.equal(
    ref.url,
    "https://www.jma.go.jp/bosai/amedas/data/point/46141/20260829_09.json",
  );
  assert.equal(ref.key, "cache_amedas_46141_20260829_09");
  // 3時間前は 06 ブロック
  const prev = vm.runInContext(
    "amedasPointRef(Date.now() - 3 * 3600e3)",
    context,
  );
  assert.match(prev.url, /20260829_06\.json$/);
});

// ─── ライブ取得 ────────────────────────────────────────────────
test("fetchLiveAmedas takes the newest slot and drops QC-flagged values", async () => {
  const { context } = buildContext({
    fetchImpl: async () =>
      jsonResponse({
        20260829101000: { temp: [24.9, 0], wind: [3.0, 0] },
        20260829102000: {
          temp: [25.3, 0],
          wind: [3.2, 0],
          windDirection: [1, 0],
          humidity: [71, 0],
          precipitation1h: [0.5, 1],
        },
      }),
  });
  const live = await vm.runInContext("fetchLiveAmedas()", context);
  assert.equal(live.observed_at, "2026-08-29T10:20:00+09:00");
  assert.equal(live.temp, 25.3);
  assert.equal(live.humidity, 71);
  // フラグ1（品質不良）は欠測扱い
  assert.equal(live.precipitation1h, null);
});

test("fetchLiveAmedas falls back to the previous 3-hour block when empty", async () => {
  const { context, calls } = buildContext({
    fetchImpl: async (url) =>
      url.includes("_09.json")
        ? jsonResponse({})
        : jsonResponse({ 20260829085000: { temp: [24.1, 0] } }),
  });
  const live = await vm.runInContext("fetchLiveAmedas()", context);
  assert.equal(live.temp, 24.1);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /20260829_06\.json/);
});

test("fetchLiveAmedas returns null when the fetch fails", async () => {
  const { context } = buildContext({
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  assert.equal(await vm.runInContext("fetchLiveAmedas()", context), null);
});

test("fetchLiveAmedas returns null when every value is missing", async () => {
  const { context } = buildContext({
    fetchImpl: async () =>
      jsonResponse({ 20260829102000: { temp: [25.3, 1], wind: [3.2, 1] } }),
  });
  assert.equal(await vm.runInContext("fetchLiveAmedas()", context), null);
});

// ─── 取得を出す条件（三原則3: 必要な時だけ） ──────────────────
test("upgradeWithLiveAmedas issues no request while the observation is fresh", async () => {
  const { context, calls } = buildContext();
  const result = await vm.runInContext(
    `upgradeWithLiveAmedas({
       updated_at: "2026-08-29T10:00:00+09:00",
       jma_amedas: { observed_at: "2026-08-29T10:20:00+09:00", temp: 25.3 },
     })`,
    context,
  );
  assert.equal(result, null);
  assert.deepEqual(calls, []);
});

test("upgradeWithLiveAmedas refreshes a stale observation", async () => {
  const { context, calls } = buildContext({
    fetchImpl: async () =>
      jsonResponse({ 20260829102000: { temp: [25.3, 0], wind: [3.2, 0] } }),
  });
  const result = await vm.runInContext(
    `upgradeWithLiveAmedas({
       updated_at: "2026-08-29T06:30:00+09:00",
       jma_amedas: { observed_at: "2026-08-29T06:20:00+09:00", temp: 21.0 },
       marine: { current: { time: "2026-08-29T06:30+09:00", wave_height: 0.5 } },
     })`,
    context,
  );
  assert.equal(calls.length, 1);
  assert.equal(result.jma_amedas.temp, 25.3);
  // 差し替えるのはアメダスだけ。他のキーはスナップショットのまま残す。
  assert.equal(result.marine.current.wave_height, 0.5);
});

test("upgradeWithLiveAmedas keeps the snapshot when the live fetch fails", async () => {
  const { context } = buildContext({
    fetchImpl: async () => {
      throw new Error("offline");
    },
  });
  const result = await vm.runInContext(
    `upgradeWithLiveAmedas({
       jma_amedas: { observed_at: "2026-08-29T06:20:00+09:00", temp: 21.0 },
     })`,
    context,
  );
  assert.equal(result, null);
});

// ─── 波高・海水温は時系列から現在時刻の行を選ぶ ───────────────
test("pickSeaState prefers the hourly row covering now over a stale current", () => {
  const { context } = buildContext();
  const sea = vm.runInContext(
    `pickSeaState({
       current: { time: "2026-08-29T06:30+09:00", wave_height: 0.9, sea_surface_temperature: 26.0 },
       hourly: {
         time: ["2026-08-29T09:00+09:00", "2026-08-29T10:00+09:00", "2026-08-29T11:00+09:00"],
         wave_height: [0.6, 0.5, 0.4],
         sea_surface_temperature: [27.1, 27.3, 27.5],
       },
     })`,
    context,
  );
  assert.equal(sea.wave_height, 0.5);
  assert.equal(sea.sea_surface_temperature, 27.3);
  assert.equal(sea.ms, Date.parse("2026-08-29T10:00:00+09:00"));
});

test("pickSeaState falls back to current when no hourly series exists", () => {
  const { context } = buildContext();
  const sea = vm.runInContext(
    `pickSeaState({
       current: { time: "2026-08-29T10:30+09:00", wave_height: 0.5, sea_surface_temperature: 27.3 },
     })`,
    context,
  );
  assert.equal(sea.wave_height, 0.5);
  assert.equal(sea.ms, Date.parse("2026-08-29T10:30:00+09:00"));
});

test("pickSeaState ignores future hourly rows", () => {
  const { context } = buildContext();
  const sea = vm.runInContext(
    `pickSeaState({
       current: { time: "2026-08-29T10:00+09:00", wave_height: 0.5 },
       hourly: { time: ["2026-08-29T23:00+09:00"], wave_height: [2.0] },
     })`,
    context,
  );
  assert.equal(sea.wave_height, 0.5);
});

// ─── 描画と注記 ────────────────────────────────────────────────
test("renderWeatherCards shows the observation time and hides the stale note", () => {
  const { context, getElementById } = buildContext();
  vm.runInContext(
    `renderWeatherCards({
       updated_at: "2026-08-29T10:32:00+09:00",
       jma_amedas: { observed_at: "2026-08-29T10:20:00+09:00", temp: 25.3, wind: 3.2, humidity: 71, windDirection: 1, precipitation1h: 0 },
       marine: { current: { time: "2026-08-29T10:30+09:00", wave_height: 0.5, sea_surface_temperature: 27.3 } },
     })`,
    context,
  );
  assert.equal(getElementById("temp").textContent, "25.3℃");
  assert.equal(getElementById("amedas-observed").textContent, "（10:20 観測）");
  assert.equal(getElementById("amedas-observed").hidden, false);
  assert.equal(getElementById("marine-stale").hidden, true);
  assert.equal(getElementById("sea-stale").hidden, true);
});

test("renderWeatherCards warns when the observation itself is hours old", () => {
  const { context, getElementById } = buildContext();
  vm.runInContext(
    `renderWeatherCards({
       updated_at: "2026-08-29T10:32:00+09:00",
       jma_amedas: { observed_at: "2026-08-29T06:20:00+09:00", temp: 21.0 },
     })`,
    context,
  );
  // updated_at が新しくても、実測が4時間前なら警告する（誤読防止）
  assert.equal(getElementById("marine-stale").hidden, false);
  assert.match(getElementById("marine-stale").textContent, /4時間前/);
});

test("renderWeatherCards warns when the sea-state series no longer covers now", () => {
  const { context, getElementById } = buildContext();
  vm.runInContext(
    `renderWeatherCards({
       jma_amedas: { observed_at: "2026-08-29T10:20:00+09:00", temp: 25.3 },
       marine: { current: { time: "2026-08-28T18:00+09:00", wave_height: 0.9 } },
     })`,
    context,
  );
  assert.equal(getElementById("sea-stale").hidden, false);
  assert.match(getElementById("sea-stale").textContent, /16時間前の値/);
});

// ─── 風予報は「系列が現在時刻に届いているか」で判定する ────────
function windPayload(updatedAt, times) {
  return {
    updated_at: updatedAt,
    items: times.map((t) => ({
      time: t,
      wind_speed_ms: 3.0,
      wind_direction_deg: 180,
    })),
  };
}

test("wind card stays unwarned while the forecast still covers the future", async () => {
  const { context, getElementById } = buildContext({
    fetchImpl: async () =>
      jsonResponse(
        // 生成は4時間前だが、系列は当日23時まで残っている
        windPayload("2026-08-29T06:30:00+09:00", [
          "2026-08-29T10:00",
          "2026-08-29T11:00",
          "2026-08-29T23:00",
        ]),
      ),
  });
  await vm.runInContext("fetchWindForecast()", context);
  assert.equal(getElementById("wind-stale").hidden, true);
});

test("wind card warns once the series no longer reaches the present", async () => {
  const { context, getElementById } = buildContext({
    fetchImpl: async () =>
      jsonResponse(
        windPayload("2026-08-28T22:30:00+09:00", [
          "2026-08-29T08:00",
          "2026-08-29T09:00",
        ]),
      ),
  });
  await vm.runInContext("fetchWindForecast()", context);
  assert.equal(getElementById("wind-stale").hidden, false);
});
