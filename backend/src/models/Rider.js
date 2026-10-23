
const mongoose = require("mongoose");

const riderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
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
        min: -90,
        max: 90,
      },
      lng: {
        type: Number,
        required: [true, "Rider longitude is required"],
        min: -180,
        max: 180,
      },
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Rider", riderSchema);
