const express = require("express");
const { protect, allowRoles } = require("../middleware/auth.middleware");
const { getMapOverview } = require("../controllers/map.controller");

const router = express.Router();
router.use(protect);
router.get("/overview", allowRoles("wholesaler", "rider", "shopkeeper"), getMapOverview);

module.exports = router;
