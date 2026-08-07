import express from 'express';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import config from './config/index.js';
import routes from './routes/index.js';
import { requestIdMiddleware } from './middlewares/requestId.middleware.js';
import { errorMiddleware, notFoundMiddleware } from './middlewares/error.middleware.js';
import {
  securityHeaders,
  mongoInjectionProtection,
  parameterPollutionProtection,
  globalRateLimiter,
  sanitizeRequest,
} from './middlewares/security.middleware.js';
import { csrfProtection } from './middlewares/csrf.middleware.js';
import { mountSwagger } from './docs/swagger.js';
import logger from './libs/logger.js';

class App {
  constructor() {
    this.app = express();
    this.#setupMiddlewares();
    this.#setupRoutes();
    this.#setupErrorHandling();
  }

  #setupMiddlewares() {
    this.app.set('trust proxy', 1);

    this.app.use(requestIdMiddleware);
    this.app.use(securityHeaders());
    this.app.use(
      cors({
        origin: config.cors.origins,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        // X-CSRF-Token: added by the frontend's axios interceptor (Task #41) on every
        // cookie-authenticated state-changing request — without it here, the browser's
        // CORS preflight rejects the actual request before it ever reaches csrf.middleware.js.
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'X-CSRF-Token'],
      })
    );
    this.app.use(compression());
    // rawBody is retained for webhook signature verification (WhatsApp Cloud, etc.).
    this.app.use(
      express.json({
        limit: '2mb',
        verify: (req, _res, buf) => {
          req.rawBody = buf;
        },
      })
    );
    this.app.use(express.urlencoded({ extended: true, limit: '2mb' }));
    this.app.use(cookieParser());
    this.app.use(csrfProtection);
    this.app.use(mongoInjectionProtection());
    this.app.use(parameterPollutionProtection());
    this.app.use(sanitizeRequest);
    this.app.use(globalRateLimiter());

    if (config.app.env !== 'test') {
      this.app.use(
        morgan('combined', {
          stream: {
            write: (message) => logger.http(message.trim()),
          },
        })
      );
    }

    // RC1 finding B1 (P0): patient files are never served from a public static mount.
    // All reads go through the permission-checked, audited routes in `routes/v1/files.routes.js`.
  }

  #setupRoutes() {
    this.app.get('/', (_req, res) => {
      res.json({
        success: true,
        message: `${config.clinic.name} ClinicOS API`,
        data: {
          version: 'v1',
          docs: `${config.app.apiPrefix}/docs`,
          health: `${config.app.apiPrefix}/health`,
        },
      });
    });

    mountSwagger(this.app);
    this.app.use(routes);
  }

  #setupErrorHandling() {
    this.app.use(notFoundMiddleware);
    this.app.use(errorMiddleware);
  }

  getExpressApp() {
    return this.app;
  }
}

export default App;
