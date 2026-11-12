const express = require("express");
const { protect, allowRoles } = require("../middleware/auth.middleware");
const { rateLimit } = require("../middleware/security.middleware");
const { generateForecasts, getForecasts, getForecastSummary, recordActual } = require("../controllers/forecast.controller");

const router = express.Router();
const forecastRunLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many forecast runs. Wait before trying again." });
router.use(protect);
router.get("/", allowRoles("shopkeeper", "wholesaler"), getForecasts);
router.post("/run", forecastRunLimiter, allowRoles("wholesaler"), generateForecasts);
router.get("/summary", allowRoles("wholesaler"), getForecastSummary);
router.patch("/:id/actual", allowRoles("wholesaler"), recordActual);
module.exports = router;
