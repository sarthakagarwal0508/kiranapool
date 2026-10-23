const SLOT_DEFINITIONS = [
  { key: "morning", startHour: 8, endHour: 12 },
  { key: "afternoon", startHour: 12, endHour: 17 },
  { key: "evening", startHour: 17, endHour: 21 },
];
const IST_OFFSET_MS = 330 * 60 * 1000;

const istParts = (value) => {
  const shifted = new Date(new Date(value).getTime() + IST_OFFSET_MS);
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate(), weekday: shifted.getUTCDay(), hour: shifted.getUTCHours() };
};

const getSlotKey = (dateValue) => {
  const hour = istParts(dateValue).hour;
  if (hour >= 8 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  return "evening";
};

const deriveArea = (shop) => {
  if (typeof shop?.area === "string" && shop.area.trim()) return shop.area.trim();
  const firstAddressPart = String(shop?.address || "Unknown Area").split(",")[0].trim();
  return firstAddressPart || "Unknown Area";
};

const dateKey = (value) => {
  const p = istParts(value);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
};

const startOfIstDay = (value) => {
  const p = istParts(value);
  return new Date(Date.UTC(p.year, p.month, p.day) - IST_OFFSET_MS);
};

const addCalendarDays = (value, days) => new Date(startOfIstDay(value).getTime() + days * 86400000);

const buildFallbackForecasts = ({ orders, shops, horizonDays, groupBy = "both", now = new Date() }) => {
  const start = startOfIstDay(now);
  const cutoff = new Date(start.getTime() - 28 * 86400000);
  const shopMap = new Map((shops || []).map((shop) => [String(shop._id), shop]));
  const records = orders.map((order) => {
    const shopId = order.shop?._id ? String(order.shop._id) : String(order.shop || "");
    const shop = order.shop && order.shop.name ? order.shop : shopMap.get(shopId);
    const when = order.deliverySlotStart || order.createdAt;
    return { order, shopId, shop, area: deriveArea(shop), when: new Date(when), key: getSlotKey(when), date: dateKey(when), weekday: istParts(when).weekday };
  }).filter((item) => item.shopId && item.when && !Number.isNaN(item.when.getTime()) && item.when >= cutoff && item.when < start);

  const shopIds = new Set(records.map((item) => item.shopId));
  (shops || []).forEach((shop) => shopIds.add(String(shop._id)));
  const shopList = [...shopIds].map((id) => ({ id, shop: shopMap.get(id) || records.find((r) => r.shopId === id)?.shop })).filter((item) => item.shop);
  const historicalCount = (predicate) => records.filter(predicate).length;
  const forecasts = [];

  for (let day = 0; day < horizonDays; day += 1) {
    const forecastDate = addCalendarDays(start, day);
    const weekday = istParts(forecastDate).weekday;
    for (const slot of SLOT_DEFINITIONS) {
      const slotStart = new Date(forecastDate.getTime() + slot.startHour * 3600000);
      const slotEnd = new Date(forecastDate.getTime() + slot.endHour * 3600000);
      const perShopPredictions = [];
      if (groupBy !== "area") {
        for (const { id: shopId, shop } of shopList) {
          const sampleDates = [];
          for (let ago = 1; ago <= 28; ago += 1) {
            const candidateDate = new Date(start.getTime() - ago * 86400000);
            if (istParts(candidateDate).weekday === weekday) sampleDates.push(dateKey(candidateDate));
          }
          const dailyCounts = sampleDates.map((date) => historicalCount((r) => r.date === date && r.key === slot.key && r.shopId === shopId));
          const prediction = dailyCounts.length ? dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length : 0;
          perShopPredictions.push({ shopId, shop, area: deriveArea(shop), predictedOrders: round(prediction, 2), confidence: Math.min(0.9, 0.25 + dailyCounts.filter((n) => n > 0).length * 0.15), sampleDays: dailyCounts.length });
          if (groupBy !== "area") {
            forecasts.push({ forecastDate, scope: "shop", shop: shopId, area: deriveArea(shop), timeSlot: slot.key, slotStart, slotEnd, predictedOrders: round(prediction, 2), confidence: Math.min(0.9, 0.25 + dailyCounts.filter((n) => n > 0).length * 0.15), modelSource: "local-fallback", meta: { algorithm: "four-week same-weekday/time-slot average", sampleDays: dailyCounts.length } });
          }
        }
      }
      if (groupBy !== "shop") {
        const areaNames = new Set(perShopPredictions.map((x) => x.area));
        if (!areaNames.size) records.forEach((r) => areaNames.add(r.area));
        for (const area of areaNames) {
          const areaShopIds = new Set(shopList.filter((x) => deriveArea(x.shop) === area).map((x) => x.id));
          const sampleDates = [];
          for (let ago = 1; ago <= 28; ago += 1) {
            const candidateDate = new Date(start.getTime() - ago * 86400000);
            if (istParts(candidateDate).weekday === weekday) sampleDates.push(dateKey(candidateDate));
          }
          const dailyCounts = sampleDates.map((date) => historicalCount((r) => r.date === date && r.key === slot.key && r.area === area));
          const prediction = dailyCounts.length ? dailyCounts.reduce((a, b) => a + b, 0) / dailyCounts.length : 0;
          forecasts.push({ forecastDate, scope: "area", shop: null, area, timeSlot: slot.key, slotStart, slotEnd, predictedOrders: round(prediction, 2), confidence: Math.min(0.9, 0.25 + dailyCounts.filter((n) => n > 0).length * 0.15), modelSource: "local-fallback", meta: { algorithm: "four-week same-weekday/time-slot average by area", sampleDays: dailyCounts.length, shopCount: areaShopIds.size } });
        }
      }
    }
  }
  return forecasts;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

const callMlForecast = async ({ baseUrl, requestBody, timeoutMs = 5000 }) => {
  if (!baseUrl) throw new Error("ML_SERVICE_URL is not configured");
  const url = baseUrl.replace(/\/+$/, "");
  const endpoint = url.endsWith("/forecast") ? url : `${url}/forecast`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(process.env.ML_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.ML_SERVICE_TOKEN}` } : {}) },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`ML service returned HTTP ${response.status}`);
    const predictions = Array.isArray(body) ? body : body.forecasts;
    if (!Array.isArray(predictions)) throw new Error("ML service response must be an array or { forecasts: [] }");
    return { forecasts: predictions, modelSource: body.model || body.modelSource || "fastapi", serviceMeta: body.meta || {} };
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = { SLOT_DEFINITIONS, getSlotKey, deriveArea, buildFallbackForecasts, callMlForecast, startOfIstDay, addCalendarDays, round };
