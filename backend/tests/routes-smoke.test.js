const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../src/app");
const User = require("../src/models/User");
const Warehouse = require("../src/models/Warehouse");
const Order = require("../src/models/Order");
const Plan = require("../src/models/Plan");

test("role and Phase 6 model contracts are registered", () => {
  assert.deepEqual(User.schema.path("role").enumValues, ["shopkeeper", "wholesaler", "rider"]);
  assert.ok(Warehouse.schema.path("owner"));
  assert.ok(Order.schema.path("warehouse"));
  assert.ok(Order.schema.path("deliverySlotStart"));
  assert.ok(Plan.schema.path("route"));
  assert.ok(Plan.schema.path("createdBy"));
});

test("Phase 6/7 protected routes are mounted and reject missing JWTs", async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  try {
    for (const [path, method] of [
      ["/warehouses", "GET"],
      ["/plans/preview", "POST"],
      ["/plan", "POST"],
      ["/plan/latest", "GET"],
      ["/plans/auto-pool", "POST"],
      ["/forecasts", "GET"],
      ["/forecasts/run", "POST"],
      ["/orders", "GET"],
      ["/orders/manual", "POST"],
    ]) {
      const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json" }, ...(method === "POST" ? { body: "{}" } : {}) });
      assert.equal(response.status, 401, `${method} ${path} should require a JWT`);
      const body = await response.json();
      assert.equal(body.success, false);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
