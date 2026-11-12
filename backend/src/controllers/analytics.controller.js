const mongoose = require("mongoose");
const Order = require("../models/Order");
const Shop = require("../models/Shop");
const Rider = require("../models/Rider");
const Plan = require("../models/Plan");
const Warehouse = require("../models/Warehouse");

const STATUS_VALUES = ["pending", "planned", "picked", "delivered", "cancelled"];

const parsePeriod = (query) => {
  const match = {};
  if (query.from) {
    const from = new Date(query.from);
    if (Number.isNaN(from.getTime())) return { error: "from must be a valid date" };
    match.$gte = from;
  }
  if (query.to) {
    const to = new Date(query.to);
    if (Number.isNaN(to.getTime())) return { error: "to must be a valid date" };
    // Date-only `to` values are inclusive for the whole calendar day.
    if (typeof query.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(query.to)) to.setUTCHours(23, 59, 59, 999);
    match.$lte = to;
  }
  if (match.$gte && match.$lte && match.$gte > match.$lte) return { error: "from must be on or before to" };
  return { match: Object.keys(match).length ? match : null };
};

const summarizeOrders = async (filter) => {
  const [summary] = await Order.aggregate([
    { $match: filter },
    { $group: {
      _id: null,
      totalOrders: { $sum: 1 },
      grossOrderValue: { $sum: "$totalAmount" },
      pending: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },
      planned: { $sum: { $cond: [{ $eq: ["$status", "planned"] }, 1, 0] } },
      picked: { $sum: { $cond: [{ $eq: ["$status", "picked"] }, 1, 0] } },
      delivered: { $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] } },
      cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } },
    } },
  ]);
  return summary || { totalOrders: 0, grossOrderValue: 0, pending: 0, planned: 0, picked: 0, delivered: 0, cancelled: 0 };
};

const getOverview = async (req, res, next) => {
  try {
    const period = parsePeriod(req.query || {});
    if (period.error) return res.status(400).json({ success: false, message: period.error });
    const orderFilter = {};
    if (period.match) orderFilter.createdAt = period.match;

    let extras = {};
    if (req.user.role === "wholesaler") {
      const warehouseIds = await Warehouse.find({ owner: req.user.id }).distinct("_id");
      orderFilter.warehouse = { $in: warehouseIds };
      const planFilter = { warehouse: { $in: warehouseIds }, status: "planned", ...(period.match ? { createdAt: period.match } : {}) };
      const pooledPlanFilter = { warehouse: { $in: warehouseIds }, status: { $in: ["planned", "completed"] }, ...(period.match ? { createdAt: period.match } : {}) };
      const [plans, availableRiders, pooled] = await Promise.all([
        Plan.countDocuments(planFilter),
        Rider.countDocuments({ isAvailable: true, $or: [{ managedBy: req.user.id }, { managedBy: null }] }),
        Plan.aggregate([
          { $match: pooledPlanFilter },
          { $group: { _id: null, pooledCost: { $sum: { $ifNull: ["$pooled.cost", 0] } }, savings: { $sum: { $ifNull: ["$savings.amount", 0] } } } },
        ]),
      ]);
      extras = { activePlans: plans, availableRiders, pooledCost: pooled[0]?.pooledCost || 0, estimatedSavings: pooled[0]?.savings || 0 };
    } else if (req.user.role === "shopkeeper") {
      const shopIds = await Shop.find({ owner: req.user.id }).distinct("_id");
      orderFilter.shop = { $in: shopIds };
      extras = { shops: shopIds.length };
    } else if (req.user.role === "rider") {
      const rider = await Rider.findOne({ user: req.user.id }).select("_id location locationUpdatedAt isAvailable");
      if (!rider) return res.status(200).json({ success: true, data: { totalOrders: 0, grossOrderValue: 0, pending: 0, planned: 0, picked: 0, delivered: 0, cancelled: 0, activePlans: 0, rider: null } });
      orderFilter.rider = rider._id;
      const activePlans = await Plan.countDocuments({ rider: rider._id, status: "planned" });
      extras = { activePlans, rider: { isAvailable: rider.isAvailable, location: rider.location, locationUpdatedAt: rider.locationUpdatedAt } };
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    const summary = await summarizeOrders(orderFilter);
    delete summary._id;
    return res.status(200).json({
      success: true,
      generatedAt: new Date().toISOString(),
      period: { from: req.query.from || null, to: req.query.to || null },
      data: { ...summary, ...extras, completionRate: summary.totalOrders ? Number(((summary.delivered / summary.totalOrders) * 100).toFixed(2)) : 0 },
    });
  } catch (error) {
    if (error instanceof mongoose.Error) return res.status(400).json({ success: false, message: "Invalid analytics query" });
    return next(error);
  }
};

module.exports = { getOverview, STATUS_VALUES };
