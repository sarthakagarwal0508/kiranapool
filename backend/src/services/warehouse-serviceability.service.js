const DEFAULT_MAX_DELIVERY_DISTANCE_KM = 25;

function configuredMaxDistanceKm() {
  const configured = Number(process.env.WAREHOUSE_MAX_DELIVERY_DISTANCE_KM);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_MAX_DELIVERY_DISTANCE_KM;
}

function normalizeArea(value) {
  return String(value || "").trim().toLowerCase().replace(/\\s+/g, " ");
}

function validCoordinates(location) {
  return Boolean(
    location &&
    typeof location.lat === "number" && Number.isFinite(location.lat) &&
    typeof location.lng === "number" && Number.isFinite(location.lng) &&
    location.lat >= -90 && location.lat <= 90 &&
    location.lng >= -180 && location.lng <= 180
  );
}

// Haversine distance between two latitude/longitude points, in kilometres.
function distanceKm(from, to) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371.0088;
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}

/**
 * A warehouse serves a shop when one of these conditions is true:
 * 1. It has no service-area restrictions (existing behaviour).
 * 2. Its serviceAreas contains the shop area (case/whitespace-insensitive).
 * 3. The area name differs, but stored shop and warehouse coordinates are
 *    within WAREHOUSE_MAX_DELIVERY_DISTANCE_KM (default 25 km).
 *
 * Uses saved shop/warehouse coordinates, never client-supplied order coordinates.
 */
function checkWarehouseServiceability({ warehouse, shop, maxDistanceKm = configuredMaxDistanceKm() }) {
  const serviceAreas = Array.isArray(warehouse?.serviceAreas) ? warehouse.serviceAreas : [];
  if (!serviceAreas.length) {
    return { allowed: true, reason: "unrestricted", distanceKm: null, maxDistanceKm };
  }

  const shopAreaValue = shop?.area || String(shop?.address || "").split(",")[0] || "";
  const shopArea = normalizeArea(shopAreaValue);

  // Keep legacy behaviour: if no area is stored, do not reject solely on area.
  if (!shopArea) {
    return { allowed: true, reason: "missing-shop-area", distanceKm: null, maxDistanceKm };
  }

  const areaMatches = serviceAreas.some((area) => normalizeArea(area) === shopArea);
  if (areaMatches) {
    return { allowed: true, reason: "area-match", distanceKm: 0, maxDistanceKm };
  }

  if (!validCoordinates(warehouse?.location) || !validCoordinates(shop?.location)) {
    return {
      allowed: false,
      reason: "area-mismatch-location-unavailable",
      message: "Selected warehouse does not serve this shop's area, and coordinates are unavailable to verify nearby distance",
      distanceKm: null,
      maxDistanceKm,
    };
  }

  const actualDistanceKm = distanceKm(warehouse.location, shop.location);
  if (actualDistanceKm <= maxDistanceKm) {
    return {
      allowed: true,
      reason: "nearby-coordinates",
      distanceKm: Number(actualDistanceKm.toFixed(2)),
      maxDistanceKm,
    };
  }

  return {
    allowed: false,
    reason: "outside-delivery-radius",
    message: `Selected warehouse is ${actualDistanceKm.toFixed(1)} km away and does not serve this shop's area. The maximum distance allowed for an area mismatch is ${maxDistanceKm} km. Choose a closer warehouse or update its service areas.`,
    distanceKm: Number(actualDistanceKm.toFixed(2)),
    maxDistanceKm,
  };
}

module.exports = {
  DEFAULT_MAX_DELIVERY_DISTANCE_KM,
  configuredMaxDistanceKm,
  normalizeArea,
  validCoordinates,
  distanceKm,
  checkWarehouseServiceability,
};
