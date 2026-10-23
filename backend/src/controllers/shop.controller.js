const mongoose = require("mongoose");
const Shop = require("../models/Shop");
const Warehouse = require("../models/Warehouse");

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const wholesalerShopFilter = async (userId) => {
  const warehouses = await Warehouse.find({ owner: userId, isActive: true }).select("serviceAreas").lean();
  if (!warehouses.length) return { isActive: true, _id: { $exists: false } };
  // A warehouse with no area restriction is considered able to serve any active shop.
  if (warehouses.some((warehouse) => !(warehouse.serviceAreas || []).length)) return { isActive: true };
  const areas = [...new Set(warehouses.flatMap((warehouse) => warehouse.serviceAreas || []).map((area) => String(area).trim()).filter(Boolean))];
  if (!areas.length) return { isActive: true, _id: { $exists: false } };
  return {
    isActive: true,
    $or: [
      ...areas.map((area) => ({ area: { $regex: `^${escapeRegex(area)}$`, $options: "i" } })),
      ...areas.map((area) => ({ address: { $regex: escapeRegex(area), $options: "i" } })),
    ],
  };
};

const getShops = async (req, res, next) => {
  try {
    // Shopkeepers see their own shops. Wholesalers can select active kirana
    // shops served by their warehouse areas even before the first supply order.
    // Riders can see active shops for delivery context.
    let filter;
    if (req.user.role === "shopkeeper") {
      filter = { owner: req.user.id };
    } else if (req.user.role === "wholesaler") {
      filter = await wholesalerShopFilter(req.user.id);
    } else {
      filter = { isActive: true };
    }

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

    let filter = { _id: id };

    if (req.user.role === "shopkeeper") {
      filter.owner = req.user.id;
    } else if (req.user.role === "wholesaler") {
      filter = { _id: id, ...(await wholesalerShopFilter(req.user.id)) };
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
    const { name, ownerName, phone, address, location, area } = req.body;

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
      area: typeof area === "string" ? area.trim() : "",
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
      "area",
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

    if ("area" in updates && typeof updates.area !== "string") {
      return res.status(400).json({ success: false, message: "Area must be a string" });
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
    if (typeof updates.area === "string") {
      updates.area = updates.area.trim();
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