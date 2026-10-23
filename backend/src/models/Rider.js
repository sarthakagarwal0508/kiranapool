const mongoose = require("mongoose");

const riderSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Rider name is required"],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    vehicleType: {
      type: String,
      enum: ["bike", "scooter", "cycle", "other"],
      default: "bike",
    },
    location: {
      lat: {
        type: Number,
        required: [true, "Rider latitude is required"],
      },
      lng: {
        type: Number,
        required: [true, "Rider longitude is required"],
      },
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Rider", riderSchema);