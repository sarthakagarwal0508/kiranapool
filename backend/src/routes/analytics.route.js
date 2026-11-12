const express = require("express");
const { protect, allowRoles } = require("../middleware/auth.middleware");
const { getOverview } = require("../controllers/analytics.controller");

const router = express.Router();
router.use(protect, allowRoles("shopkeeper", "wholesaler", "rider"));
router.get("/overview", getOverview);
module.exports = router;
