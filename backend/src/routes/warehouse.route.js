const express = require("express");
const { createWarehouse, getWarehouses, getWarehouseById, updateWarehouse } = require("../controllers/warehouse.controller");
const { protect, allowRoles } = require("../middleware/auth.middleware");

const router = express.Router();
router.use(protect);
router.get("/", allowRoles("shopkeeper", "wholesaler", "rider"), getWarehouses);
router.get("/:id", allowRoles("shopkeeper", "wholesaler", "rider"), getWarehouseById);
router.post("/", allowRoles("wholesaler"), createWarehouse);
router.patch("/:id", allowRoles("wholesaler"), updateWarehouse);
module.exports = router;
