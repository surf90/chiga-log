import test from "node:test";
import assert from "node:assert/strict";

import worker, { extractWarnings } from "../src/index.js";

test("extractWarnings returns only Chigasaki warnings", () => {
  const warnings = extractWarnings({
    itemArea4: [
      { area: { code: "9999999" }, kind: [{ code: "01", name: "対象外" }] },
      {
        area: { code: "1420700" },
        kind: [
          { code: "10", name: "波浪注意報" },
          { code: "", name: "" },
        ],
      },
    ],
  });
  assert.deepEqual(warnings, [{ code: "10", name: "波浪注意報" }]);
});

test("GET /warning transforms the latest JMA feed and adds CORS", async (t) => {
  t.mock.method(globalThis, "fetch", async () =>
    Response.json({
      reportDateTime: "2026/07/14 13:00",
      itemArea4: [
        {
          area: { code: "1420700" },
          kind: [{ code: "10", name: "波浪注意報" }],
        },
      ],
    }),
  );

  const response = await worker.fetch(
    new Request("https://example.workers.dev/warning", {
      headers: { Origin: "https://surf90.github.io" },
    }),
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get("Access-Control-Allow-Origin"),
    "https://surf90.github.io",
  );
  assert.equal(body.areaCode, "1420700");
  assert.deepEqual(body.warnings, [{ code: "10", name: "波浪注意報" }]);
});

test("unknown origins are rejected", async () => {
  const response = await worker.fetch(
    new Request("https://example.workers.dev/warning", {
      headers: { Origin: "https://evil.example" },
    }),
  );
  assert.equal(response.status, 403);
});
