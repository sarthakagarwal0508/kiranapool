const express = require("express");
const { signup, login, googleAuth, logout, getCsrfToken } = require("../controllers/auth.controller");
const { protect } = require("../middleware/auth.middleware");
const { rateLimit } = require("../middleware/security.middleware");

const router = express.Router();
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10, message: "Too many authentication attempts from this network. Try again in 15 minutes." });

router.get("/csrf", getCsrfToken);
router.post("/signup", authLimiter, signup);
router.post("/login", authLimiter, login);
router.post("/google", authLimiter, googleAuth);
router.post("/logout", protect, logout);
router.get("/me", protect, (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

module.exports = router;
