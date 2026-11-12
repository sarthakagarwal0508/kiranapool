const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");
const { setSessionCookies, setCsrfCookie, clearSessionCookies, parseDurationSeconds } = require("../utils/session");

const googleClient = new OAuth2Client();
const VALID_ROLES = ["shopkeeper", "wholesaler", "rider"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const safeCompare = (provided, expected) => {
  if (typeof provided !== "string" || typeof expected !== "string" || !provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const roleRegistrationAllowed = (role, inviteCode) => {
  if (role === "shopkeeper") return true;
  const envName = role === "wholesaler" ? "WHOLESALER_SIGNUP_INVITE_CODE" : "RIDER_SIGNUP_INVITE_CODE";
  return safeCompare(inviteCode, process.env[envName]);
};

const createToken = (user) => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 characters");
  }
  return jwt.sign(
    { role: user.role, ver: Number(user.tokenVersion || 0) },
    process.env.JWT_SECRET,
    { subject: user._id.toString(), expiresIn: parseDurationSeconds(process.env.JWT_EXPIRES_IN, 12 * 60 * 60), algorithm: "HS256" }
  );
};

const userResponse = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
});

const completeLogin = (res, user, { status = 200, message = "Login successful" } = {}) => {
  const token = createToken(user);
  const csrfToken = setSessionCookies(res, token);
  return res.status(status).json({ success: true, message, csrfToken, user: userResponse(user) });
};

const getCsrfToken = (req, res) => {
  const csrfToken = setCsrfCookie(res);
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({ success: true, csrfToken });
};

const signup = async (req, res, next) => {
  try {
    const { name, email, password, role, inviteCode } = req.body || {};
    if (typeof name !== "string" || !name.trim() || name.trim().length > 100 ||
        typeof email !== "string" || email.trim().length > 254 || !EMAIL_PATTERN.test(email.trim()) ||
        typeof password !== "string" || password.length < 8 || password.length > 128 ||
        !VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, message: "Provide a valid name, email, password (8–128 characters) and account role" });
    }
    if (!roleRegistrationAllowed(role, inviteCode)) {
      return res.status(403).json({ success: false, message: `${role} accounts require a valid invitation code` });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) return res.status(409).json({ success: false, message: "An account with this email already exists" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name: name.trim(), email: normalizedEmail, passwordHash, role });
    return completeLogin(res, user, { status: 201, message: "Account created successfully" });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "An account with this email already exists" });
    return next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (typeof email !== "string" || email.trim().length > 254 || !EMAIL_PATTERN.test(email.trim()) ||
        typeof password !== "string" || !password || password.length > 128) {
      return res.status(400).json({ success: false, message: "A valid email and password are required" });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
    if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ success: false, message: "Invalid email or password" });
    }
    return completeLogin(res, user);
  } catch (error) {
    return next(error);
  }
};

const googleAuth = async (req, res, next) => {
  try {
    const { idToken, role, inviteCode } = req.body || {};
    if (typeof idToken !== "string" || !idToken || idToken.length > 10000) {
      return res.status(400).json({ success: false, message: "Google ID token is required" });
    }
    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(503).json({ success: false, message: "Google authentication is not configured" });
    }

    const ticket = await googleClient.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({ success: false, message: "Google account email must be verified" });
    }

    const email = payload.email.trim().toLowerCase();
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        if (!user.googleId) {
          user.googleId = payload.sub;
          await user.save();
        } else if (user.googleId !== payload.sub) {
          return res.status(409).json({ success: false, message: "This email is linked to another Google account" });
        }
      } else {
        if (!VALID_ROLES.includes(role)) return res.status(400).json({ success: false, message: "Choose a valid account role" });
        if (!roleRegistrationAllowed(role, inviteCode)) return res.status(403).json({ success: false, message: `${role} accounts require a valid invitation code` });
        user = await User.create({ name: String(payload.name || email.split("@")[0]).slice(0, 100), email, googleId: payload.sub, role });
      }
    }

    return completeLogin(res, user, { message: "Google authentication successful" });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, message: "Account already exists or Google account is linked" });
    if (error.message?.includes("Token used too late") || error.message?.includes("Invalid token") || error.name === "LoginTicketError") {
      return res.status(401).json({ success: false, message: "Invalid or expired Google token" });
    }
    return next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    // Incrementing tokenVersion revokes all existing bearer tokens and browser sessions for this account.
    await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
    clearSessionCookies(res);
    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return next(error);
  }
};

module.exports = { signup, login, googleAuth, logout, getCsrfToken };
