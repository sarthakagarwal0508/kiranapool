const Shop = require("../models/Shop");
const Rider = require("../models/Rider");
const Warehouse = require("../models/Warehouse");
const Order = require("../models/Order");
const Plan = require("../models/Plan");

// GET /api/map/overview
// Role-scoped map payload for the dashboard. Coordinates already stored by the app are reused.
const getMapOverview = async (req, res, next) => {
  try {
    const role = req.user.role;
    const data = { role, warehouses: [], shops: [], riders: [], plans: [], orders: [] };

    if (role === "wholesaler") {
      const warehouses = await Warehouse.find({ owner: req.user.id, isActive: true }).select("name address location serviceAreas").lean();
      const warehouseIds = warehouses.map((w) => w._id);
      const areas = [...new Set(warehouses.flatMap((w) => w.serviceAreas || []).map((a) => String(a).trim()).filter(Boolean))];
      const unrestricted = warehouses.some((w) => !(w.serviceAreas || []).length);
      const shopFilter = !areas.length && !unrestricted
        ? { _id: { $exists: false } }
        : unrestricted
          ? { isActive: true }
          : { isActive: true, $or: [
              ...areas.map((area) => ({ area: new RegExp(`^${area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") })),
              ...areas.map((area) => ({ address: new RegExp(area.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") })),
            ] };
      const [shops, plans, orders] = await Promise.all([
        Shop.find(shopFilter).select("name address area location isActive").lean(),
        Plan.find({ warehouse: { $in: warehouseIds }, status: { $in: ["planned", "completed"] } })
          .select("name warehouse rider route orders status deliverySlotStart deliverySlotEnd pooled solo savings meta createdAt")
          .populate("warehouse", "name address location")
          .populate("rider", "name vehicleType location isAvailable locationUpdatedAt")
          .populate({ path: "orders", select: "shop customerName deliveryAddress location status totalAmount", populate: { path: "shop", select: "name address area location" } })
          .sort({ createdAt: -1 }).limit(50).lean(),
        Order.find({ warehouse: { $in: warehouseIds }, status: { $in: ["pending", "planned", "picked"] } })
          .select("shop customerName deliveryAddress location status totalAmount rider plan warehouse deliverySlotStart deliverySlotEnd")
          .populate("shop", "name address area location")
          .populate("rider", "name location")
          .lean(),
      ]);
      const assignedRiderIds = [...new Set([
        ...plans.map((plan) => plan.rider?._id || plan.rider).filter(Boolean).map(String),
        ...orders.map((order) => order.rider?._id || order.rider).filter(Boolean).map(String),
      ])];
      const riders = assignedRiderIds.length
        ? await Rider.find({ _id: { $in: assignedRiderIds } }).select("name vehicleType location isAvailable locationUpdatedAt").lean()
        : [];
      data.warehouses = warehouses;
      data.shops = shops;
      data.riders = riders;
      data.plans = plans;
      data.orders = orders;
    } else if (role === "rider") {
      const rider = await Rider.findOne({ user: req.user.id }).select("name vehicleType location isAvailable locationUpdatedAt").lean();
      if (!rider) return res.status(404).json({ success: false, message: "Rider profile not found" });
      const [plans, orders] = await Promise.all([
        Plan.find({ rider: rider._id, status: { $in: ["planned", "completed"] } })
          .select("name warehouse rider route orders status deliverySlotStart deliverySlotEnd pooled solo savings meta createdAt")
          .populate("warehouse", "name address location")
          .populate({ path: "orders", select: "shop customerName deliveryAddress location status totalAmount", populate: { path: "shop", select: "name address area location" } })
          .sort({ createdAt: -1 }).limit(20).lean(),
        Order.find({ rider: rider._id, status: { $in: ["planned", "picked"] } })
          .select("shop customerName deliveryAddress location status totalAmount plan warehouse deliverySlotStart deliverySlotEnd")
          .populate("shop", "name address area location")
          .populate("warehouse", "name address location")
          .lean(),
      ]);
      data.rider = rider;
      data.plans = plans;
      data.orders = orders;
      data.warehouses = [...new Map(orders.filter((o) => o.warehouse).map((o) => [String(o.warehouse._id), o.warehouse])).values()];
      data.shops = [...new Map(orders.filter((o) => o.shop).map((o) => [String(o.shop._id), o.shop])).values()];
    } else if (role === "shopkeeper") {
      const shops = await Shop.find({ owner: req.user.id }).select("name address area location isActive").lean();
      const shopIds = shops.map((s) => s._id);
      const orders = await Order.find({ shop: { $in: shopIds }, status: { $in: ["pending", "planned", "picked"] } })
        .select("shop customerName deliveryAddress location status totalAmount rider plan warehouse deliverySlotStart deliverySlotEnd")
        .populate("warehouse", "name address location")
        .populate("rider", "name vehicleType location locationUpdatedAt")
        .lean();
      data.shops = shops;
      data.orders = orders;
      data.warehouses = [...new Map(orders.filter((o) => o.warehouse).map((o) => [String(o.warehouse._id), o.warehouse])).values()];
      data.riders = [...new Map(orders.filter((o) => o.rider).map((o) => [String(o.rider._id), o.rider])).values()];
    } else {
      return res.status(403).json({ success: false, message: "Role is not allowed to view map data" });
    }

    return res.status(200).json({ success: true, generatedAt: new Date().toISOString(), data });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMapOverview };
