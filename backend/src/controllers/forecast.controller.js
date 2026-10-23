const mongoose = require("mongoose");
const Forecast = require("../models/Forecast");
const Order = require("../models/Order");
const Warehouse = require("../models/Warehouse");
const Shop = require("../models/Shop");
const { SLOT_DEFINITIONS, deriveArea, buildFallbackForecasts, callMlForecast, startOfIstDay } = require("../services/ml.service");

const generateForecasts = async (req, res, next) => {
  try {
    const horizonDays = Number(req.body.horizonDays ?? 7);
    const groupBy = req.body.groupBy || "both";
    if (!Number.isInteger(horizonDays) || horizonDays < 1 || horizonDays > 30) {
      return res.status(400).json({ success: false, message: "horizonDays must be an integer from 1 to 30" });
    }
    if (!["both", "shop", "area"].includes(groupBy)) {
      return res.status(400).json({ success: false, message: "groupBy must be both, shop or area" });
    }
    const warehouses = await Warehouse.find({ owner: req.user.id, isActive: true }).select("_id");
    if (!warehouses.length) return res.status(400).json({ success: false, message: "Create an active warehouse and receive supply orders before generating forecasts" });
    const warehouseIds = warehouses.map((w) => w._id);
    const history = await Order.find({ warehouse: { $in: warehouseIds }, deliverySlotStart: { $ne: null } })
      .populate("shop", "name address area location")
      .sort({ deliverySlotStart: -1 })
      .limit(5000);
    const shopIds = [...new Set(history.map((order) => String(order.shop?._id || order.shop)).filter(Boolean))];
    const shops = shopIds.length ? await Shop.find({ _id: { $in: shopIds } }) : [];
    if (!shops.length) return res.status(400).json({ success: false, message: "No shop orders found for these warehouses yet" });

    const historyPayload = history.map((order) => ({
      orderId: String(order._id), shopId: String(order.shop?._id || order.shop), shopName: order.shop?.name || "",
      area: deriveArea(order.shop), orderDate: order.createdAt, deliverySlotStart: order.deliverySlotStart,
      deliverySlotEnd: order.deliverySlotEnd, status: order.status, totalAmount: order.totalAmount,
      warehouseId: String(order.warehouse), itemsCount: (order.items || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
    }));
    const requestBody = { horizonDays, groupBy, timezone: "Asia/Kolkata", slots: SLOT_DEFINITIONS, history: historyPayload, shops: shops.map((shop) => ({ shopId: String(shop._id), name: shop.name, area: deriveArea(shop), location: shop.location })) };
    const allowedShopIds = new Set(shops.map((shop) => String(shop._id)));

    let forecasts;
    let modelSource = "local-fallback";
    let integrationWarning = null;
    if (process.env.ML_SERVICE_URL) {
      try {
        const mlResult = await callMlForecast({ baseUrl: process.env.ML_SERVICE_URL, requestBody, timeoutMs: Number(process.env.ML_SERVICE_TIMEOUT_MS) || 5000 });
        modelSource = mlResult.modelSource;
        forecasts = mlResult.forecasts.map((item) => {
          const shopId = item.shop || item.shopId || null;
          const rawDate = item.forecastDate || item.date;
          const forecastDate = rawDate ? startOfIstDay(rawDate) : null;
          const timeSlot = item.timeSlot || item.slot;
          const scope = item.scope;
          const predictedOrders = Number(item.predictedOrders ?? item.prediction ?? item.count);
          if (!forecastDate || Number.isNaN(forecastDate.getTime()) || !["morning", "afternoon", "evening"].includes(timeSlot) || !["shop", "area"].includes(scope) || !Number.isFinite(predictedOrders) || predictedOrders < 0) return null;
          if (scope === "shop" && (!shopId || !mongoose.isValidObjectId(shopId) || !allowedShopIds.has(String(shopId)))) return null;
          const slotStart = item.slotStart ? new Date(item.slotStart) : null;
          const slotEnd = item.slotEnd ? new Date(item.slotEnd) : null;
          if ((slotStart && Number.isNaN(slotStart.getTime())) || (slotEnd && Number.isNaN(slotEnd.getTime()))) return null;
          return { forecastDate, scope, shop: scope === "area" ? null : shopId, area: String(item.area || (shopId ? deriveArea(shops.find((s) => String(s._id) === String(shopId))) : "Unknown Area")), timeSlot, slotStart, slotEnd, predictedOrders, confidence: item.confidence == null ? null : (Number.isFinite(Number(item.confidence)) ? Math.max(0, Math.min(1, Number(item.confidence))) : null), modelSource, meta: item.meta || { integration: "FastAPI" } };
        }).filter(Boolean);
        if (!forecasts.length) throw new Error("ML service returned no valid forecast rows");
      } catch (error) {
        if (process.env.ML_FALLBACK_ENABLED === "false") throw error;
        integrationWarning = `ML service unavailable or invalid response; local fallback used (${error.message})`;
      }
    }
    if (!forecasts) {
      forecasts = buildFallbackForecasts({ orders: history, shops, horizonDays, groupBy });
      modelSource = "local-fallback";
      forecasts = forecasts.map((item) => ({ ...item, wholesaler: req.user.id, modelSource }));
    } else {
      forecasts = forecasts.filter((item) => groupBy === "both" || item.scope === groupBy).map((item) => ({ ...item, wholesaler: req.user.id, modelSource }));
    }
    if (!forecasts.length) return res.status(502).json({ success: false, message: "No forecasts were produced by the configured forecasting path" });

    const nowStart = startOfIstDay(new Date());
    const stop = new Date(nowStart.getTime() + horizonDays * 86400000);
    forecasts = forecasts.filter((item) => item.forecastDate && !Number.isNaN(new Date(item.forecastDate).getTime()) && new Date(item.forecastDate) >= nowStart && new Date(item.forecastDate) < stop);
    if (!forecasts.length) return res.status(502).json({ success: false, message: "No valid forecast dates were produced inside the requested horizon" });
    const writes = forecasts.map((item) => {
      const forecastDate = startOfIstDay(item.forecastDate);
      const filter = { wholesaler: req.user.id, forecastDate, scope: item.scope, shop: item.shop || null, area: item.scope === "area" ? item.area : (item.area || ""), timeSlot: item.timeSlot };
      return { updateOne: { filter, update: { $set: { ...item, forecastDate, wholesaler: req.user.id }, $setOnInsert: { actualOrders: null } }, upsert: true } };
    });
    await Forecast.bulkWrite(writes, { ordered: false });
    const saved = await Forecast.find({ wholesaler: req.user.id, forecastDate: { $gte: nowStart, $lt: stop } }).populate("shop", "name address area").sort({ forecastDate: 1, scope: 1, area: 1, timeSlot: 1 });
    return res.status(200).json({ success: true, message: "Demand forecasts generated", modelSource, ...(integrationWarning ? { warning: integrationWarning } : {}), count: saved.length, horizonDays, groupBy, data: saved });
  } catch (error) { next(error); }
};

const getForecasts = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role === "wholesaler") filter.wholesaler = req.user.id;
    else if (req.user.role === "shopkeeper") {
      const shops = await Shop.find({ owner: req.user.id }).select("_id");
      filter = { scope: "shop", shop: { $in: shops.map((shop) => shop._id) } };
    } else return res.status(403).json({ success: false, message: "Riders cannot access demand forecasts" });

    if (req.query.scope) {
      if (!["shop", "area"].includes(req.query.scope)) return res.status(400).json({ success: false, message: "scope must be shop or area" });
      filter.scope = req.query.scope;
    }
    if (req.query.area) filter.area = String(req.query.area).trim();
    if (req.query.shopId) {
      if (!mongoose.isValidObjectId(req.query.shopId)) return res.status(400).json({ success: false, message: "Invalid shopId" });
      if (req.user.role === "shopkeeper" && !(await Shop.exists({ _id: req.query.shopId, owner: req.user.id }))) return res.status(404).json({ success: false, message: "Shop not found" });
      filter.shop = req.query.shopId;
    }
    if (req.query.from || req.query.to) {
      filter.forecastDate = {};
      if (req.query.from) {
        if (Number.isNaN(Date.parse(req.query.from))) return res.status(400).json({ success: false, message: "from must be a valid date" });
        filter.forecastDate.$gte = startOfIstDay(req.query.from);
      }
      if (req.query.to) {
        if (Number.isNaN(Date.parse(req.query.to))) return res.status(400).json({ success: false, message: "to must be a valid date" });
        filter.forecastDate.$lte = startOfIstDay(req.query.to);
      }
      if (filter.forecastDate.$gte && filter.forecastDate.$lte && filter.forecastDate.$gte > filter.forecastDate.$lte) return res.status(400).json({ success: false, message: "from must be on or before to" });
    }
    const forecasts = await Forecast.find(filter).populate("shop", "name address area").sort({ forecastDate: 1, scope: 1, area: 1, timeSlot: 1 }).limit(2000);
    return res.status(200).json({ success: true, count: forecasts.length, data: forecasts });
  } catch (error) { next(error); }
};

