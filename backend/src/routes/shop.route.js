const express = require("express");

const {
  getShops,
  getShopById,
  createShop,
  updateShop,
  deleteShop,
} = require("../controllers/shop.controller");

const { protect, allowRoles } = require("../middleware/auth.middleware");

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getShops)
  .post(allowRoles("shopkeeper"), createShop);

router.route("/:id")
  .get(getShopById)
  .patch(allowRoles("shopkeeper"), updateShop)
  .delete(allowRoles("shopkeeper"), deleteShop);

module.exports = router;