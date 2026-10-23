const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { role: user.role },
    process.env.JWT_SECRET,
    {
      subject: user._id.toString(),
      expiresIn: process.env.JWT_EXPIRES_IN || "1d",
    }
  );
};

const userResponse = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
});

const signup = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof email !== "string" ||
      typeof password !== "string" ||
      password.length < 8 ||
      !["shopkeeper", "rider"].includes(role)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, valid email, password (minimum 8 characters) and role (shopkeeper/rider) are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
    });

    const token = createToken(user);

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token,
      user: userResponse(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== "string" ||
      typeof password !== "string" ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
    }).select("+passwordHash");

    if (
      !user ||
      !user.passwordHash ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: userResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

const googleAuth = async (req, res, next) => {
  try {
    const { idToken, role } = req.body;

    if (typeof idToken !== "string" || !idToken) {
      return res.status(400).json({
        success: false,
        message: "Google ID token is required",
      });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({
        success: false,
        message: "Google authentication is not configured",
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || payload.email_verified !== true) {
      return res.status(401).json({
        success: false,
        message: "Google account email must be verified",
      });
    }

    const email = payload.email.toLowerCase();
    let user = await User.findOne({ googleId: payload.sub });

    if (!user) {
      user = await User.findOne({ email });

      if (user) {
        // Link only when Google's verified email matches the account.
        if (!user.googleId) {
          user.googleId = payload.sub;
          await user.save();
        } else if (user.googleId !== payload.sub) {
          return res.status(409).json({
            success: false,
            message: "This email is linked to another Google account",
          });
        }
      } else {
        if (!["shopkeeper", "rider"].includes(role)) {
          return res.status(400).json({
            success: false,
            message: "Choose role: shopkeeper or rider",
          });
        }

        user = await User.create({
          name: payload.name || email.split("@")[0],
          email,
          googleId: payload.sub,
          role,
        });
      }
    }

    const token = createToken(user);

    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      token,
      user: userResponse(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Account already exists or Google account is linked",
      });
    }

    if (error.message?.includes("Token used too late") ||
        error.message?.includes("Invalid token")) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired Google token",
      });
    }

    next(error);
  }
};

module.exports = {
  signup,
  login,
  googleAuth,
};