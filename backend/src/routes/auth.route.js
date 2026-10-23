const express = require("express");

const {
  signup,
  login,
  googleAuth,
} = require("../controllers/auth.controller");

const { protect } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/google", googleAuth);

router.get("/me", protect, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

module.exports = router;