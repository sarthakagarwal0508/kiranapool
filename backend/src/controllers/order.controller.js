
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Shop = require("../models/Shop");
const Rider = require("../models/Rider");

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
      customerName,
      customerPhone,
      deliveryAddress,
      location,
      items,
      deliveryWindowMin,
    } = req.body;

    if (!shop || !mongoose.isValidObjectId(shop)) {
      return res.status(400).json({
        success: false,
        message: "A valid shop ID is required",
      });
    }

    const ownedShop = await Shop.findOne({
      _id: shop,
      owner: req.user.id,
    });

    if (!ownedShop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found or you do not own this shop",
      });
    }

    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      typeof customerPhone !== "string" ||
      !customerPhone.trim() ||
      typeof deliveryAddress !== "string" ||
      !deliveryAddress.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Customer name, phone and delivery address are required",
      });
    }

    if (
      !location ||
      typeof location.lat !== "number" ||
      typeof location.lng !== "number" ||
      !Number.isFinite(location.lat) ||
      !Number.isFinite(location.lng) ||
      location.lat < -90 ||
      location.lat > 90 ||
      location.lng < -180 ||
      location.lng > 180
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid location.lat and location.lng are required",
      });
    }

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one order item is required",
      });
    }

    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      if (
        !item ||
        typeof item.name !== "string" ||
        !item.name.trim() ||
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        typeof item.price !== "number" ||
        !Number.isFinite(item.price) ||
        item.price < 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Each item needs a name, positive integer quantity and non-negative price",
        });
      }

      totalAmount += item.quantity * item.price;

      validatedItems.push({
        name: item.name.trim(),
        quantity: item.quantity,
        price: item.price,
      });
    }

    if (!Number.isFinite(totalAmount)) {
      return res.status(400).json({
        success: false,
        message: "Order total is invalid",
      });
    }

    if (
      deliveryWindowMin !== undefined &&
      (!Number.isFinite(deliveryWindowMin) ||
        deliveryWindowMin <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "deliveryWindowMin must be a positive number",
      });
    }

    const order = await Order.create({
      shop: ownedShop._id,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deliveryAddress: deliveryAddress.trim(),
      location,
      items: validatedItems,
      totalAmount,
      ...(deliveryWindowMin !== undefined && { deliveryWindowMin }),
    });

    return res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: order,
    });
  } catch (error) {
    next(error);
  }
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

      if (!rider) {
        return res.status(200).json({
          success: true,
          count: 0,
          data: [],
        });
      }

      filter.rider = rider._id;
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
      .populate("shop", "name address owner")
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

      if (!rider) {
        return res.status(404).json({
          success: false,
          message: "Order not found",
        });
      }

      filter.rider = rider._id;
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    const order = await Order.findOne(filter)
      .populate("shop", "name address owner")
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
    } else {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    await order.save();

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
  getOrders,
  getOrderById,
  updateOrderStatus,
};
