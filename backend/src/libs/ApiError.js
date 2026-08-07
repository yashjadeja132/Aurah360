class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {object} [options]
   * @param {string} [options.code]
   * @param {Array|object|null} [options.errors]
   * @param {boolean} [options.isOperational]
   */
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = options.code || 'INTERNAL_ERROR';
    this.errors = options.errors ?? null;
    this.isOperational = options.isOperational ?? true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = 'Bad request', errors = null, code = 'BAD_REQUEST') {
    return new ApiError(400, message, { code, errors });
  }

  static unauthorized(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    return new ApiError(401, message, { code });
  }

  static forbidden(message = 'Forbidden', code = 'FORBIDDEN') {
    return new ApiError(403, message, { code });
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new ApiError(404, message, { code });
  }

  static conflict(message = 'Conflict', code = 'CONFLICT') {
    return new ApiError(409, message, { code });
  }

  static validation(message = 'Validation failed', errors = null) {
    return new ApiError(422, message, { code: 'VALIDATION_ERROR', errors });
  }

  static tooManyRequests(message = 'Too many requests') {
    return new ApiError(429, message, { code: 'RATE_LIMITED' });
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, { code: 'INTERNAL_ERROR', isOperational: false });
  }
}

export default ApiError;
