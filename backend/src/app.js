const crypto = require("node:crypto");
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
const mlRoutes = require("./routes/ml.route");
const analyticsRoutes = require("./routes/analytics.route");
const { securityHeaders, rateLimit } = require("./middleware/security.middleware");
const { errorHandler, notFoundHandler } = require("./middleware/error.middleware");

const app = express();
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "true" || process.env.NODE_ENV === "production") app.set("trust proxy", 1);

const localDevelopmentOrigins = process.env.NODE_ENV === "production"
  ? []
  : ["http://localhost:5173", "http://127.0.0.1:5173"];
const configuredOrigins = [
  ...localDevelopmentOrigins,
  ...(process.env.FRONTEND_URL || "").split(","),
  ...(process.env.CORS_ALLOWED_ORIGINS || "").split(","),
].map((value) => value.trim()).filter(Boolean);
const allowedOrigins = new Set(configuredOrigins);

app.use((req, res, next) => {
  req.requestId = req.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
  res.setHeader("X-Request-ID", req.requestId);
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(securityHeaders);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-ID"],
  maxAge: 600,
}));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, max: 300 }));
app.use(express.json({ limit: "1mb", strict: true }));

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
app.use("/api/ml", mlRoutes);
app.use("/api/analytics", analyticsRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
