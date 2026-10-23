const test = require("node:test");
const assert = require("node:assert/strict");
const {
  calculateRouteWithMl,
  batchOrdersWithMl,
  extractOrderSequence,
} = require("../src/services/ml-planning.service");
const { getPlanningConfig } = require("../src/services/planning.service");

const makeOrder = (id, lng, shopSuffix = id) => ({
  _id: id,
  shop: { _id: `shop-${shopSuffix}`, name: `Shop ${shopSuffix}`, area: "Mansarovar" },
  warehouse: "warehouse-1",
  location: { lat: 26.9124, lng },
  deliverySlotStart: new Date("2030-01-01T08:00:00.000Z"),
  deliverySlotEnd: new Date("2030-01-01T10:00:00.000Z"),
  deliveryAddress: `Address ${id}`,
  totalAmount: 100,
});

const withEnv = async (values, callback) => {
  const old = {};
  for (const [key, value] of Object.entries(values)) {
    old[key] = process.env[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  try { return await callback(); }
  finally {
    for (const [key, value] of Object.entries(old)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
};

test("ML route solver sequence is only applied when it maps every order exactly once", () => {
  const orders = [makeOrder("o1", 75.78), makeOrder("o2", 75.79)];
  assert.deepEqual(extractOrderSequence([{ order_id: "o2" }, { order_id: "o1" }], orders), ["o2", "o1"]);
  assert.equal(extractOrderSequence([{ order_id: "o2" }, { order_id: "not-an-order" }], orders), null);
  assert.equal(extractOrderSequence([{ order_id: "o2" }], orders), null);
});

test("plan route helper uses a valid ML stop order and numeric economics response", async () => {
  await withEnv({ ML_SERVICE_URL: "https://ml.example.test", ML_ROUTE_INTEGRATION_ENABLED: "true", ML_FALLBACK_ENABLED: "true" }, async () => {
    const orders = [makeOrder("o1", 75.78), makeOrder("o2", 75.79)];
    const warehouse = { location: { lat: 26.9124, lng: 75.77 } };
    const client = async ({ path }) => {
      if (path === "/routes/solve") return { status: 200, data: { route: [{ order_id: "o2" }, { order_id: "o1" }], algorithm: "test-solver", fallback: false, distance_km: 2, travel_time_minutes: 20 } };
      if (path === "/economics/costs") return { status: 200, data: { solo_cost: 100, pooled_cost: 60, savings_amount: 40, savings_percentage: 40, per_shop_savings: [{ shop_id: "shop-o1", savings: 20 }] } };
      throw new Error(`Unexpected ML path ${path}`);
    };
    const result = await calculateRouteWithMl(warehouse, orders, getPlanningConfig(), client);
    assert.equal(result.route[0].orderId, "o2");
    assert.equal(result.metrics.solo.totalCost, 100);
    assert.equal(result.metrics.pooled.cost, 60);
    assert.equal(result.metrics.savings.amount, 40);
    assert.equal(result.mlIntegration.routeSolver.status, "used");
    assert.equal(result.mlIntegration.economics.status, "used");
  });
});

test("ML batching only replaces local groups when all orders are mapped and valid", async () => {
  await withEnv({ ML_SERVICE_URL: "https://ml.example.test", ML_ROUTE_INTEGRATION_ENABLED: "true", ML_FALLBACK_ENABLED: "true" }, async () => {
    const orders = [makeOrder("o1", 75.78), makeOrder("o2", 75.79)];
    const result = await batchOrdersWithMl(orders, getPlanningConfig(), async ({ path }) => {
      assert.equal(path, "/batch");
      return { status: 200, data: { status: "ok", batches_count: 1, batches: [{ orders: [{ order_id: "o2" }, { order_id: "o1" }] }] } };
    });
    assert.equal(result.integration.source, "fastapi-ml");
    assert.equal(result.groups.length, 1);
    assert.deepEqual(result.groups[0].map((order) => String(order._id)), ["o2", "o1"]);
  });
});

test("unmappable ML batch response safely uses local grouping when fallback is enabled", async () => {
  await withEnv({ ML_SERVICE_URL: "https://ml.example.test", ML_ROUTE_INTEGRATION_ENABLED: "true", ML_FALLBACK_ENABLED: "true" }, async () => {
    const orders = [makeOrder("o1", 75.78), makeOrder("o2", 75.79)];
    const result = await batchOrdersWithMl(orders, getPlanningConfig(), async () => ({ status: 200, data: { batches: [{ orders: [{ order_id: "unknown" }] }] } }));
    assert.equal(result.integration.status, "local-fallback-error");
    assert.equal(result.groups.flat().length, 2);
    assert.match(result.integration.warning, /could not be mapped/i);
  });
});

test("nullable economics fields do not become zero-cost overrides", async () => {
  await withEnv({ ML_SERVICE_URL: "https://ml.example.test", ML_ROUTE_INTEGRATION_ENABLED: "true", ML_FALLBACK_ENABLED: "true" }, async () => {
    const orders = [makeOrder("o1", 75.78), makeOrder("o2", 75.79)];
    const warehouse = { location: { lat: 26.9124, lng: 75.77 } };
    const client = async ({ path }) => {
      if (path === "/routes/solve") return { status: 200, data: { route: [{ order_id: "o1" }, { order_id: "o2" }], algorithm: "test-solver", fallback: false } };
      if (path === "/economics/costs") return { status: 200, data: { solo_cost: null, pooled_cost: null, savings_amount: null, savings_percentage: null } };
      throw new Error(`Unexpected ML path ${path}`);
    };
    const result = await calculateRouteWithMl(warehouse, orders, getPlanningConfig(), client);
    assert.ok(result.metrics.solo.totalCost > 0);
    assert.ok(result.metrics.pooled.cost > 0);
    assert.equal(result.mlIntegration.economics.status, "response-valid-costs-unmatched");
  });
});
