const mongoose = require("mongoose");
const Order = require("../models/Order");
const Plan = require("../models/Plan");
const Warehouse = require("../models/Warehouse");
const Rider = require("../models/Rider");
const {
  getPlanningConfig,
  commonSlotWindow,
  pointsSpreadKm,
  isPoolCompatible,
  groupCompatibleOrders,
  calculateRoute,
  round,
} = require("../services/planning.service");

const warehouseOwnedBy = async (warehouseId, userId, activeOnly = true) => {
  if (!mongoose.isValidObjectId(warehouseId)) return null;
  return Warehouse.findOne({ _id: warehouseId, owner: userId, ...(activeOnly ? { isActive: true } : {}) });
};

const validateOrderIds = (orderIds) => Array.isArray(orderIds) && orderIds.length > 0 && orderIds.every((id) => mongoose.isValidObjectId(id));

const loadEligibleOrders = async ({ warehouseId, orderIds, slotStart, slotEnd }) => {
  let filter = { warehouse: warehouseId, status: "pending", plan: null };
  if (orderIds) filter._id = { $in: orderIds };
  if (slotStart || slotEnd) {
    if (!slotStart || !slotEnd || Number.isNaN(Date.parse(slotStart)) || Number.isNaN(Date.parse(slotEnd)) || new Date(slotEnd) <= new Date(slotStart)) {
      throw Object.assign(new Error("slotStart and slotEnd must be valid dates with end after start"), { statusCode: 400 });
    }
    filter.deliverySlotStart = { $lt: new Date(slotEnd) };
    filter.deliverySlotEnd = { $gt: new Date(slotStart) };
  }
  const orders = await Order.find(filter).populate("shop", "name address area location").sort({ deliverySlotStart: 1, createdAt: 1 });
  if (orderIds && orders.length !== orderIds.length) {
    throw Object.assign(new Error("One or more orders are not pending, are already planned, or do not belong to this warehouse"), { statusCode: 409 });
  }
  return orders;
};

const checkCompatibleOrders = (orders) => {
  if (!orders.length) return "No eligible pending orders found. Orders need a warehouse and delivery time slot.";
  if (!commonSlotWindow(orders)) return "Orders must have overlapping delivery slots.";
  const config = getPlanningConfig();
  if (orders.length > config.maxPoolStops) return `A plan can contain at most ${config.maxPoolStops} stops.`;
  const spread = pointsSpreadKm(orders);
  if (spread > config.maxStopSpreadKm) return `Delivery locations are too spread out (${round(spread, 2)} km apart; limit ${config.maxStopSpreadKm} km). Split them into separate plans.`;
  return null;
};

const savePlanForOrders = async ({ warehouse, orders, userId, name }) => {
  const issue = checkCompatibleOrders(orders);
  if (issue) throw Object.assign(new Error(issue), { statusCode: 400 });
  const routeFeasibility = calculateRoute(warehouse, orders);
  if (!routeFeasibility.metrics.slotFeasible) {
    throw Object.assign(new Error("Estimated route duration does not fit inside the shared delivery slot. Split the orders or choose a longer slot."), { statusCode: 400 });
  }
  const { route, metrics } = routeFeasibility;
  const slot = commonSlotWindow(orders);
  const plan = await Plan.create({
    name: typeof name === "string" && name.trim() ? name.trim() : `Delivery Plan - ${new Date().toISOString().slice(0, 10)}`,
    orders: orders.map((order) => order._id),
    warehouse: warehouse._id,
    createdBy: userId,
    deliverySlotStart: slot.start,
    deliverySlotEnd: slot.end,
    route,
    pooled: metrics.pooled,
    solo: metrics.solo,
    savings: metrics.savings,
    meta: { ...metrics, createdBy: userId, algorithm: "warehouse-time-slot-nearest-neighbour-v1" },
    status: "planned",
  });
  const result = await Order.updateMany(
    { _id: { $in: orders.map((order) => order._id) }, status: "pending", plan: null },
    { $set: { plan: plan._id, status: "planned" } }
  );
  if (result.modifiedCount !== orders.length) {
    await Order.updateMany({ plan: plan._id }, { $set: { status: "pending", plan: null, rider: null } });
    await Plan.findByIdAndDelete(plan._id);
    throw Object.assign(new Error("Some orders changed while the plan was being created. Refresh and retry."), { statusCode: 409 });
  }
  return plan;
};

