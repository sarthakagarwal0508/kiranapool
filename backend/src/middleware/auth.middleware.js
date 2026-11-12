const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { AUTH_COOKIE, getCookie, csrfMatches } = require("../utils/session");

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const bearerMatch = typeof authHeader === "string" ? authHeader.match(/^Bearer\s+(\S+)$/i) : null;
    const bearerToken = bearerMatch?.[1] || null;
    const cookieToken = getCookie(req, AUTH_COOKIE);
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    // Cookie sessions require a double-submit CSRF token for every state-changing request.
    // Bearer tokens remain supported for native/non-browser clients.
    if (!bearerToken && cookieToken && !SAFE_METHODS.has(req.method) && !csrfMatches(req)) {
      return res.status(403).json({ success: false, message: "CSRF validation failed. Refresh the page and retry." });
    }

    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(503).json({ success: false, message: "Authentication is temporarily unavailable" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
    if (!decoded?.sub) return res.status(401).json({ success: false, message: "Invalid or expired session" });

    const user = await User.findById(decoded.sub).select("name email role tokenVersion");
    if (!user || Number(decoded.ver || 0) !== Number(user.tokenVersion || 0)) {
      return res.status(401).json({ success: false, message: "Session expired. Please sign in again." });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };
    req.authenticatedWithCookie = Boolean(!bearerToken && cookieToken);
    res.setHeader("Cache-Control", "no-store");
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError" || error.name === "NotBeforeError") {
      return res.status(401).json({ success: false, message: "Invalid or expired session" });
    }
    return next(error);
  }
};

const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "You do not have permission to access this resource" });
  }
  return next();
};

module.exports = { protect, allowRoles };
