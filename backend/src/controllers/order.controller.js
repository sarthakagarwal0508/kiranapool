
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Shop = require("../models/Shop");
const Rider = require("../models/Rider");
const Warehouse = require("../models/Warehouse");
const Plan = require("../models/Plan");
const { checkWarehouseServiceability } = require("../services/warehouse-serviceability.service");

const validStatuses = [
  "pending",
  "planned",
  "picked",
  "delivered",
  "cancelled",
];

// POST /api/orders
// Create an order for a shop owned by the logged-in shopkeeper
const createOrder = async (req, res, next) => {
  try {
    const {
      shop,
      warehouse: warehouseId,
      warehouseId: alternateWarehouseId,
      customerName,
      customerPhone,
      deliveryAddress,
      location,
      items,
      deliveryWindowMin,
      deliverySlotStart,
      deliverySlotEnd,
    } = req.body;
    const selectedWarehouseId = warehouseId || alternateWarehouseId || null;

    if (!shop || !mongoose.isValidObjectId(shop)) {
      return res.status(400).json({ success: false, message: "A valid shop ID is required" });
    }
    const ownedShop = await Shop.findOne({ _id: shop, owner: req.user.id, isActive: true });
    if (!ownedShop) {
      return res.status(404).json({ success: false, message: "Shop not found, inactive, or you do not own this shop" });
    }

    let warehouse = null;
    let parsedSlotStart = null;
    let parsedSlotEnd = null;
    if (selectedWarehouseId) {
      if (!mongoose.isValidObjectId(selectedWarehouseId)) {
        return res.status(400).json({ success: false, message: "A valid warehouse ID is required" });
      }
      warehouse = await Warehouse.findOne({ _id: selectedWarehouseId, isActive: true });
      if (!warehouse) return res.status(404).json({ success: false, message: "Warehouse not found or inactive" });
      const serviceability = checkWarehouseServiceability({ warehouse, shop: ownedShop });
      if (!serviceability.allowed) {
        return res.status(400).json({
          success: false,
          message: serviceability.message,
          code: "WAREHOUSE_OUT_OF_SERVICE_AREA",
          distanceKm: serviceability.distanceKm,
          maxDistanceKm: serviceability.maxDistanceKm,
        });
      }
      if (!deliverySlotStart || !deliverySlotEnd || Number.isNaN(Date.parse(deliverySlotStart)) || Number.isNaN(Date.parse(deliverySlotEnd))) {
        return res.status(400).json({ success: false, message: "deliverySlotStart and deliverySlotEnd are required as valid dates for wholesaler orders" });
      }
      parsedSlotStart = new Date(deliverySlotStart);
      parsedSlotEnd = new Date(deliverySlotEnd);
      if (parsedSlotEnd <= parsedSlotStart || parsedSlotStart <= new Date() || parsedSlotEnd <= new Date()) {
        return res.status(400).json({ success: false, message: "Delivery slot end must be after start and in the future" });
      }
    }

    const finalCustomerName = selectedWarehouseId ? (customerName || ownedShop.name) : customerName;
    const finalCustomerPhone = selectedWarehouseId ? (customerPhone || ownedShop.phone || "Not provided") : customerPhone;
    const finalDeliveryAddress = selectedWarehouseId ? (deliveryAddress || ownedShop.address) : deliveryAddress;
    const finalLocation = selectedWarehouseId ? (location || ownedShop.location) : location;

    if (typeof finalCustomerName !== "string" || !finalCustomerName.trim() || typeof finalCustomerPhone !== "string" || !finalCustomerPhone.trim() || typeof finalDeliveryAddress !== "string" || !finalDeliveryAddress.trim()) {
      return res.status(400).json({ success: false, message: "Customer/shop name, phone and delivery address are required" });
    }
    if (!finalLocation || typeof finalLocation.lat !== "number" || typeof finalLocation.lng !== "number" || !Number.isFinite(finalLocation.lat) || !Number.isFinite(finalLocation.lng) || finalLocation.lat < -90 || finalLocation.lat > 90 || finalLocation.lng < -180 || finalLocation.lng > 180) {
      return res.status(400).json({ success: false, message: "Valid location.lat and location.lng are required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, message: "At least one order item is required" });
    }

    let totalAmount = 0;
    const validatedItems = [];
    for (const item of items) {
      if (!item || typeof item.name !== "string" || !item.name.trim() || !Number.isInteger(item.quantity) || item.quantity < 1 || typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0) {
        return res.status(400).json({ success: false, message: "Each item needs a name, positive integer quantity and non-negative price" });
      }
      totalAmount += item.quantity * item.price;
      validatedItems.push({ name: item.name.trim(), quantity: item.quantity, price: item.price });
    }
    if (!Number.isFinite(totalAmount)) return res.status(400).json({ success: false, message: "Order total is invalid" });
    if (deliveryWindowMin !== undefined && (!Number.isFinite(deliveryWindowMin) || deliveryWindowMin <= 0)) {
      return res.status(400).json({ success: false, message: "deliveryWindowMin must be a positive number" });
    }

    const order = await Order.create({
      shop: ownedShop._id,
      createdBy: req.user.id,
      orderSource: "shopkeeper",
      warehouse: warehouse?._id || null,
      ...(parsedSlotStart && { deliverySlotStart: parsedSlotStart, deliverySlotEnd: parsedSlotEnd }),
      customerName: finalCustomerName.trim(),
      customerPhone: finalCustomerPhone.trim(),
      deliveryAddress: finalDeliveryAddress.trim(),
      location: finalLocation,
      items: validatedItems,
      totalAmount,
      ...(deliveryWindowMin !== undefined && { deliveryWindowMin }),
    });
    return res.status(201).json({ success: true, message: warehouse ? "Supply order placed successfully" : "Order created successfully", data: order });
  } catch (error) { next(error); }
};


// POST /api/orders/manual — wholesaler records an order received offline/on phone.
const createManualOrderForShop = async (req, res, next) => {
  try {
    const { shop, warehouse: warehouseId, customerName, customerPhone, deliveryAddress, location, items, deliverySlotStart, deliverySlotEnd, deliveryWindowMin } = req.body;
    if (!shop || !mongoose.isValidObjectId(shop)) return res.status(400).json({ success: false, message: "A valid registered shop ID is required" });
    if (!warehouseId || !mongoose.isValidObjectId(warehouseId)) return res.status(400).json({ success: false, message: "A valid warehouse ID is required" });
    const [shopDoc, warehouse] = await Promise.all([
      Shop.findOne({ _id: shop, isActive: true }),
      Warehouse.findOne({ _id: warehouseId, owner: req.user.id, isActive: true }),
    ]);
    if (!shopDoc) return res.status(404).json({ success: false, message: "Active kirana shop not found" });
    if (!warehouse) return res.status(404).json({ success: false, message: "Active warehouse not found or not owned by this wholesaler" });
    const serviceability = checkWarehouseServiceability({ warehouse, shop: shopDoc });
    if (!serviceability.allowed) {
      return res.status(400).json({
        success: false,
        message: serviceability.message,
        code: "WAREHOUSE_OUT_OF_SERVICE_AREA",
        distanceKm: serviceability.distanceKm,
        maxDistanceKm: serviceability.maxDistanceKm,
      });
    }

    if (!deliverySlotStart || !deliverySlotEnd || Number.isNaN(Date.parse(deliverySlotStart)) || Number.isNaN(Date.parse(deliverySlotEnd))) {
      return res.status(400).json({ success: false, message: "deliverySlotStart and deliverySlotEnd are required as valid dates" });
    }
    const slotStart = new Date(deliverySlotStart);
    const slotEnd = new Date(deliverySlotEnd);
    if (slotStart <= new Date() || slotEnd <= slotStart) return res.status(400).json({ success: false, message: "Delivery slot must start in the future and end after start" });

    const finalLocation = location || shopDoc.location;
    if (!finalLocation || typeof finalLocation.lat !== "number" || typeof finalLocation.lng !== "number" || !Number.isFinite(finalLocation.lat) || !Number.isFinite(finalLocation.lng) || finalLocation.lat < -90 || finalLocation.lat > 90 || finalLocation.lng < -180 || finalLocation.lng > 180) {
      return res.status(400).json({ success: false, message: "Valid location.lat and location.lng are required" });
    }
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ success: false, message: "At least one order item is required" });
    if (deliveryWindowMin !== undefined && (!Number.isFinite(deliveryWindowMin) || deliveryWindowMin <= 0)) return res.status(400).json({ success: false, message: "deliveryWindowMin must be a positive number" });

    let totalAmount = 0;
    const validatedItems = [];
    for (const item of items) {
      if (!item || typeof item.name !== "string" || !item.name.trim() || !Number.isInteger(item.quantity) || item.quantity < 1 || typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0) {
        return res.status(400).json({ success: false, message: "Each item needs a name, positive integer quantity and non-negative price" });
      }
      totalAmount += item.quantity * item.price;
      validatedItems.push({ name: item.name.trim(), quantity: item.quantity, price: item.price });
    }
    if (!Number.isFinite(totalAmount)) return res.status(400).json({ success: false, message: "Order total is invalid" });

    const finalName = customerName === undefined ? shopDoc.name : customerName;
    const finalPhone = customerPhone === undefined ? (shopDoc.phone || "Not provided") : customerPhone;
    const finalAddress = deliveryAddress === undefined ? shopDoc.address : deliveryAddress;
    if (typeof finalName !== "string" || !finalName.trim() || typeof finalPhone !== "string" || !finalPhone.trim() || typeof finalAddress !== "string" || !finalAddress.trim()) {
      return res.status(400).json({ success: false, message: "customerName, customerPhone and deliveryAddress must be non-empty strings when provided" });
    }
    const order = await Order.create({
      shop: shopDoc._id,
      warehouse: warehouse._id,
      createdBy: req.user.id,
      orderSource: "wholesaler_manual",
      customerName: finalName.trim(),
      customerPhone: finalPhone.trim(),
      deliveryAddress: finalAddress.trim(),
      location: finalLocation,
      deliverySlotStart: slotStart,
      deliverySlotEnd: slotEnd,
      items: validatedItems,
      totalAmount,
      ...(deliveryWindowMin !== undefined && { deliveryWindowMin }),
    });
    return res.status(201).json({ success: true, message: "Manual supply order recorded successfully", data: order });
  } catch (error) { next(error); }
};

