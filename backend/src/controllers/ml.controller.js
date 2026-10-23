const { callMlEndpoint } = require("../services/ml.service");

const proxyEndpoint = ({ path, method = "POST", timeoutMs, validate }) => async (req, res) => {
  try {
    if (validate) {
      const validationMessage = validate(req.body);
      if (validationMessage) return res.status(400).json({ success: false, message: validationMessage });
    }
    const result = await callMlEndpoint({
      path,
      method,
      ...(method === "POST" ? { requestBody: req.body ?? {} } : {}),
      timeoutMs: timeoutMs || Number(process.env.ML_ROUTE_TIMEOUT_MS) || 15000,
    });
    return res.status(result.status).json(result.data ?? {});
  } catch (error) {
    let status = [400, 503, 504].includes(error.statusCode) ? error.statusCode : 502;
    if (error.upstreamStatus === 422 || error.upstreamStatus === 400) status = 400;
    return res.status(status).json({
      success: false,
      message: error.message || "ML service request failed",
      code: error.code || "ML_SERVICE_ERROR",
      ...(error.upstreamStatus ? { upstreamStatus: error.upstreamStatus } : {}),
    });
  }
};
const mustHaveArray = (field) => (body) => Array.isArray(body?.[field]) ? null : `${field} must be an array`;
const mustHaveObject = (body) => body && typeof body === "object" && !Array.isArray(body) ? null : "Request body must be a JSON object";

const mlHealth = proxyEndpoint({ path: "/health", method: "GET", timeoutMs: 5000 });
const rawRoute = proxyEndpoint({ path: "/route", validate: mustHaveArray("orders") });
const planRoute = proxyEndpoint({ path: "/routes/plan", validate: mustHaveArray("orders") });
const solveRoute = proxyEndpoint({ path: "/routes/solve", validate: mustHaveArray("stops") });
const batchOrders = proxyEndpoint({ path: "/batch", validate: mustHaveArray("orders") });
const estimateTravelTime = proxyEndpoint({ path: "/travel-time", validate: mustHaveObject });
const calculateEconomics = proxyEndpoint({ path: "/economics/costs", validate: mustHaveObject });
module.exports = { mlHealth, rawRoute, planRoute, solveRoute, batchOrders, estimateTravelTime, calculateEconomics };
