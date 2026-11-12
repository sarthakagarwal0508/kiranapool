const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  let status = Number(error.statusCode || error.status) || 500;
  let message = "Internal server error";

  if (error.type === "entity.parse.failed" || error instanceof SyntaxError && error.status === 400) {
    status = 400;
    message = "Invalid JSON request body";
  } else if (error.name === "ValidationError" || error.name === "CastError") {
    status = 400;
    message = error.name === "CastError" ? "Invalid resource identifier or value" : "Request validation failed";
  } else if (error.code === 11000) {
    status = 409;
    message = "A record with this value already exists";
  } else if (error.message === "Not allowed by CORS") {
    status = 403;
    message = "Origin is not allowed";
  } else if (status >= 400 && status < 500) {
    message = error.publicMessage || error.message || "Request failed";
  }

  const requestId = req.requestId || "unknown";
  if (status >= 500) {
    // Keep request data, cookies and authorization headers out of logs.
    console.error(`[${requestId}] ${error.name || "Error"}: ${error.message || "Unknown error"}`);
  }

  return res.status(status).json({ success: false, message, requestId });
};

const notFoundHandler = (req, res) => res.status(404).json({
  success: false,
  message: "Route not found",
  requestId: req.requestId || "unknown",
});

module.exports = { errorHandler, notFoundHandler };
