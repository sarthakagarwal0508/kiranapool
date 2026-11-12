
const mongoose = require("mongoose");
const Rider = require("../models/Rider");
const Plan = require("../models/Plan");
const { parsePagination } = require("../utils/pagination");

// GET /api/riders
// List all riders (authenticated users only)
const getRiders = async (req, res, next) => {
  try {
    const filter = { $or: [{ managedBy: req.user.id }, { managedBy: null, isAvailable: true }] };
    const pagination = parsePagination(req.query, { defaultLimit: 50, maxLimit: 100 });
    if (pagination.error) return res.status(400).json({ success: false, message: pagination.error });
    const [total, riders] = await Promise.all([
      Rider.countDocuments(filter),
      Rider.find(filter).select("name phone vehicleType location isAvailable locationUpdatedAt").sort({ isAvailable: -1, createdAt: -1 }).skip(pagination.skip).limit(pagination.limit),
    ]);
    return res.status(200).json({ success: true, count: riders.length, total, page: pagination.page, limit: pagination.limit, pages: Math.ceil(total / pagination.limit), data: riders });
  } catch (error) {
    next(error);
  }
};

// GET /api/riders/me
// Get the logged-in rider's profile
const getMyRiderProfile = async (req, res, next) => {
  try {
    const rider = await Rider.findOne({ user: req.user.id }).select("-__v -managedBy");

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found. Create your profile first.",
      });
    }

    return res.status(200).json({
      success: true,
      data: rider,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/riders/:id
// Get one rider's profile
const getRiderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid rider ID",
      });
    }

    const rider = await Rider.findOne({ _id: id, $or: [{ managedBy: req.user.id }, { managedBy: null, isAvailable: true }] }).select("name phone vehicleType location isAvailable locationUpdatedAt");

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: rider,
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/riders
// Create a profile for the logged-in rider
const createRiderProfile = async (req, res, next) => {
  try {
    const { name, phone, vehicleType, location } = req.body;

    if (typeof name !== "string" || !name.trim() || name.trim().length > 100) {
      return res.status(400).json({ success: false, message: "Rider name must be a non-empty string up to 100 characters" });
    }
    if (phone !== undefined && (typeof phone !== "string" || phone.length > 30)) {
      return res.status(400).json({ success: false, message: "Phone must be a string up to 30 characters" });
    }
    if (vehicleType !== undefined && !["bike", "scooter", "cycle", "other"].includes(vehicleType)) {
      return res.status(400).json({ success: false, message: "Invalid vehicleType" });
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
        message: "Valid location.lat and location.lng are required as numbers",
      });
    }

    const existingRider = await Rider.findOne({ user: req.user.id });

    if (existingRider) {
      return res.status(409).json({
        success: false,
        message: "Rider profile already exists for this account",
      });
    }

    const rider = await Rider.create({
      user: req.user.id,
      name: name.trim(),
      phone,
      vehicleType,
      location,
    });

    return res.status(201).json({
      success: true,
      message: "Rider profile created successfully",
      data: rider,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Rider profile already exists for this account",
      });
    }

    next(error);
  }
};

// PATCH /api/riders/me
// Update only the logged-in rider's own profile
const updateMyRiderProfile = async (req, res, next) => {
  try {
    const allowedFields = [
      "name",
      "phone",
      "vehicleType",
      "location",
      "isAvailable",
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
        message: "Provide at least one valid field to update",
      });
    }

    if (
      updates.name !== undefined &&
      (typeof updates.name !== "string" || !updates.name.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "Name must be a non-empty string",
      });
    }

    if (
      updates.phone !== undefined &&
      typeof updates.phone !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "Phone must be a string",
      });
    }

    if (
      updates.vehicleType !== undefined &&
      !["bike", "scooter", "cycle", "other"].includes(updates.vehicleType)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid vehicleType",
      });
    }

    if (
      updates.isAvailable !== undefined &&
      typeof updates.isAvailable !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "isAvailable must be a boolean",
      });
    }

    if (updates.location !== undefined) {
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
          message: "Valid location.lat and location.lng are required as numbers",
        });
      }
    }

    if (updates.name !== undefined) {
      updates.name = updates.name.trim();
    }

    // GPS updates are self-service: the authenticated rider can only update their own location.
    if (updates.location !== undefined) {
      updates.locationUpdatedAt = new Date();
    }

    // Availability is managed by the delivery workflow; a rider cannot mark
    // themselves available while a delivery plan is still active.
    if (updates.isAvailable === true) {
      const currentRider = await Rider.findOne({ user: req.user.id }).select("_id");
      if (!currentRider) {
        return res.status(404).json({ success: false, message: "Rider profile not found. Create your profile first." });
      }
      const activePlan = await Plan.exists({ rider: currentRider._id, status: "planned" });
      if (activePlan) {
        return res.status(409).json({ success: false, message: "You cannot mark yourself available while a delivery plan is active" });
      }
    }

    const rider = await Rider.findOneAndUpdate(
      { user: req.user.id },
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-__v -managedBy");

    if (!rider) {
      return res.status(404).json({
        success: false,
        message: "Rider profile not found. Create your profile first.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Rider profile updated successfully",
      data: rider,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getRiders,
  getRiderById,
  getMyRiderProfile,
  createRiderProfile,
  updateMyRiderProfile,
};
