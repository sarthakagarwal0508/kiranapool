const EARTH_RADIUS_KM = 6371;

const haversineKm = (a, b) => {
  if (!a || !b) return 0;
  const toRad = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const lat1 = toRad(Number(a.lat));
  const lat2 = toRad(Number(b.lat));
  const value = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(Math.min(1, Math.max(0, value))));
};

const getPlanningConfig = () => ({
  roadFactor: Math.max(1, Number(process.env.ROUTE_ROAD_FACTOR) || 1.2),
  costPerKm: Math.max(0, Number(process.env.DELIVERY_COST_PER_KM) || 12),
  costPerStop: Math.max(0, Number(process.env.DELIVERY_COST_PER_STOP) || 15),
  averageSpeedKmph: Math.max(5, Number(process.env.ROUTE_AVERAGE_SPEED_KMPH) || 20),
  serviceMinutesPerStop: Math.max(0, Number(process.env.ROUTE_SERVICE_MINUTES_PER_STOP) || 5),
  maxPoolStops: Math.min(25, Math.max(2, Number(process.env.POOL_MAX_STOPS) || 8)),
  maxStopSpreadKm: Math.max(1, Number(process.env.POOL_MAX_STOP_SPREAD_KM) || 15),
});

const asDate = (value) => value ? new Date(value) : null;

const commonSlotWindow = (orders) => {
  const starts = orders.map((order) => asDate(order.deliverySlotStart));
  const ends = orders.map((order) => asDate(order.deliverySlotEnd));
  if (starts.some((date) => !date || Number.isNaN(date.getTime())) || ends.some((date) => !date || Number.isNaN(date.getTime()))) return null;
  const start = new Date(Math.max(...starts.map((date) => date.getTime())));
  const end = new Date(Math.min(...ends.map((date) => date.getTime())));
  return end > start ? { start, end } : null;
};

const pointsSpreadKm = (orders) => {
  let max = 0;
  for (let i = 0; i < orders.length; i += 1) {
    for (let j = i + 1; j < orders.length; j += 1) {
      max = Math.max(max, haversineKm(orders[i].location, orders[j].location));
    }
  }
  return max;
};

const isPoolCompatible = (orders, candidate, config = getPlanningConfig()) => {
  if (orders.length && candidate?.warehouse && String(orders[0].warehouse) !== String(candidate.warehouse)) return false;
  const combined = [...orders, candidate];
  if (combined.length > config.maxPoolStops) return false;
  if (!commonSlotWindow(combined)) return false;
  return pointsSpreadKm(combined) <= config.maxStopSpreadKm;
};

