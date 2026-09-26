/**
 * Wraps an async route handler so errors propagate to Express error handler
 * without try/catch boilerplate on every route.
 */
const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
