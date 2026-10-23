const express = require("express");
const { protect, allowRoles } = require("../middleware/auth.middleware");
const { previewPlan, createPlan, autoPoolOrders, getPlans, getLatestPlan, getPlanById, assignRider, cancelPlan } = require("../controllers/plan.controller");

const router = express.Router();
router.use(protect);
router.get("/", allowRoles("wholesaler", "rider"), getPlans);
router.post("/preview", allowRoles("wholesaler"), previewPlan);
router.post("/auto-pool", allowRoles("wholesaler"), autoPoolOrders);
router.get("/latest", allowRoles("wholesaler", "rider"), getLatestPlan);
router.post("/", allowRoles("wholesaler"), createPlan);
router.patch("/:id/assign-rider", allowRoles("wholesaler"), assignRider);
router.post("/:id/cancel", allowRoles("wholesaler"), cancelPlan);
router.get("/:id", allowRoles("wholesaler", "rider"), getPlanById);
module.exports = router;
