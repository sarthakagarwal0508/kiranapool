const express = require("express");
const { protect, allowRoles } = require("../middleware/auth.middleware");
const { rateLimit } = require("../middleware/security.middleware");
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
const mlOperationLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 40, message: "Too many ML operations. Wait before trying again." });
router.use(protect);

// ML health is visible to authenticated roles; order/route operations are wholesaler-only.
router.get("/health", allowRoles("wholesaler", "rider", "shopkeeper"), mlHealth);
router.post("/route", mlOperationLimiter, allowRoles("wholesaler"), rawRoute);
router.post("/routes/plan", mlOperationLimiter, allowRoles("wholesaler"), planRoute);
router.post("/routes/solve", mlOperationLimiter, allowRoles("wholesaler"), solveRoute);
router.post("/batch", mlOperationLimiter, allowRoles("wholesaler"), batchOrders);
router.post("/travel-time", mlOperationLimiter, allowRoles("wholesaler", "rider"), estimateTravelTime);
router.post("/economics/costs", mlOperationLimiter, allowRoles("wholesaler"), calculateEconomics);

module.exports = router;
