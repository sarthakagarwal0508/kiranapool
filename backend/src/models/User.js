const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      select: false,
      default: undefined,
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    tokenVersion: { type: Number, default: 0, min: 0 },
    role: {
      type: String,
      enum: ["shopkeeper", "wholesaler", "rider"],
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);    