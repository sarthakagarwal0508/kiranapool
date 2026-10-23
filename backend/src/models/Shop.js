const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Shop name is required"],
      trim: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Shop owner is required"],
      index: true,
    },
    ownerName: {
      type: String,
      trim: true,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      required: [true, "Shop address is required"],
      trim: true,
    },
    location: {
      lat: {
        type: Number,
        required: true,
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        required: true,
        min: -180,
        max: 180,
      },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Shop", shopSchema);