const groupCompatibleOrders = (orders, config = getPlanningConfig()) => {
  const ordered = [...orders].sort((a, b) => new Date(a.deliverySlotStart) - new Date(b.deliverySlotStart) || new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  const groups = [];
  for (const order of ordered) {
    if (!order.deliverySlotStart || !order.deliverySlotEnd || !order.location) continue;
    let placed = false;
    for (const group of groups) {
      const sameWarehouse = String(group[0].warehouse) === String(order.warehouse);
      if (sameWarehouse && isPoolCompatible(group, order, config)) {
        group.push(order);
        placed = true;
        break;
      }
    }
    if (!placed) groups.push([order]);
  }
  return groups;
};

const calculateRoute = (warehouse, orders, config = getPlanningConfig(), sequenceOrderIds = null) => {
  const warehouseLocation = warehouse?.location;
  if (!warehouseLocation || !Array.isArray(orders) || orders.length === 0) {
    throw new Error("A warehouse location and at least one order are required to calculate a route");
  }
  const inputOrders = [...orders];
  let mlSequence = null;
  if (Array.isArray(sequenceOrderIds) && sequenceOrderIds.length === inputOrders.length) {
    const byId = new Map(inputOrders.map((order) => [String(order._id), order]));
    const ids = sequenceOrderIds.map(String);
    if (new Set(ids).size === inputOrders.length && ids.every((id) => byId.has(id))) {
      mlSequence = ids.map((id) => byId.get(id));
    }
  }
  const remaining = (mlSequence || inputOrders).map((order) => ({ order, distanceKm: 0 }));
  let current = warehouseLocation;
  let distanceRoadKm = 0;
  let elapsedMinutes = 0;
  const route = [];
  while (remaining.length) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;
    if (!mlSequence) {
      for (let i = 0; i < remaining.length; i += 1) {
        const distance = haversineKm(current, remaining[i].order.location);
        if (distance < nearestDistance) { nearestDistance = distance; nearestIndex = i; }
      }
    } else {
      nearestDistance = haversineKm(current, remaining[0].order.location);
    }
    const [{ order }] = remaining.splice(nearestIndex, 1);
    const legKm = nearestDistance * config.roadFactor;
    distanceRoadKm += legKm;
    elapsedMinutes += (legKm / config.averageSpeedKmph) * 60;
    const arrivalOffsetMinutes = elapsedMinutes;
    elapsedMinutes += config.serviceMinutesPerStop;
    route.push({
      sequence: route.length + 1,
      orderId: String(order._id),
      shopId: order.shop?._id ? String(order.shop._id) : String(order.shop),
      shopName: order.shop?.name || order.customerName || "Shop",
      address: order.deliveryAddress || order.shop?.address || "",
      location: order.location,
      distanceFromPreviousKm: round(legKm, 2),
      cumulativeDistanceKm: round(distanceRoadKm, 2),
      estimatedArrivalOffsetMin: Math.round(arrivalOffsetMinutes),
    });
    current = order.location;
  }
  const rawReturn = haversineKm(current, warehouseLocation);
  const returnKm = rawReturn * config.roadFactor;
  const pooledDistanceKm = distanceRoadKm + returnKm;
  const soloDistanceKm = orders.reduce((sum, order) => sum + 2 * haversineKm(warehouseLocation, order.location) * config.roadFactor, 0);
  const pooledCost = pooledDistanceKm * config.costPerKm + orders.length * config.costPerStop;
  const soloCost = soloDistanceKm * config.costPerKm + orders.length * config.costPerStop;
  const savingAmount = soloCost - pooledCost;
  const savingPercent = soloCost > 0 ? (savingAmount / soloCost) * 100 : 0;
  const soloMinutes = orders.reduce((sum, order) => sum + ((2 * haversineKm(warehouseLocation, order.location) * config.roadFactor) / config.averageSpeedKmph) * 60 + config.serviceMinutesPerStop, 0);
  const soloDistanceByOrder = orders.map((order) => 2 * haversineKm(warehouseLocation, order.location) * config.roadFactor);
  const soloDistanceTotal = soloDistanceByOrder.reduce((sum, value) => sum + value, 0);
  const shopWiseSavings = orders.map((order, index) => {
    const soloDistance = soloDistanceByOrder[index];
    const allocatedPooledDistance = soloDistanceTotal > 0 ? pooledDistanceKm * soloDistance / soloDistanceTotal : pooledDistanceKm / orders.length;
    const soloCostForShop = soloDistance * config.costPerKm + config.costPerStop;
    const pooledCostAllocated = allocatedPooledDistance * config.costPerKm + config.costPerStop;
    const saving = soloCostForShop - pooledCostAllocated;
    return {
      orderId: String(order._id),
      shopId: order.shop?._id ? String(order.shop._id) : String(order.shop),
      shopName: order.shop?.name || order.customerName || "Shop",
      soloCost: round(soloCostForShop, 2),
      pooledCostAllocated: round(pooledCostAllocated, 2),
      savings: round(saving, 2),
      savingsPercent: soloCostForShop > 0 ? round((saving / soloCostForShop) * 100, 2) : 0,
      allocationMethod: "proportional-to-solo-distance",
    };
  });
  const window = commonSlotWindow(orders);
  return {
    route,
    metrics: {
      orderCount: orders.length,
      pooled: {
        distanceKm: round(pooledDistanceKm, 2),
        returnToWarehouseDistanceKm: round(returnKm, 2),
        estimatedMinutes: Math.round(elapsedMinutes + (returnKm / config.averageSpeedKmph) * 60),
        cost: round(pooledCost, 2),
      },
      solo: {
        totalDistanceKm: round(soloDistanceKm, 2),
        totalEstimatedMinutes: Math.round(soloMinutes),
        totalCost: round(soloCost, 2),
      },
      savings: {
        distanceKm: round(soloDistanceKm - pooledDistanceKm, 2),
        amount: round(savingAmount, 2),
        percent: round(savingPercent, 2),
        currency: "INR",
        shopWise: shopWiseSavings,
      },
      shopWiseSavings,
      deliverySlot: window ? { start: window.start, end: window.end } : null,
      slotFeasible: window ? (elapsedMinutes <= (window.end - window.start) / 60000) : false,
      assumptions: {
        roadFactor: config.roadFactor,
        costPerKm: config.costPerKm,
        costPerStop: config.costPerStop,
        averageSpeedKmph: config.averageSpeedKmph,
        serviceMinutesPerStop: config.serviceMinutesPerStop,
        routingAlgorithm: mlSequence ? "ML stop sequence with locally recomputed distance/cost estimates" : "nearest-neighbour heuristic using straight-line distance adjusted by road factor",
      },
    },
  };
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

module.exports = {
  haversineKm,
  getPlanningConfig,
  commonSlotWindow,
  pointsSpreadKm,
  isPoolCompatible,
  groupCompatibleOrders,
  calculateRoute,
  round,
};
