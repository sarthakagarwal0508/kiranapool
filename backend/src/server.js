require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  const server = app.listen(PORT, () => {
    console.log(`KiranaPool API running on port ${PORT}`);
  });

  try {
    await connectDB();
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
  }

  const shutdown = () => {
    server.close(() => {
      console.log("HTTP server closed");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

startServer();