// GET /api/orders
// Shopkeepers see their shops' orders; riders see assigned orders
const getOrders = async (req, res, next) => {
  try {
    let filter = {};

    if (req.user.role === "shopkeeper") {
      const shops = await Shop.find({ owner: req.user.id }).select("_id");
      filter.shop = { $in: shops.map((item) => item._id) };
    } else if (req.user.role === "rider") {
      const rider = await Rider.findOne({ user: req.user.id }).select("_id");
      if (!rider) return res.status(200).json({ success: true, count: 0, data: [] });
      filter.rider = rider._id;
    } else if (req.user.role === "wholesaler") {
      const warehouses = await Warehouse.find({ owner: req.user.id }).select("_id");
      filter.warehouse = { $in: warehouses.map((item) => item._id) };
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    if (req.query.status) {
      if (!validStatuses.includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid order status filter",
        });
      }

      filter.status = req.query.status;
    }

    const orders = await Order.find(filter)
      .populate("shop", "name address area owner location")
      .populate("warehouse", "name address location owner supplierName")
      .populate("rider", "name phone vehicleType")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: orders.length,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};


// GET /api/orders/:id
// Only the owning shopkeeper or assigned rider can view an order
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    let filter = { _id: id };

    if (req.user.role === "shopkeeper") {
      const shops = await Shop.find({ owner: req.user.id }).select("_id");
      filter.shop = { $in: shops.map((item) => item._id) };
    } else if (req.user.role === "rider") {
      const rider = await Rider.findOne({ user: req.user.id }).select("_id");
      if (!rider) return res.status(404).json({ success: false, message: "Order not found" });
      filter.rider = rider._id;
    } else if (req.user.role === "wholesaler") {
      const warehouses = await Warehouse.find({ owner: req.user.id }).select("_id");
      filter.warehouse = { $in: warehouses.map((item) => item._id) };
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const order = await Order.findOne(filter)
      .populate("shop", "name address area owner location")
      .populate("warehouse", "name address location owner supplierName")
      .populate("rider", "name phone vehicleType");

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/orders/:id/status
// Shopkeepers can cancel pending orders; assigned riders handle delivery progress
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "A valid order status is required",
      });
    }

    const order = await Order.findById(id);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    if (req.user.role === "shopkeeper") {
      const ownedShop = await Shop.findOne({
        _id: order.shop,
        owner: req.user.id,
      });

      if (!ownedShop) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      if (status !== "cancelled" || order.status !== "pending") {
        return res.status(403).json({
          success: false,
          message: "Shopkeepers can only cancel pending orders",
        });
      }

      order.status = "cancelled";
    } else if (req.user.role === "rider") {
      const rider = await Rider.findOne({ user: req.user.id }).select("_id");

      if (!rider || !order.rider || !order.rider.equals(rider._id)) {
        return res.status(403).json({
          success: false,
          message: "This order is not assigned to you",
        });
      }

      const allowedTransitions = {
        planned: ["picked"],
        picked: ["delivered"],
      };

      if (
        !allowedTransitions[order.status] ||
        !allowedTransitions[order.status].includes(status)
      ) {
        return res.status(400).json({
          success: false,
          message: `Cannot change order status from ${order.status} to ${status}`,
        });
      }

      order.status = status;
    } else if (req.user.role === "wholesaler") {
      if (!order.warehouse) return res.status(404).json({ success: false, message: "Order not found" });
      const warehouse = await Warehouse.findOne({ _id: order.warehouse, owner: req.user.id });
      if (!warehouse) return res.status(404).json({ success: false, message: "Order not found" });
      if (status !== "cancelled" || order.status !== "pending") {
        return res.status(403).json({ success: false, message: "Wholesalers can only cancel pending orders; use planning APIs for other changes" });
      }
      order.status = "cancelled";
    } else {
      return res.status(403).json({ success: false, message: "Access denied" });
    }

    await order.save();
    if (order.plan && status === "delivered") {
      const plan = await Plan.findById(order.plan);
      if (plan) {
        const remaining = await Order.countDocuments({ plan: plan._id, status: { $ne: "delivered" } });
        if (remaining === 0) {
          plan.status = "completed";
          await plan.save();
          if (plan.rider) await Rider.findByIdAndUpdate(plan.rider, { isAvailable: true });
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  createManualOrderForShop,
  getOrders,
  getOrderById,
  updateOrderStatus,
};
