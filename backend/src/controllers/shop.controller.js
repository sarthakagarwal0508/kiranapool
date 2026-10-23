const mongoose = require("mongoose");
const Shop = require("../models/Shop");

const getShops = async (req, res, next) => {
  try {
    // Shopkeepers see only their own shops.
    // Riders can see active shops for delivery context.
    const filter =
      req.user.role === "shopkeeper"
        ? { owner: req.user.id }
        : { isActive: true };

    const shops = await Shop.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: shops.length,
      data: shops,
    });
  } catch (error) {
    next(error);
  }
};

const getShopById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shop ID",
      });
    }

    const filter = { _id: id };

    if (req.user.role === "shopkeeper") {
      filter.owner = req.user.id;
    } else {
      filter.isActive = true;
    }

    const shop = await Shop.findOne(filter);

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: shop,
    });
  } catch (error) {
    next(error);
  }
};

const createShop = async (req, res, next) => {
  try {
    const { name, ownerName, phone, address, location } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof address !== "string" ||
      !address.trim() ||
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
        message: "Valid name, address and location (lat, lng) are required",
      });
    }

    const shop = await Shop.create({
      name: name.trim(),
      owner: req.user.id,
      ownerName,
      phone,
      address: address.trim(),
      location,
    });

    return res.status(201).json({
      success: true,
      message: "Shop created successfully",
      data: shop,
    });
  } catch (error) {
    next(error);
  }
};

const updateShop = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shop ID",
      });
    }

    const allowedFields = [
      "name",
      "ownerName",
      "phone",
      "address",
      "location",
      "isActive",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one field to update",
      });
    }

    if ("name" in updates && (
      typeof updates.name !== "string" || !updates.name.trim()
    )) {
      return res.status(400).json({
        success: false,
        message: "Shop name cannot be empty",
      });
    }

    if ("address" in updates && (
      typeof updates.address !== "string" || !updates.address.trim()
    )) {
      return res.status(400).json({
        success: false,
        message: "Shop address cannot be empty",
      });
    }

    if ("location" in updates) {
      const { lat, lng } = updates.location || {};

      if (
        typeof lat !== "number" ||
        typeof lng !== "number" ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return res.status(400).json({
          success: false,
          message: "Location must contain valid numeric lat and lng",
        });
      }
    }

    if ("isActive" in updates && typeof updates.isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be a boolean",
      });
    }

    if (typeof updates.name === "string") {
      updates.name = updates.name.trim();
    }

    if (typeof updates.address === "string") {
      updates.address = updates.address.trim();
    }

    const shop = await Shop.findOneAndUpdate(
      { _id: id, owner: req.user.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found or you do not own this shop",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Shop updated successfully",
      data: shop,
    });
  } catch (error) {
    next(error);
  }
};

const deleteShop = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid shop ID",
      });
    }

    const shop = await Shop.findOneAndDelete({
      _id: id,
      owner: req.user.id,
    });

    if (!shop) {
      return res.status(404).json({
        success: false,
        message: "Shop not found or you do not own this shop",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Shop deleted successfully",
      data: shop,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getShops,
  getShopById,
  createShop,
  updateShop,
  deleteShop,
};