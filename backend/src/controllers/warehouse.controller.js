const mongoose = require("mongoose");
const Warehouse = require("../models/Warehouse");

const validLocation = (location) =>
  location &&
  typeof location.lat === "number" &&
  typeof location.lng === "number" &&
  Number.isFinite(location.lat) &&
  Number.isFinite(location.lng) &&
  location.lat >= -90 && location.lat <= 90 &&
  location.lng >= -180 && location.lng <= 180;

const createWarehouse = async (req, res, next) => {
  try {
    const { name, supplierName, address, location, serviceAreas } = req.body;
    if (typeof name !== "string" || !name.trim() || typeof address !== "string" || !address.trim() || !validLocation(location)) {
      return res.status(400).json({ success: false, message: "name, address and valid location.lat/location.lng are required" });
    }
    if (serviceAreas !== undefined && (!Array.isArray(serviceAreas) || serviceAreas.some((x) => typeof x !== "string"))) {
      return res.status(400).json({ success: false, message: "serviceAreas must be an array of strings" });
    }
    const warehouse = await Warehouse.create({
      owner: req.user.id,
      name: name.trim(),
      supplierName: typeof supplierName === "string" && supplierName.trim() ? supplierName.trim() : req.user.name,
      address: address.trim(),
      location,
      serviceAreas: (serviceAreas || []).map((x) => x.trim()).filter(Boolean),
    });
    return res.status(201).json({ success: true, message: "Warehouse created successfully", data: warehouse });
  } catch (error) { next(error); }
};

const getWarehouses = async (req, res, next) => {
  try {
    const filter = req.user.role === "wholesaler" ? { owner: req.user.id } : { isActive: true };
    if (req.query.area) filter.serviceAreas = { $in: [String(req.query.area).trim()] };
    const warehouses = await Warehouse.find(filter).populate("owner", "name email").sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: warehouses.length, data: warehouses });
  } catch (error) { next(error); }
};

const getWarehouseById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid warehouse ID" });
    const filter = { _id: id };
    if (req.user.role === "wholesaler") filter.owner = req.user.id;
    else filter.isActive = true;
    const warehouse = await Warehouse.findOne(filter).populate("owner", "name email");
    if (!warehouse) return res.status(404).json({ success: false, message: "Warehouse not found" });
    return res.status(200).json({ success: true, data: warehouse });
  } catch (error) { next(error); }
};

const updateWarehouse = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid warehouse ID" });
    const allowed = ["name", "supplierName", "address", "location", "serviceAreas", "isActive"];
    const updates = {};
    for (const field of allowed) if (req.body[field] !== undefined) updates[field] = req.body[field];
    if (!Object.keys(updates).length) return res.status(400).json({ success: false, message: "Provide at least one field to update" });
    if ("name" in updates && (typeof updates.name !== "string" || !updates.name.trim())) return res.status(400).json({ success: false, message: "Warehouse name cannot be empty" });
    if ("address" in updates && (typeof updates.address !== "string" || !updates.address.trim())) return res.status(400).json({ success: false, message: "Warehouse address cannot be empty" });
    if ("location" in updates && !validLocation(updates.location)) return res.status(400).json({ success: false, message: "Invalid warehouse location" });
    if ("serviceAreas" in updates && (!Array.isArray(updates.serviceAreas) || updates.serviceAreas.some((x) => typeof x !== "string"))) return res.status(400).json({ success: false, message: "serviceAreas must be an array of strings" });
    if ("isActive" in updates && typeof updates.isActive !== "boolean") return res.status(400).json({ success: false, message: "isActive must be a boolean" });
    for (const key of ["name", "supplierName", "address"]) if (typeof updates[key] === "string") updates[key] = updates[key].trim();
    if (updates.serviceAreas) updates.serviceAreas = updates.serviceAreas.map((x) => x.trim()).filter(Boolean);
    const warehouse = await Warehouse.findOneAndUpdate({ _id: id, owner: req.user.id }, { $set: updates }, { new: true, runValidators: true });
    if (!warehouse) return res.status(404).json({ success: false, message: "Warehouse not found or you do not own it" });
    return res.status(200).json({ success: true, message: "Warehouse updated successfully", data: warehouse });
  } catch (error) { next(error); }
};

module.exports = { createWarehouse, getWarehouses, getWarehouseById, updateWarehouse };
