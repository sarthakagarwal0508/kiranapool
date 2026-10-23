const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: [true, "Shop is required"],
    },
    // Audit which account entered the order (shopkeeper app vs wholesaler manual entry).
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    orderSource: { type: String, enum: ["shopkeeper", "wholesaler_manual", "legacy"], default: "shopkeeper", index: true },
    // Synthetic-seed marker is only used by the local demo seed script.
    demoSeed: { type: Boolean, default: false, index: true },
    warehouse: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Warehouse",
      default: null,
      index: true,
    },
    deliverySlotStart: { type: Date, default: null, index: true },
    deliverySlotEnd: { type: Date, default: null },
    customerName: {
      type: String,
      required: [true, "Customer name is required"],
      trim: true,
    },
    customerPhone: {
      type: String,
      trim: true,
      default: "",
    },
    deliveryAddress: {
      type: String,
      required: [true, "Delivery address is required"],
      trim: true,
    },
    location: {
      lat: {
        type: Number,
        required: [true, "Delivery latitude is required"],
      },
      lng: {
        type: Number,
        required: [true, "Delivery longitude is required"],
      },
    },
    items: [
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },
        quantity: {
          type: Number,
          required: true,
          min: 1,
        },
        price: {
          type: Number,
          required: true,
          min: 0,
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: [true, "Order total is required"],
      min: 0,
    },
    status: {
      type: String,
      enum: ["pending", "planned", "picked", "delivered", "cancelled"],
      default: "pending",
    },
    deliveryWindowMin: {
      type: Number,
      default: 60,
      min: 1,
    },
    rider: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Rider",
      default: null,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ warehouse: 1, status: 1, deliverySlotStart: 1, deliverySlotEnd: 1 });

module.exports = mongoose.model("Order", orderSchema);