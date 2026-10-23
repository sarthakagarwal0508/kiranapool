const express = require("express");
const { protect, allowRoles } = require("../middleware/auth.middleware");
const {
  mlHealth,
  rawRoute,
  planRoute,
  solveRoute,
  batchOrders,
  estimateTravelTime,
  calculateEconomics,
} = require("../controllers/ml.controller");

const router = express.Router();
router.use(protect);

// ML health is visible to authenticated roles; order/route operations are wholesaler-only.
router.get("/health", allowRoles("wholesaler", "rider", "shopkeeper"), mlHealth);
router.post("/route", allowRoles("wholesaler"), rawRoute);
router.post("/routes/plan", allowRoles("wholesaler"), planRoute);
router.post("/routes/solve", allowRoles("wholesaler"), solveRoute);
router.post("/batch", allowRoles("wholesaler"), batchOrders);
router.post("/travel-time", allowRoles("wholesaler", "rider"), estimateTravelTime);
router.post("/economics/costs", allowRoles("wholesaler"), calculateEconomics);

module.exports = router;
