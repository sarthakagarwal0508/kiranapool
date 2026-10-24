const { callMlEndpoint } = require("./ml.service");
const {
  getPlanningConfig,
  commonSlotWindow,
  pointsSpreadKm,
  groupCompatibleOrders,
  calculateRoute,
  haversineKm,
  round,
} = require("./planning.service");

const toNumber = (value) => {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const fallbackEnabled = () => String(process.env.ML_FALLBACK_ENABLED ?? "true").toLowerCase() !== "false";
const integrationEnabled = () =>
  String(process.env.ML_ROUTE_INTEGRATION_ENABLED ?? "true").toLowerCase() !== "false" &&
  Boolean(String(process.env.ML_SERVICE_URL || "").trim());
const routeTimeout = () => Number(process.env.ML_ROUTE_TIMEOUT_MS) || 15000;

const normalizeLocation = (value) => {
  if (!value || typeof value !== "object") return null;
  const lat = toNumber(value.lat ?? value.latitude);
  const lng = toNumber(value.lng ?? value.longitude ?? value.lon);
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
};

const orderId = (order) => String(order?._id ?? order?.id ?? "");
const shopId = (order) => String(order?.shop?._id ?? order?.shop?.id ?? order?.shop ?? "");

// Only send routing-relevant information. Do not expose phone numbers or personal data to the ML service.
const toMlOrder = (order) => {
  const location = normalizeLocation(order?.location);
  if (!orderId(order) || !location) return null;
  return {
    order_id: orderId(order),
    shop_id: shopId(order) || null,
    latitude: location.lat,
    longitude: location.lng,
    delivery_slot_start: order?.deliverySlotStart ? new Date(order.deliverySlotStart).toISOString() : null,
    delivery_slot_end: order?.deliverySlotEnd ? new Date(order.deliverySlotEnd).toISOString() : null,
    area: String(order?.shop?.area || "").trim() || undefined,
  };
};

const getResponseBody = (value) => {
  if (!value || typeof value !== "object") return value;
  // Some implementations wrap response objects in {data: {...}}; unwrap once only.
  if (value.data && typeof value.data === "object" && !Array.isArray(value.data)) return value.data;
  return value;
};

const coordinateKey = (location) => {
  const normalized = normalizeLocation(location);
  if (!normalized) return null;
  return `${normalized.lat.toFixed(6)},${normalized.lng.toFixed(6)}`;
};

const resolveOrderId = (item, context) => {
  if (typeof item === "string" || typeof item === "number") {
    const direct = String(item);
    if (context.byId.has(direct)) return direct;
    if (context.uniqueShopId.has(direct)) return context.uniqueShopId.get(direct);
    return null;
  }
  if (!item || typeof item !== "object") return null;
  const nested = item.order && typeof item.order === "object" ? item.order : item.stop && typeof item.stop === "object" ? item.stop : item;
  const candidates = [nested.order_id, nested.orderId, nested.orderID, nested._id, nested.order?.order_id, nested.order?._id];
  for (const value of candidates) {
    if (value != null && context.byId.has(String(value))) return String(value);
  }
  const shopCandidates = [nested.shop_id, nested.shopId, nested.shop?._id, nested.shop];
  for (const value of shopCandidates) {
    if (value != null && context.uniqueShopId.has(String(value))) return context.uniqueShopId.get(String(value));
  }
  const location = normalizeLocation(nested.location) || normalizeLocation(nested) || normalizeLocation(nested.coordinates);
  const key = coordinateKey(location);
  if (key && context.byCoordinate.has(key)) return context.byCoordinate.get(key);
  return null;
};

const buildOrderContext = (orders) => {
  const byId = new Map(orders.map((order) => [orderId(order), order]).filter(([id]) => Boolean(id)));
  const shopOrderIds = new Map();
  const coordinateOrderIds = new Map();
  for (const order of orders) {
    const id = orderId(order);
    const sid = shopId(order);
    if (sid) shopOrderIds.set(sid, [...(shopOrderIds.get(sid) || []), id]);
    const key = coordinateKey(order.location);
    if (key) coordinateOrderIds.set(key, [...(coordinateOrderIds.get(key) || []), id]);
  }
  const uniqueShopId = new Map([...shopOrderIds.entries()].filter(([, ids]) => ids.length === 1).map(([sid, ids]) => [sid, ids[0]]));
  const byCoordinate = new Map([...coordinateOrderIds.entries()].filter(([, ids]) => ids.length === 1).map(([key, ids]) => [key, ids[0]]));
  return { byId, uniqueShopId, byCoordinate };
};

const extractOrderSequence = (route, orders) => {
  if (!Array.isArray(route) || route.length !== orders.length) return null;
  const context = buildOrderContext(orders);
  const ids = route.map((item) => resolveOrderId(item, context));
  if (ids.some((id) => !id) || new Set(ids).size !== orders.length) return null;
  const allIds = new Set(orders.map(orderId));
  if (ids.some((id) => !allIds.has(id))) return null;
  return ids;
};

const calculateRouteWithMl = async (warehouse, orders, config = getPlanningConfig(), client = callMlEndpoint) => {
  const local = calculateRoute(warehouse, orders, config);
  const integration = {
    enabled: integrationEnabled(),
    routeSolver: { status: "not-used" },
    economics: { status: "not-used" },
    fallbackUsed: false,
    warnings: [],
  };
  if (!integration.enabled) {
    integration.routeSolver.status = "disabled-or-url-not-configured";
    integration.economics.status = "disabled-or-url-not-configured";
    return { ...local, mlIntegration: integration };
  }

  const mlOrders = orders.map(toMlOrder);
  if (mlOrders.some((order) => !order)) {
    const message = "Some orders have missing/invalid IDs or coordinates; ML route/economics calls were skipped";
    if (!fallbackEnabled()) throw Object.assign(new Error(message), { statusCode: 502, code: "ML_INVALID_INPUT" });
    integration.fallbackUsed = true;
    integration.warnings.push(message);
    integration.routeSolver.status = "local-fallback-invalid-input";
    integration.economics.status = "local-fallback-invalid-input";
    return { ...local, mlIntegration: integration };
  }

  let result = local;
  try {
    const response = await client({
      path: "/routes/solve",
      requestBody: {
        stops: mlOrders,
        start_location: {
          latitude: Number(warehouse.location.lat),
          longitude: Number(warehouse.location.lng),
        },
        algorithm: "auto",
      },
      timeoutMs: routeTimeout(),
    });
    const body = getResponseBody(response.data);
    if (!body || typeof body !== "object" || !Array.isArray(body.route)) {
      throw Object.assign(new Error("ML /routes/solve response is missing the documented route array"), { code: "ML_INVALID_RESPONSE" });
    }
    const sequence = extractOrderSequence(body.route, orders);
    if (sequence) {
      result = calculateRoute(warehouse, orders, config, sequence);
      integration.routeSolver.sequenceApplied = true;
      integration.routeSolver.status = "used";
    } else {
      const message = "ML route response did not map cleanly to every stored order; local stop order kept";
      if (!fallbackEnabled()) throw Object.assign(new Error(message), { code: "ML_INVALID_RESPONSE", statusCode: 502 });
      integration.fallbackUsed = true;
      integration.routeSolver.sequenceApplied = false;
      integration.routeSolver.status = "response-valid-sequence-unmatched";
      integration.warnings.push(message);
    }
    integration.routeSolver.algorithm = typeof body.algorithm === "string" ? body.algorithm : null;
    integration.routeSolver.fallback = typeof body.fallback === "boolean" ? body.fallback : null;
    const distanceKm = toNumber(body.distance_km ?? body.distanceKm);
    const travelTimeMinutes = toNumber(body.travel_time_minutes ?? body.travelTimeMinutes);
    if (distanceKm !== null && distanceKm >= 0) integration.routeSolver.distanceKm = distanceKm;
    if (travelTimeMinutes !== null && travelTimeMinutes >= 0) integration.routeSolver.travelTimeMinutes = travelTimeMinutes;
  } catch (error) {
    if (!fallbackEnabled()) throw Object.assign(error, { statusCode: error.statusCode || 502 });
    integration.fallbackUsed = true;
    integration.routeSolver.status = "local-fallback-error";
    integration.warnings.push(`ML route solver unavailable or invalid; local route used (${error.message})`);
  }

  try {
    const shopSoloCosts = {};
    const soloDistances = orders.map((order) => {
      const location = normalizeLocation(order.location);
      const km = 2 * haversineKm(warehouse.location, location) * config.roadFactor;
      const shop = shopId(order) || orderId(order);
      shopSoloCosts[shop] = round((shopSoloCosts[shop] || 0) + (km * config.costPerKm + config.costPerStop), 2);
      return round(km, 4);
    });
    const response = await client({
      path: "/economics/costs",
      requestBody: {
        base_cost: 0,
        cost_per_km: config.costPerKm,
        cost_per_drop: config.costPerStop,
        solo_distances: soloDistances,
        shop_solo_costs: shopSoloCosts,
        total_pooled_cost: result.metrics.pooled.cost,
        total_pooled_distance: result.metrics.pooled.distanceKm,
        num_orders: orders.length,
        allocation_method: "proportional",
      },
      timeoutMs: routeTimeout(),
    });
    const body = getResponseBody(response.data);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw Object.assign(new Error("ML /economics/costs response must be a JSON object"), { code: "ML_INVALID_RESPONSE" });
    }
    const soloCost = toNumber(body.solo_cost ?? body.total_solo_cost);
    const pooledCost = toNumber(body.pooled_cost ?? body.total_pooled_cost);
    if (soloCost !== null && pooledCost !== null && soloCost >= 0 && pooledCost >= 0) {
      result.metrics.solo.totalCost = round(soloCost, 2);
      result.metrics.pooled.cost = round(pooledCost, 2);
      const savingsAmount = toNumber(body.savings_amount);
      const savingsPercentage = toNumber(body.savings_percentage);
      result.metrics.savings.amount = round(savingsAmount !== null ? savingsAmount : soloCost - pooledCost, 2);
      result.metrics.savings.percent = round(savingsPercentage !== null ? savingsPercentage : (soloCost > 0 ? ((soloCost - pooledCost) / soloCost) * 100 : 0), 2);
      result.metrics.savings.mlPerShopSavings = body.per_shop_savings ?? null;
      integration.economics.status = "used";
    } else {
      const message = "ML economics response did not provide numeric solo_cost and pooled_cost; local cost estimates kept";
      if (!fallbackEnabled()) throw Object.assign(new Error(message), { code: "ML_INVALID_RESPONSE", statusCode: 502 });
      integration.fallbackUsed = true;
      integration.economics.status = "response-valid-costs-unmatched";
      integration.warnings.push(message);
    }
    const perShopSavings = body.per_shop_savings;
    if (Array.isArray(perShopSavings)) result.metrics.shopWiseSavingsFromMl = perShopSavings;
    integration.economics.fields = {
      soloCostProvided: soloCost !== null,
      pooledCostProvided: pooledCost !== null,
      savingsAmountProvided: toNumber(body.savings_amount) !== null,
      savingsPercentageProvided: toNumber(body.savings_percentage) !== null,
      perShopSavingsProvided: body.per_shop_savings != null,
    };
  } catch (error) {
    if (!fallbackEnabled()) throw Object.assign(error, { statusCode: error.statusCode || 502 });
    integration.fallbackUsed = true;
    integration.economics.status = "local-fallback-error";
    integration.warnings.push(`ML economics unavailable or invalid; local economics kept (${error.message})`);
  }

  return { ...result, mlIntegration: integration };
};

