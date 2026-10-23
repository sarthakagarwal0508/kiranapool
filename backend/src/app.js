const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health.routes");
const shopRoutes = require("./routes/shop.route");
const authRoutes = require("./routes/auth.route");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/auth", authRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  console.error(err);

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

module.exports = app;