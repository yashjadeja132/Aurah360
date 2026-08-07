/**
 * Wraps async route handlers so rejected promises reach the error middleware.
 * @param {(req, res, next) => Promise<any>} fn
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;
