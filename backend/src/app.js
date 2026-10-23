const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health.routes");
const shopRoutes = require("./routes/shop.route");
const authRoutes = require("./routes/auth.route");
const riderRoutes = require("./routes/rider.route");
const orderRoutes = require("./routes/order.route");
const warehouseRoutes = require("./routes/warehouse.route");
const planRoutes = require("./routes/plan.route");
const legacyPlanRoutes = require("./routes/plan.legacy.route");
const forecastRoutes = require("./routes/forecast.route");
const mapRoutes = require("./routes/map.route");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/health", healthRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/riders", riderRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/warehouses", warehouseRoutes);
app.use("/api/plans", planRoutes);
app.use("/api/plan", legacyPlanRoutes);
app.use("/api/forecasts", forecastRoutes);
app.use("/api/map", mapRoutes);

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