const previewPlan = async (req, res, next) => {
  try {
    const { warehouseId, orderIds, slotStart, slotEnd } = req.body;
    if (!warehouseId) return res.status(400).json({ success: false, message: "warehouseId is required" });
    const warehouse = await warehouseOwnedBy(warehouseId, req.user.id);
    if (!warehouse) return res.status(404).json({ success: false, message: "Active warehouse not found or not owned by this wholesaler" });
    if (orderIds !== undefined && !validateOrderIds(orderIds)) return res.status(400).json({ success: false, message: "orderIds must be a non-empty array of valid order IDs" });
    const orders = await loadEligibleOrders({ warehouseId: warehouse._id, orderIds, slotStart, slotEnd });
    if (!orders.length) return res.status(200).json({ success: true, message: "No pending orders match these filters", count: 0, data: { orders: [], route: [], metrics: null, groups: [] } });
    if (orderIds) {
      const issue = checkCompatibleOrders(orders);
      if (issue) return res.status(400).json({ success: false, message: issue, details: { orderCount: orders.length, stopSpreadKm: round(pointsSpreadKm(orders), 2), maxStopSpreadKm: getPlanningConfig().maxStopSpreadKm } });
      const { route, metrics } = calculateRoute(warehouse, orders);
      return res.status(200).json({ success: true, count: orders.length, data: { warehouse, orders, route, metrics } });
    }
    const groups = groupCompatibleOrders(orders).map((group, index) => {
      const { route, metrics } = calculateRoute(warehouse, group);
      return { groupNumber: index + 1, orderCount: group.length, orders: group, route, metrics };
    });
    return res.status(200).json({ success: true, count: orders.length, data: { warehouse, groups, groupCount: groups.length, message: "Pending orders grouped by overlapping delivery slot and location compatibility; preview does not change order status" } });
  } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error); }
};

const createPlan = async (req, res, next) => {
  try {
    const { warehouseId, orderIds, name } = req.body;
    if (!warehouseId || !validateOrderIds(orderIds)) return res.status(400).json({ success: false, message: "warehouseId and a non-empty orderIds array are required" });
    const warehouse = await warehouseOwnedBy(warehouseId, req.user.id);
    if (!warehouse) return res.status(404).json({ success: false, message: "Active warehouse not found or not owned by this wholesaler" });
    const orders = await loadEligibleOrders({ warehouseId: warehouse._id, orderIds });
    const plan = await savePlanForOrders({ warehouse, orders, userId: req.user.id, name });
    return res.status(201).json({ success: true, message: "Delivery plan created; selected orders are now planned", data: await Plan.findById(plan._id).populate("warehouse").populate("orders") });
  } catch (error) { if (error.statusCode) return res.status(error.statusCode).json({ success: false, message: error.message }); next(error); }
};

