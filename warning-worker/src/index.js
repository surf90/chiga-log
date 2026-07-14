const UPSTREAM_URL =
  "https://www.data.jma.go.jp/multi/data/VPWS50/JPTF_jp.json";
const AREA_CODE = "1420700";
const AREA_NAME = "茅ヶ崎市";
const ALLOWED_ORIGINS = new Set([
  "https://surf90.github.io",
  "http://localhost:4000",
  "http://127.0.0.1:4000",
]);

export function extractWarnings(feed) {
  const item = (feed?.itemArea4 ?? []).find(
    (entry) => entry?.area?.code === AREA_CODE,
  );
  return (item?.kind ?? [])
    .filter((kind) => kind?.name)
    .map((kind) => ({ code: kind.code ?? "", name: kind.name }));
}

function corsHeaders(origin) {
  if (!ALLOWED_ORIGINS.has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function jsonResponse(body, status, origin, cacheControl = "no-store") {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(origin),
      "Cache-Control": cacheControl,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") ?? "";

    if (request.method === "OPTIONS") {
      if (!ALLOWED_ORIGINS.has(origin))
        return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== "GET" || url.pathname !== "/warning") {
      return jsonResponse({ error: "not_found" }, 404, origin);
    }
    if (origin && !ALLOWED_ORIGINS.has(origin)) {
      return jsonResponse({ error: "origin_not_allowed" }, 403, origin);
    }

    try {
      const upstream = await fetch(UPSTREAM_URL, {
        headers: { Accept: "application/json" },
        cf: { cacheEverything: true, cacheTtl: 60 },
      });
      if (!upstream.ok) throw new Error(`JMA returned ${upstream.status}`);

      const feed = await upstream.json();
      if (!feed || !Array.isArray(feed.itemArea4)) {
        throw new Error("Unexpected JMA response schema");
      }

      return jsonResponse(
        {
          reportDateTime: feed.reportDateTime ?? "",
          fetchedAt: new Date().toISOString(),
          source: UPSTREAM_URL,
          area: AREA_NAME,
          areaCode: AREA_CODE,
          warnings: extractWarnings(feed),
        },
        200,
        origin,
        "public, max-age=60, s-maxage=60",
      );
    } catch (error) {
      console.error(
        JSON.stringify({
          event: "jma_warning_fetch_failed",
          message: String(error),
        }),
      );
      return jsonResponse({ error: "upstream_unavailable" }, 502, origin);
    }
  },
};
