
const express = require("express");

const {
  getRiders,
  getRiderById,
  getMyRiderProfile,
  createRiderProfile,
  updateMyRiderProfile,
} = require("../controllers/rider.controller");

const {
  protect,
  allowRoles,
} = require("../middleware/auth.middleware");

const router = express.Router();

// All rider endpoints require a valid JWT
router.use(protect);

// Current rider's routes must come before /:id
router.get(
  "/me",
  allowRoles("rider"),
  getMyRiderProfile
);

router.patch(
  "/me",
  allowRoles("rider"),
  updateMyRiderProfile
);

// Rider directory
router.get("/", getRiders);
router.get("/:id", getRiderById);

// Create a profile only for the authenticated rider account
router.post(
  "/",
  allowRoles("rider"),
  createRiderProfile
);

module.exports = router;
