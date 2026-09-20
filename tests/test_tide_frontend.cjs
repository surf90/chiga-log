const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const APP_SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "assets", "js", "app.js"),
  "utf8",
);

function buildContext(moonPayload) {
  const tideElement = {
    children: [],
    textContent: "",
    appendChild(child) {
      this.children.push(child);
    },
  };

  class FixedDate extends Date {
    constructor(...args) {
      super(...(args.length ? args : ["2026-08-25T03:00:00Z"]));
    }

    static now() {
      return Date.parse("2026-08-25T03:00:00Z");
    }
  }

  const context = {
    AbortSignal,
    Chart: function Chart() {},
    Date: FixedDate,
    Intl,
    URL,
    console,
    fetch: async () => ({ ok: true, json: async () => moonPayload }),
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
      createElement: () =>
        ({
          className: "",
          textContent: "",
          classes: new Set(),
          attributes: {},
          styles: {},
          classList: {
            add(c) {
              this._owner.classes.add(c);
            },
          },
          style: {
            setProperty(k, v) {
              this._owner.styles[k] = v;
            },
          },
          setAttribute(k, v) {
            this.attributes[k] = v;
          },
          _init() {
            this.classList._owner = this;
            this.style._owner = this;
            return this;
          },
        })._init(),
      createTextNode: (textContent) => ({ textContent }),
      currentScript: null,
      getElementById: (id) => (id === "tide-type" ? tideElement : null),
      querySelectorAll: () => [],
    },
  };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(APP_SOURCE, context);
  return { context, tideElement };
}

test("stale moon JSON uses its NASA-derived calendar for today's tide type", async () => {
  const { context, tideElement } = buildContext({
    date: "2026-08-24",
    age: 11.391,
    lunar_day: 12,
    tide_calendar: {
      "2026-08-25": { lunar_day: 14, tide_type: "大潮" },
    },
  });

  await vm.runInContext("calculateTide()", context);

  assert.equal(tideElement.children[0].textContent, "大潮 ");
  // 潮回りと月齢ラベルの間に月相アイコンが入るため、末尾を見る。
  assert.match(tideElement.children.at(-1).textContent, /計算値/);
});

test("moon phase icon reflects illumination and waxing/waning", () => {
  const { context } = buildContext({});
  // 照度0.25・月齢3日（満ちていく側）: |1-2f|=0.5、明側は右のまま。
  const waxing = vm.runInContext(
    "buildMoonPhase(3, 0.25, 29.530588853)",
    context,
  );
  assert.equal(waxing.styles["--term"], "0.500");
  assert.equal(waxing.classes.has("is-gibbous"), false);
  assert.equal(waxing.classes.has("is-waning"), false);
  assert.equal(waxing.attributes["aria-hidden"], "true");

  // 照度0.9・月齢20日（欠けていく側）: 楕円は明側の色、左右反転。
  const waning = vm.runInContext(
    "buildMoonPhase(20, 0.9, 29.530588853)",
    context,
  );
  assert.equal(waning.styles["--term"], "0.800");
  assert.equal(waning.classes.has("is-gibbous"), true);
  assert.equal(waning.classes.has("is-waning"), true);
});

test("moon phase falls back to an age-derived illumination", () => {
  const { context } = buildContext({});
  // 満月(月齢≒14.77)は照度1.0 → |1-2f| = 1（真円）。
  const full = vm.runInContext(
    "buildMoonPhase(14.765294426, null, 29.530588853)",
    context,
  );
  assert.equal(full.styles["--term"], "1.000");
  // 新月(月齢0)も真円だが、こちらは影側のまま（.is-gibbous を付けない）。
  const dark = vm.runInContext(
    "buildMoonPhase(0, null, 29.530588853)",
    context,
  );
  assert.equal(dark.styles["--term"], "1.000");
  assert.equal(dark.classes.has("is-gibbous"), false);
});

test("out-of-range calendar values are ignored", async () => {
  const { context, tideElement } = buildContext({
    date: "2026-08-24",
    age: 11.391,
    tide_calendar: { "2026-08-25": { lunar_day: 31 } },
  });

  await vm.runInContext("calculateTide()", context);

  // 2026-08-25の数式フォールバックは陰暦13日相当の中潮。
  assert.equal(tideElement.children[0].textContent, "中潮 ");
});

test("string calendar values are rejected as schema violations", async () => {
  const { context, tideElement } = buildContext({
    date: "2026-08-24",
    age: 11.391,
    tide_calendar: { "2026-08-25": { lunar_day: "14" } },
  });

  await vm.runInContext("calculateTide()", context);

  assert.equal(tideElement.children[0].textContent, "中潮 ");
});

test("all lunar-day tide boundaries match the standard 30-day sequence", () => {
  const { context } = buildContext({});
  const actual = vm.runInContext(
    "Array.from({ length: 30 }, (_, i) => tideTypeForLunarDay(i + 1))",
    context,
  );
  const expected = [
    "大潮",
    "大潮",
    "中潮",
    "中潮",
    "中潮",
    "中潮",
    "小潮",
    "小潮",
    "小潮",
    "長潮",
    "若潮",
    "中潮",
    "中潮",
    "大潮",
    "大潮",
    "大潮",
    "大潮",
    "中潮",
    "中潮",
    "中潮",
    "中潮",
    "小潮",
    "小潮",
    "小潮",
    "長潮",
    "若潮",
    "中潮",
    "中潮",
    "大潮",
    "大潮",
  ];
  assert.deepEqual([...actual], expected);
});
