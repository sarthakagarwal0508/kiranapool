const test = require("node:test");
const assert = require("node:assert/strict");
const {
  haversineKm,
  commonSlotWindow,
  isPoolCompatible,
  groupCompatibleOrders,
  calculateRoute,
} = require("../src/services/planning.service");

const warehouse = { _id: "warehouse-a", location: { lat: 0, lng: 0 } };
const slotStart = new Date("2030-01-01T10:00:00.000Z");
const slotEnd = new Date("2030-01-01T12:00:00.000Z");
const makeOrder = (id, lng, options = {}) => ({
  _id: id,
  warehouse: options.warehouse || "warehouse-a",
  shop: { _id: `shop-${id}`, name: `Shop ${id}` },
  location: { lat: options.lat || 0.01, lng },
  deliveryAddress: `Address ${id}`,
  deliverySlotStart: options.start || slotStart,
  deliverySlotEnd: options.end || slotEnd,
  createdAt: new Date("2029-12-01T00:00:00Z"),
});

test("haversine returns zero for the same point and positive distance for different points", () => {
  assert.equal(haversineKm({ lat: 26, lng: 75 }, { lat: 26, lng: 75 }), 0);
  assert.ok(haversineKm({ lat: 26, lng: 75 }, { lat: 26.01, lng: 75 }) > 1);
});

test("delivery slots must overlap for pooling", () => {
  const a = makeOrder("a", 0.01);
  const b = makeOrder("b", 0.011, { start: new Date("2030-01-01T11:00:00Z"), end: new Date("2030-01-01T13:00:00Z") });
  assert.ok(commonSlotWindow([a, b]));
  const c = makeOrder("c", 0.012, { start: new Date("2030-01-01T13:00:00Z"), end: new Date("2030-01-01T14:00:00Z") });
  assert.equal(commonSlotWindow([a, c]), null);
});

test("orders from different warehouses never pool together", () => {
  const a = makeOrder("a", 0.01, { warehouse: "warehouse-a" });
  const b = makeOrder("b", 0.011, { warehouse: "warehouse-b" });
  const groups = groupCompatibleOrders([a, b]);
  assert.equal(groups.length, 2);
  assert.equal(isPoolCompatible([a], b), false);
});

test("route estimate reports route, pooled/solo costs and savings", () => {
  const orders = [makeOrder("a", 0.01), makeOrder("b", 0.011)];
  const result = calculateRoute(warehouse, orders);
  assert.equal(result.route.length, 2);
  assert.equal(result.metrics.orderCount, 2);
  assert.ok(result.metrics.pooled.distanceKm > 0);
  assert.ok(result.metrics.solo.totalCost > 0);
  assert.equal(result.metrics.savings.currency, "INR");
  assert.ok(Number.isFinite(result.metrics.savings.percent));
  assert.equal(result.metrics.shopWiseSavings.length, 2);
  const allocatedSavings = result.metrics.shopWiseSavings.reduce((sum, row) => sum + row.savings, 0);
  assert.ok(Math.abs(allocatedSavings - result.metrics.savings.amount) < 0.05);
});
