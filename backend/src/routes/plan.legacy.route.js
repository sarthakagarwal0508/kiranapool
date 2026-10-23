// Backward-compatible singular URLs documented in the original Phase 5 API inventory.
const express = require("express");
const { protect, allowRoles } = require("../middleware/auth.middleware");
const { createPlan, getLatestPlan } = require("../controllers/plan.controller");

const router = express.Router();
router.post("/", protect, allowRoles("wholesaler"), createPlan);
router.get("/latest", protect, allowRoles("wholesaler", "rider"), getLatestPlan);
module.exports = router;
