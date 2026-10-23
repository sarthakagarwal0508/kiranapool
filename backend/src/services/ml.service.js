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
const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

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
          forecasts.push({ forecastDate, scope: "shop", shop: shopId, area: deriveArea(shop), timeSlot: slot.key, slotStart, slotEnd, predictedOrders: round(prediction, 2), confidence: Math.min(0.9, 0.25 + dailyCounts.filter((n) => n > 0).length * 0.15), modelSource: "local-fallback", meta: { algorithm: "four-week same-weekday/time-slot average", sampleDays: dailyCounts.length } });
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

const getMlBaseUrl = (baseUrl = process.env.ML_SERVICE_URL) => {
  if (typeof baseUrl !== "string" || !baseUrl.trim()) {
    throw Object.assign(new Error("ML_SERVICE_URL is not configured"), { code: "ML_NOT_CONFIGURED", statusCode: 503 });
  }
  const normalized = baseUrl.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(normalized);
    if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("Unsupported ML service protocol");
    return normalized;
  } catch (error) {
    throw Object.assign(new Error("ML_SERVICE_URL must be a valid HTTP(S) URL"), { code: "ML_INVALID_URL", statusCode: 503 });
  }
};

const callMlEndpoint = async ({ baseUrl = process.env.ML_SERVICE_URL, path, method = "POST", requestBody, timeoutMs = Number(process.env.ML_SERVICE_TIMEOUT_MS) || 5000 }) => {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//")) {
    throw Object.assign(new Error("ML endpoint path must be a fixed absolute path"), { code: "ML_INVALID_PATH", statusCode: 400 });
  }
  const root = getMlBaseUrl(baseUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(100, Number(timeoutMs) || 5000));
  const headers = { Accept: "application/json" };
  if (requestBody !== undefined) headers["Content-Type"] = "application/json";
  if (process.env.ML_SERVICE_TOKEN) headers.Authorization = `Bearer ${process.env.ML_SERVICE_TOKEN}`;
  try {
    let response;
    try {
      response = await fetch(`${root}${path}`, {
        method,
        headers,
        ...(requestBody !== undefined ? { body: JSON.stringify(requestBody) } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      if (error.name === "AbortError") {
        throw Object.assign(new Error("ML service request timed out"), { code: "ML_TIMEOUT", statusCode: 504 });
      }
      throw Object.assign(new Error("Could not connect to ML service"), { code: "ML_NETWORK_ERROR", statusCode: 502 });
    }
    const raw = await response.text();
    let data = null;
    if (raw) {
      try { data = JSON.parse(raw); } catch { data = { rawText: raw.slice(0, 2000) }; }
    }
    if (!response.ok) {
      const detail = typeof data?.detail === "string" ? data.detail : typeof data?.message === "string" ? data.message : `ML service returned HTTP ${response.status}`;
      throw Object.assign(new Error(detail.slice(0, 300)), { code: "ML_UPSTREAM_ERROR", statusCode: 502, upstreamStatus: response.status });
    }
    return { status: response.status, data };
  } finally {
    clearTimeout(timeout);
  }
};

const callMlForecast = async ({ baseUrl, requestBody, timeoutMs = Number(process.env.ML_SERVICE_TIMEOUT_MS) || 5000 }) => {
  let root = getMlBaseUrl(baseUrl);
  // Accept either the service root or an explicitly configured /forecast URL.
  if (root.endsWith("/forecast")) root = root.slice(0, -"/forecast".length);
  const response = await callMlEndpoint({ baseUrl: root, path: "/forecast", method: "POST", requestBody, timeoutMs });
  const body = response.data;
  const predictions = Array.isArray(body) ? body : body?.forecasts;
  if (!Array.isArray(predictions)) {
    throw Object.assign(new Error("ML service response must be an array or { forecasts: [] }"), { code: "ML_INVALID_RESPONSE", statusCode: 502 });
  }
  return { forecasts: predictions, modelSource: body?.model || body?.modelSource || "fastapi-ml", serviceMeta: body?.meta || {} };
};

module.exports = {
  SLOT_DEFINITIONS,
  getSlotKey,
  deriveArea,
  buildFallbackForecasts,
  callMlEndpoint,
  callMlForecast,
  getMlBaseUrl,
  startOfIstDay,
  addCalendarDays,
  round,
};
