const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

router.get("/", (req, res) => {
  const isDatabaseConnected = mongoose.connection.readyState === 1;

  return res.status(isDatabaseConnected ? 200 : 503).json({
    success: isDatabaseConnected,
    message: isDatabaseConnected
      ? "KiranaPool API is healthy"
      : "Database is not connected",
    services: {
      api: "running",
      database: isDatabaseConnected ? "connected" : "disconnected",
    },
  });
});

module.exports = router;