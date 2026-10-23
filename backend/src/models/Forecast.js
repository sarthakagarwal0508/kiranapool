const mongoose = require("mongoose");

const forecastSchema = new mongoose.Schema(
  {
    forecastDate: { type: Date, required: true, index: true },
    wholesaler: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    scope: { type: String, enum: ["shop", "area"], default: "shop", index: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", default: null, index: true },
    area: { type: String, trim: true, default: "", index: true },
    timeSlot: { type: String, enum: ["morning", "afternoon", "evening"], default: "morning", index: true },
    slotStart: { type: Date, default: null },
    slotEnd: { type: Date, default: null },
    predictedOrders: { type: Number, required: true, min: 0 },
    actualOrders: { type: Number, min: 0, default: null },
    confidence: { type: Number, min: 0, max: 1, default: null },
    modelSource: { type: String, default: "local-fallback" },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

forecastSchema.index({ wholesaler: 1, forecastDate: 1, scope: 1, shop: 1, area: 1, timeSlot: 1 });

module.exports = mongoose.model("Forecast", forecastSchema);
