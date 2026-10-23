const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "Delivery Plan",
      trim: true,
    },
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },
    pooled: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    solo: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    savings: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ["draft", "planned", "completed", "failed"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Plan", planSchema);