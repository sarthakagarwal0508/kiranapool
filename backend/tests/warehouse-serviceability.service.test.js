const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_MAX_DELIVERY_DISTANCE_KM,
  distanceKm,
  checkWarehouseServiceability,
} = require("../src/services/warehouse-serviceability.service");

const warehouse = {
  serviceAreas: ["Mansarovar", "Malviya Nagar"],
  location: { lat: 26.785, lng: 75.85 },
};

function shop(area, lat, lng) {
  return { area, address: `${area}, Jaipur`, location: { lat, lng } };
}

test("area match remains allowed even when coordinates are far away", () => {
  const result = checkWarehouseServiceability({
    warehouse,
    shop: shop("  MANSAROVAR  ", 28.6, 77.2),
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "area-match");
});

test("area mismatch is allowed when saved GPS points are within the configured nearby radius", () => {
  const result = checkWarehouseServiceability({
    warehouse,
    shop: shop("Different Jaipur locality", 26.854, 75.764),
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "nearby-coordinates");
  assert.ok(result.distanceKm < DEFAULT_MAX_DELIVERY_DISTANCE_KM);
});

test("area mismatch is rejected when saved GPS points exceed the radius", () => {
  const result = checkWarehouseServiceability({
    warehouse,
    shop: shop("Far away area", 28.6139, 77.209),
  });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "outside-delivery-radius");
  assert.match(result.message, /maximum distance allowed/i);
  assert.ok(result.distanceKm > DEFAULT_MAX_DELIVERY_DISTANCE_KM);
});

test("warehouse without service-area restrictions can serve any shop (existing behaviour)", () => {
  const result = checkWarehouseServiceability({
    warehouse: { serviceAreas: [], location: { lat: 26.785, lng: 75.85 } },
    shop: shop("Any area", 28.6139, 77.209),
  });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "unrestricted");
});

test("distance helper returns zero for identical points and positive km for distinct points", () => {
  assert.equal(distanceKm({ lat: 26, lng: 75 }, { lat: 26, lng: 75 }), 0);
  assert.ok(distanceKm({ lat: 26, lng: 75 }, { lat: 26.01, lng: 75 }) > 1);
});