const getForecastSummary = async (req, res, next) => {
  try {
    if (req.user.role !== "wholesaler") return res.status(403).json({ success: false, message: "Only wholesalers can access supplier forecast analytics" });
    const match = { wholesaler: new mongoose.Types.ObjectId(req.user.id) };
    const summary = await Forecast.aggregate([
      { $match: match },
      { $group: { _id: { scope: "$scope", timeSlot: "$timeSlot", area: "$area" }, forecastRows: { $sum: 1 }, predictedOrders: { $sum: "$predictedOrders" }, actualOrders: { $sum: { $ifNull: ["$actualOrders", 0] } }, rowsWithActuals: { $sum: { $cond: [{ $ne: ["$actualOrders", null] }, 1, 0] } } } },
      { $sort: { "_id.scope": 1, "_id.area": 1, "_id.timeSlot": 1 } },
    ]);
    return res.status(200).json({ success: true, data: summary });
  } catch (error) { next(error); }
};

const recordActual = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actualOrders = req.body.actualOrders;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid forecast ID" });
    if (!Number.isFinite(actualOrders) || actualOrders < 0) return res.status(400).json({ success: false, message: "actualOrders must be a non-negative number" });
    const forecast = await Forecast.findOneAndUpdate({ _id: id, wholesaler: req.user.id }, { $set: { actualOrders } }, { new: true, runValidators: true }).populate("shop", "name address area");
    if (!forecast) return res.status(404).json({ success: false, message: "Forecast not found" });
    return res.status(200).json({ success: true, message: "Actual demand recorded", data: forecast });
  } catch (error) { next(error); }
};

module.exports = { generateForecasts, getForecasts, getForecastSummary, recordActual };