const autoPoolOrders = async (req, res, next) => {
  try {
    const warehouseFilter = { owner: req.user.id, isActive: true };
    if (req.body.warehouseId) {
      if (!mongoose.isValidObjectId(req.body.warehouseId)) return res.status(400).json({ success: false, message: "Invalid warehouseId" });
      warehouseFilter._id = req.body.warehouseId;
    }
    const warehouses = await Warehouse.find(warehouseFilter);
    if (!warehouses.length) return res.status(404).json({ success: false, message: "No active warehouses found for this wholesaler" });
    const byId = new Map(warehouses.map((warehouse) => [String(warehouse._id), warehouse]));
    const orders = await Order.find({ warehouse: { $in: warehouses.map((w) => w._id) }, status: "pending", plan: null, deliverySlotStart: { $ne: null }, deliverySlotEnd: { $ne: null } })
      .populate("shop", "name address area location")
      .sort({ deliverySlotStart: 1, createdAt: 1 });
    const groups = groupCompatibleOrders(orders);
    const plannedIds = new Set();
    const createdPlans = [];
    for (const group of groups) {
      if (!group.length) continue;
      const warehouseId = String(group[0].warehouse);
      const warehouse = byId.get(warehouseId);
      if (!warehouse || group.some((order) => plannedIds.has(String(order._id)))) continue;
      const stillPending = await Order.find({ _id: { $in: group.map((o) => o._id) }, status: "pending", plan: null }).populate("shop", "name address area location");
      if (!stillPending.length) continue;
      try {
        const plan = await savePlanForOrders({ warehouse, orders: stillPending, userId: req.user.id });
        createdPlans.push(plan);
        stillPending.forEach((order) => plannedIds.add(String(order._id)));
      } catch (error) {
        // A single geographically incompatible cluster should not block other clusters.
        if (error.statusCode !== 400 && error.statusCode !== 409) throw error;
      }
    }
    return res.status(201).json({
      success: true,
      message: createdPlans.length ? "Auto-pooling completed" : "No eligible orders could be pooled",
      plansCreated: createdPlans.length,
      ordersPlanned: createdPlans.reduce((sum, plan) => sum + plan.orders.length, 0),
      data: await Plan.find({ _id: { $in: createdPlans.map((plan) => plan._id) } }).populate("warehouse", "name address").sort({ createdAt: -1 }),
      unplannedOrderCount: orders.length - createdPlans.reduce((sum, plan) => sum + plan.orders.length, 0),
      config: getPlanningConfig(),
    });
  } catch (error) { next(error); }
};

const getPlans = async (req, res, next) => {
  try {
    let filter = {};
    if (req.user.role === "wholesaler") {
      const warehouses = await Warehouse.find({ owner: req.user.id }).select("_id");
      filter.warehouse = { $in: warehouses.map((w) => w._id) };
    } else if (req.user.role === "rider") {
      const rider = await Rider.findOne({ user: req.user.id }).select("_id");
      if (!rider) return res.status(200).json({ success: true, count: 0, data: [] });
      filter.rider = rider._id;
    } else {
      return res.status(403).json({ success: false, message: "Only wholesalers and assigned riders can view delivery plans" });
    }
    if (req.query.status) filter.status = req.query.status;
    const plans = await Plan.find(filter).populate("warehouse", "name address location").populate("rider", "name phone vehicleType").populate("orders", "shop status location deliverySlotStart deliverySlotEnd totalAmount").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: plans.length, data: plans });
  } catch (error) { next(error); }
};

const getLatestPlan = async (req, res, next) => {
  try {
    let filter;
    if (req.user.role === "wholesaler") {
      filter = { warehouse: { $in: await Warehouse.find({ owner: req.user.id }).distinct("_id") } };
    } else if (req.user.role === "rider") {
      const rider = await Rider.findOne({ user: req.user.id }).select("_id");
      if (!rider) return res.status(404).json({ success: false, message: "Rider profile not found" });
      filter = { rider: rider._id };
    } else return res.status(403).json({ success: false, message: "Only wholesalers and assigned riders can view delivery plans" });
    const plan = await Plan.findOne(filter).sort({ createdAt: -1 }).populate("warehouse", "name address location").populate("rider", "name phone vehicleType").populate("orders", "shop status location deliverySlotStart deliverySlotEnd totalAmount");
    if (!plan) return res.status(404).json({ success: false, message: "No delivery plan found" });
    return res.status(200).json({ success: true, data: plan });
  } catch (error) { next(error); }
};

const getPlanById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid plan ID" });
    const plan = await Plan.findById(id).populate("warehouse", "name address location owner").populate("rider", "name phone vehicleType").populate("orders", "shop customerName deliveryAddress location status totalAmount deliverySlotStart deliverySlotEnd");
    if (!plan) return res.status(404).json({ success: false, message: "Delivery plan not found" });
    if (req.user.role === "wholesaler" && String(plan.warehouse?.owner) !== req.user.id) return res.status(404).json({ success: false, message: "Delivery plan not found" });
    if (req.user.role === "rider") {
      const rider = await Rider.findOne({ user: req.user.id }).select("_id");
      if (!rider || String(plan.rider?._id || plan.rider) !== String(rider._id)) return res.status(404).json({ success: false, message: "Delivery plan not found" });
    }
    if (req.user.role === "shopkeeper") return res.status(403).json({ success: false, message: "Shopkeepers cannot access wholesaler delivery plans" });
    return res.status(200).json({ success: true, data: plan });
  } catch (error) { next(error); }
};

