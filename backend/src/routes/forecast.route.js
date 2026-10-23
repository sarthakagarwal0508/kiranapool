const express = require("express");
const { protect, allowRoles } = require("../middleware/auth.middleware");
const { generateForecasts, getForecasts, getForecastSummary, recordActual } = require("../controllers/forecast.controller");

const router = express.Router();
router.use(protect);
router.get("/", allowRoles("shopkeeper", "wholesaler"), getForecasts);
router.post("/run", allowRoles("wholesaler"), generateForecasts);
router.get("/summary", allowRoles("wholesaler"), getForecastSummary);
router.patch("/:id/actual", allowRoles("wholesaler"), recordActual);
module.exports = router;
