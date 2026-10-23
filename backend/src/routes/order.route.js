
const express = require("express");

const {
  createOrder,
  createManualOrderForShop,
  getOrders,
  getOrderById,
  updateOrderStatus,
} = require("../controllers/order.controller");

const {
  protect,
  allowRoles,
} = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router.post("/manual", allowRoles("wholesaler"), createManualOrderForShop);

router
  .route("/")
  .get(allowRoles("shopkeeper", "rider", "wholesaler"), getOrders)
  .post(allowRoles("shopkeeper"), createOrder);

router.patch(
  "/:id/status",
  allowRoles("shopkeeper", "rider", "wholesaler"),
  updateOrderStatus
);

router.get(
  "/:id",
  allowRoles("shopkeeper", "rider", "wholesaler"),
  getOrderById
);

module.exports = router;
