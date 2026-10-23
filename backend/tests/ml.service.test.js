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
