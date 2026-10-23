const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: "Delivery Plan",
      trim: true,
    },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
      index: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    deliverySlotStart: { type: Date, default: null },
    deliverySlotEnd: { type: Date, default: null },
    route: { type: [mongoose.Schema.Types.Mixed], default: [] },
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
      enum: ["draft", "planned", "completed", "failed", "cancelled"],
      default: "draft",
    },
  },
  {
    timestamps: true,
  }
);

planSchema.index({ warehouse: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("Plan", planSchema);