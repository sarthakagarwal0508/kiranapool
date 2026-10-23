
const express = require("express");

const {
  createOrder,
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

router
  .route("/")
  .get(allowRoles("shopkeeper", "rider"), getOrders)
  .post(allowRoles("shopkeeper"), createOrder);

router.patch(
  "/:id/status",
  allowRoles("shopkeeper", "rider"),
  updateOrderStatus
);

router.get(
  "/:id",
  allowRoles("shopkeeper", "rider"),
  getOrderById
);

module.exports = router;
