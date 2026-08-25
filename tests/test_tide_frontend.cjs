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
      createElement: () => ({ className: "", textContent: "" }),
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
  assert.match(tideElement.children[1].textContent, /計算値/);
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
