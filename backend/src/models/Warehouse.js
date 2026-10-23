const mongoose = require("mongoose");

const warehouseSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Warehouse wholesaler owner is required"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Warehouse name is required"],
      trim: true,
    },
    supplierName: { type: String, trim: true, default: "" },
    address: {
      type: String,
      required: [true, "Warehouse address is required"],
      trim: true,
    },
    location: {
      lat: { type: Number, required: true, min: -90, max: 90 },
      lng: { type: Number, required: true, min: -180, max: 180 },
    },
    serviceAreas: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

warehouseSchema.index({ owner: 1, isActive: 1 });

module.exports = mongoose.model("Warehouse", warehouseSchema);
