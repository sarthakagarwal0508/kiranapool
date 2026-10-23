const mongoose = require("mongoose");

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error("MONGODB_URI is missing from environment variables");
  }

  await mongoose.connect(mongoUri, {serverSelectionTimeoutMS: 10000,});
  console.log("MongoDB Atlas connected successfully");
};

module.exports = connectDB;