const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    shop: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shop",
      required: [true, "Shop is required"],
    },
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

module.exports = mongoose.model("Order", orderSchema);