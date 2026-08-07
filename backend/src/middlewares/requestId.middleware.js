import { randomUUID } from 'crypto';

/**
 * Attaches a correlation id to every request for PHI-safe tracing.
 */
export const requestIdMiddleware = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  req.requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

export default requestIdMiddleware;
