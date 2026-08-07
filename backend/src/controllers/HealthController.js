import ApiResponse from '../libs/ApiResponse.js';
import asyncHandler from '../libs/asyncHandler.js';
import HealthService from '../services/HealthService.js';

class HealthController {
  constructor() {
    this.service = new HealthService();
  }

  /** Liveness — process is running (no dependency checks). */
  livez = asyncHandler(async (_req, res) => {
    return ApiResponse.success(res, {
      message: 'Alive',
      data: this.service.isAlive(),
    });
  });

  /** Readiness — Mongo + Redis must be up. */
  readyz = asyncHandler(async (_req, res) => {
    const data = await this.service.readiness();
    return ApiResponse.success(res, {
      statusCode: data.ready ? 200 : 503,
      message: data.ready ? 'Ready' : 'Not ready',
      data,
    });
  });

  /** Alias for orchestrators expecting /healthz */
  healthz = asyncHandler(async (_req, res) => {
    const data = await this.service.fullHealth();
    const ok = data.status !== 'down';
    return ApiResponse.success(res, {
      statusCode: ok ? 200 : 503,
      message: ok ? 'OK' : 'Down',
      data,
    });
  });

  /** Detailed health (backward compatible with Module 1). */
  check = asyncHandler(async (_req, res) => {
    const data = await this.service.fullHealth();
    const ok = data.status !== 'down';
    return ApiResponse.success(res, {
      statusCode: ok ? 200 : 503,
      message: ok ? 'OK' : 'Degraded',
      data,
    });
  });
}

export default HealthController;
