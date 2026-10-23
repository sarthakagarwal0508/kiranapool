const test = require("node:test");
const assert = require("node:assert/strict");
const { getSlotKey, deriveArea, buildFallbackForecasts, startOfIstDay } = require("../src/services/ml.service");

test("time slots use India time boundaries", () => {
  assert.equal(getSlotKey("2030-01-01T03:30:00.000Z"), "morning"); // 09:00 IST
  assert.equal(getSlotKey("2030-01-01T08:00:00.000Z"), "afternoon"); // 13:30 IST
  assert.equal(getSlotKey("2030-01-01T13:00:00.000Z"), "evening"); // 18:30 IST
});

test("area falls back to the leading address locality", () => {
  assert.equal(deriveArea({ area: "  Mansarovar  ", address: "Other" }), "Mansarovar");
  assert.equal(deriveArea({ address: "Vaishali Nagar, Jaipur" }), "Vaishali Nagar");
});

test("fallback builds shop-wise and area-wise forecasts for the horizon", () => {
  const now = new Date("2030-01-29T08:00:00.000Z");
  const start = startOfIstDay(now);
  const shop = { _id: "shop-1", name: "One Shop", area: "Mansarovar", address: "Mansarovar, Jaipur" };
  const orders = [];
  for (let daysAgo = 1; daysAgo <= 21; daysAgo += 1) {
    const slot = new Date(start.getTime() - daysAgo * 86400000 + 9 * 3600000);
    orders.push({ _id: `order-${daysAgo}`, shop, deliverySlotStart: slot, createdAt: slot, location: { lat: 26.8, lng: 75.7 } });
  }
  const rows = buildFallbackForecasts({ orders, shops: [shop], horizonDays: 3, groupBy: "both", now });
  assert.ok(rows.some((r) => r.scope === "shop"));
  assert.ok(rows.some((r) => r.scope === "area"));
  assert.ok(rows.length >= 18);
  assert.ok(rows.every((r) => r.predictedOrders >= 0));
});

test("generic ML client joins the configured root URL and endpoint path", async () => {
  const { callMlEndpoint } = require("../src/services/ml.service");
  const originalFetch = global.fetch;
  const originalToken = process.env.ML_SERVICE_TOKEN;
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true }) };
  };
  delete process.env.ML_SERVICE_TOKEN;
  try {
    const result = await callMlEndpoint({ baseUrl: "https://ml.example.test/", path: "/routes/solve", requestBody: { stops: [] }, timeoutMs: 1000 });
    assert.equal(request.url, "https://ml.example.test/routes/solve");
    assert.equal(request.options.method, "POST");
    assert.deepEqual(JSON.parse(request.options.body), { stops: [] });
    assert.equal(result.data.ok, true);
  } finally {
    global.fetch = originalFetch;
    if (originalToken == null) delete process.env.ML_SERVICE_TOKEN;
    else process.env.ML_SERVICE_TOKEN = originalToken;
  }
});

test("generic ML client reports a response timeout without exposing request details", async () => {
  const { callMlEndpoint } = require("../src/services/ml.service");
  const originalFetch = global.fetch;
  global.fetch = async (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })), { once: true });
  });
  try {
    await assert.rejects(
      () => callMlEndpoint({ baseUrl: "https://ml.example.test", path: "/health", method: "GET", timeoutMs: 100 }),
      (error) => error.code === "ML_TIMEOUT" && error.statusCode === 504,
    );
  } finally {
    global.fetch = originalFetch;
  }
});