const batchOrdersWithMl = async (orders, config = getPlanningConfig(), client = callMlEndpoint) => {
  const localGroups = groupCompatibleOrders(orders, config);
  const status = { source: "local-fallback", status: "not-used", warning: null };
  if (!integrationEnabled()) {
    status.status = "disabled-or-url-not-configured";
    return { groups: localGroups, integration: status };
  }
  const mlOrders = orders.map(toMlOrder);
  if (mlOrders.some((order) => !order)) {
    const warning = "Some orders have missing/invalid IDs or coordinates; ML batching skipped";
    if (!fallbackEnabled()) throw Object.assign(new Error(warning), { statusCode: 502, code: "ML_INVALID_INPUT" });
    status.status = "local-fallback-invalid-input";
    status.warning = warning;
    return { groups: localGroups, integration: status };
  }
  try {
    const response = await client({
      path: "/batch",
      requestBody: {
        orders: mlOrders,
        max_distance_km: config.maxStopSpreadKm,
        max_time_window_minutes: null,
        max_orders_per_batch: config.maxPoolStops,
        max_weight_kg: null,
      },
      timeoutMs: routeTimeout(),
    });
    const body = getResponseBody(response.data);
    if (!body || !Array.isArray(body.batches)) throw Object.assign(new Error("ML /batch response is missing the documented batches array"), { code: "ML_INVALID_RESPONSE" });
    const context = buildOrderContext(orders);
    const groups = [];
    for (const batch of body.batches) {
      const items = Array.isArray(batch)
        ? batch
        : batch && typeof batch === "object"
          ? (batch.orders ?? batch.order_ids ?? batch.orderIds ?? batch.items ?? batch.stops ?? batch.route)
          : null;
      if (!Array.isArray(items) || items.length === 0) throw Object.assign(new Error("ML /batch returned an unrecognized batch item shape"), { code: "ML_INVALID_RESPONSE" });
      const ids = items.map((item) => resolveOrderId(item, context));
      if (ids.some((id) => !id) || new Set(ids).size !== ids.length) throw Object.assign(new Error("ML /batch items could not be mapped uniquely to local order IDs"), { code: "ML_INVALID_RESPONSE" });
      const byId = context.byId;
      groups.push(ids.map((id) => byId.get(id)));
    }
    const flattened = groups.flat().map(orderId);
    const inputIds = orders.map(orderId);
    if (flattened.length !== inputIds.length || new Set(flattened).size !== inputIds.length || inputIds.some((id) => !flattened.includes(id))) {
      throw Object.assign(new Error("ML /batch response did not include every input order exactly once"), { code: "ML_INVALID_RESPONSE" });
    }
    for (const group of groups) {
      if (group.length > config.maxPoolStops || (group.length > 1 && !commonSlotWindow(group)) || pointsSpreadKm(group) > config.maxStopSpreadKm) {
        throw Object.assign(new Error("ML /batch returned a group that violates local delivery compatibility limits"), { code: "ML_INVALID_RESPONSE" });
      }
    }
    status.source = "fastapi-ml";
    status.status = "used";
    return { groups, integration: status };
  } catch (error) {
    if (!fallbackEnabled()) throw Object.assign(error, { statusCode: error.statusCode || 502 });
    status.status = "local-fallback-error";
    status.warning = `ML batching unavailable or response did not match schema; local grouping used (${error.message})`;
    return { groups: localGroups, integration: status };
  }
};

module.exports = {
  toMlOrder,
  extractOrderSequence,
  calculateRouteWithMl,
  batchOrdersWithMl,
  integrationEnabled,
  fallbackEnabled,
};
