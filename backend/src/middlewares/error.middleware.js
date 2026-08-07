import ApiError from '../libs/ApiError.js';
import logger from '../libs/logger.js';
import config from '../config/index.js';
import { HTTP_STATUS } from '../constants/httpStatus.js';

/**
 * Convert unknown errors into a consistent JSON envelope.
 * Never leak stack traces or PHI in production responses.
 */
export const errorMiddleware = (err, req, res, _next) => {
  let statusCode = err.statusCode || HTTP_STATUS.INTERNAL_ERROR;
  let message = err.message || 'Internal server error';
  let code = err.code || 'INTERNAL_ERROR';
  let errors = err.errors || null;

  if (err.name === 'ZodError') {
    statusCode = HTTP_STATUS.UNPROCESSABLE;
    message = 'Validation failed';
    code = 'VALIDATION_ERROR';
    errors = err.errors?.map((e) => ({
      path: e.path?.join('.') || '',
      message: e.message,
    }));
  }

  if (err.name === 'CastError') {
    statusCode = HTTP_STATUS.BAD_REQUEST;
    message = 'Invalid identifier';
    code = 'INVALID_ID';
  }

  if (err.code === 11000) {
    statusCode = HTTP_STATUS.CONFLICT;
    message = 'Duplicate value';
    code = 'DUPLICATE';
  }

  const isOperational = err.isOperational ?? statusCode < 500;

  logger.error(message, {
    code,
    statusCode,
    path: req.originalUrl,
    method: req.method,
    requestId: req.requestId,
    stack: config.app.env === 'development' ? err.stack : undefined,
  });

  res.status(statusCode).json({
    success: false,
    message: isOperational ? message : 'Internal server error',
    code,
    errors,
    ...(config.app.env === 'development' && !isOperational
      ? { debug: err.message }
      : {}),
  });
};

export const notFoundMiddleware = (req, _res, next) => {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

export default errorMiddleware;
