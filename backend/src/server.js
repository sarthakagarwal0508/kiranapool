require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = Number(process.env.PORT) || 5000;

const startServer = async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error("JWT_SECRET is required and must be at least 32 characters. Generate a new secret before starting the API.");
  }
  if (process.env.NODE_ENV === "production" && process.env.COOKIE_SECURE === "false") {
    throw new Error("COOKIE_SECURE must be true in production.");
  }
  if (String(process.env.COOKIE_SAME_SITE || "").toLowerCase() === "none" && process.env.COOKIE_SECURE === "false") {
    throw new Error("COOKIE_SAME_SITE=None requires COOKIE_SECURE=true.");
  }

  // Do not report a healthy/listening API while the database is unavailable.
  await connectDB();
  const server = app.listen(PORT, () => {
    console.log(`KiranaPool API listening on port ${PORT}`);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`${signal} received; closing HTTP server`);
    server.close((error) => {
      if (error) {
        console.error("HTTP server shutdown failed:", error.message);
        process.exitCode = 1;
      }
      process.exit();
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

startServer().catch((error) => {
  console.error("KiranaPool API failed to start:", error.message);
  process.exitCode = 1;
});