const assignRider = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { riderId } = req.body;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(riderId)) return res.status(400).json({ success: false, message: "Valid plan ID and riderId are required" });
    const plan = await Plan.findById(id).populate("warehouse", "owner");
    if (!plan || !plan.warehouse || String(plan.warehouse.owner) !== req.user.id) return res.status(404).json({ success: false, message: "Plan not found or not owned by this wholesaler" });
    if (plan.status !== "planned") return res.status(400).json({ success: false, message: "Only planned deliveries can be assigned" });
    const deliveryStarted = await Order.exists({ plan: plan._id, status: { $in: ["picked", "delivered"] } });
    if (deliveryStarted) return res.status(409).json({ success: false, message: "Rider cannot be changed after delivery has started" });
    const plannedOrderCount = await Order.countDocuments({ _id: { $in: plan.orders }, plan: plan._id, status: "planned" });
    if (plannedOrderCount !== plan.orders.length) return res.status(409).json({ success: false, message: "Every order in the plan must still be planned before rider assignment" });
    const rider = await Rider.findById(riderId);
    if (!rider) return res.status(404).json({ success: false, message: "Rider profile not found" });
    if (String(plan.rider || "") === String(rider._id)) {
      const alreadyAssigned = await Order.countDocuments({ plan: plan._id, rider: rider._id, status: "planned" });
      if (alreadyAssigned === plan.orders.length) {
        return res.status(200).json({ success: true, message: "Rider is already assigned to this plan", data: await Plan.findById(plan._id).populate("warehouse", "name address").populate("rider", "name phone vehicleType") });
      }
    }
    if (!rider.isAvailable && String(plan.rider || "") !== String(rider._id)) return res.status(409).json({ success: false, message: "Rider is not available" });
    const activePlan = await Plan.findOne({ rider: rider._id, status: "planned", _id: { $ne: plan._id } });
    if (activePlan) return res.status(409).json({ success: false, message: "This rider already has an active delivery plan" });
    if (plan.rider && String(plan.rider) !== String(rider._id)) await Rider.findByIdAndUpdate(plan.rider, { isAvailable: true });
    plan.rider = rider._id;
    await plan.save();
    const updateResult = await Order.updateMany({ _id: { $in: plan.orders }, plan: plan._id, status: "planned" }, { $set: { rider: rider._id } });
    if (updateResult.matchedCount !== plan.orders.length) {
      return res.status(409).json({ success: false, message: "Plan orders changed while assigning the rider; refresh and retry" });
    }
    rider.isAvailable = false;
    await rider.save();
    const populated = await Plan.findById(plan._id).populate("warehouse", "name address").populate("rider", "name phone vehicleType").populate("orders", "shop status location deliveryAddress");
    return res.status(200).json({ success: true, message: "Rider assigned to delivery plan", data: populated });
  } catch (error) { next(error); }
};

const cancelPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid plan ID" });
    const plan = await Plan.findById(id).populate("warehouse", "owner");
    if (!plan || !plan.warehouse || String(plan.warehouse.owner) !== req.user.id) return res.status(404).json({ success: false, message: "Plan not found or not owned by this wholesaler" });
    if (plan.status !== "planned") return res.status(400).json({ success: false, message: "Only planned deliveries can be cancelled" });
    const picked = await Order.countDocuments({ plan: plan._id, status: "picked" });
    const delivered = await Order.countDocuments({ plan: plan._id, status: "delivered" });
    if (picked || delivered) return res.status(409).json({ success: false, message: "A plan cannot be cancelled after a rider has started delivering it" });
    await Order.updateMany({ plan: plan._id, status: "planned" }, { $set: { status: "pending", plan: null, rider: null } });
    if (plan.rider) await Rider.findByIdAndUpdate(plan.rider, { isAvailable: true });
    plan.status = "cancelled";
    await plan.save();
    return res.status(200).json({ success: true, message: "Plan cancelled; orders returned to pending", data: plan });
  } catch (error) { next(error); }
};

module.exports = { previewPlan, createPlan, autoPoolOrders, getPlans, getLatestPlan, getPlanById, assignRider, cancelPlan };
