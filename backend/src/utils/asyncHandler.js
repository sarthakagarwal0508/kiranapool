// Express 5 already forwards rejected async handlers, but this helper keeps
// controller wrapping consistent for any Express 4-compatible integrations.
module.exports = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
