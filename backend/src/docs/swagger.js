import swaggerUi from 'swagger-ui-express';
import config from '../config/index.js';
import { openApiSpec } from './openapi.js';
import logger from '../libs/logger.js';

/**
 * Mount Swagger UI at /api/v1/docs when enabled.
 * Disable in locked-down production by setting ENABLE_SWAGGER=false.
 */
export function mountSwagger(app) {
  if (!config.swagger.enabled) {
    logger.info('Swagger UI disabled');
    return;
  }

  const docsPath = `${config.app.apiPrefix}/docs`;
  app.use(docsPath, swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    customSiteTitle: `${config.clinic.name} API Docs`,
    swaggerOptions: { persistAuthorization: true },
  }));

  app.get(`${config.app.apiPrefix}/openapi.json`, (_req, res) => {
    res.json(openApiSpec);
  });

  logger.info('Swagger UI mounted', { path: docsPath });
}

export default mountSwagger;
