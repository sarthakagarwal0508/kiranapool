const mongoose = require("mongoose");

const forecastSchema = new mongoose.Schema(
  {
    forecastDate: {
      type: Date,
      required: true,
    },
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      default: null,
    },
    predictedOrders: {
      type: Number,
      required: true,
      min: 0,
    },
    actualOrders: {
      type: Number,
      min: 0,
      default: null,
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Forecast", forecastSchema);