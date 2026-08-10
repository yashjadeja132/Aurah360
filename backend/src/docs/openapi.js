import config from '../config/index.js';

/** OpenAPI 3.0 document for ClinicOS API (Module 19). */
export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: `${config.clinic.name} ClinicOS API`,
    version: '1.0.0',
    description:
      'Production API for Aurah 360 ClinicOS. Versioned under `/api/v1`. Authenticate with Bearer JWT.',
  },
  servers: [
    { url: config.app.apiPrefix, description: 'Current API prefix' },
    { url: '/api/v1', description: 'Default local' },
  ],
  tags: [
    { name: 'Health' },
    { name: 'Auth' },
    { name: 'Analytics' },
    { name: 'Reports' },
    { name: 'Patient Portal' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      ApiSuccess: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string' },
          data: {},
        },
      },
      ApiError: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string' },
          code: { type: 'string' },
          errors: { type: 'array', items: { type: 'object' } },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Full health (Mongo, Redis, BullMQ, metrics)',
        responses: { 200: { description: 'OK or degraded' }, 503: { description: 'Down' } },
      },
    },
    '/health/livez': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        responses: { 200: { description: 'Process alive' } },
      },
    },
    '/health/readyz': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe (Mongo + Redis)',
        responses: { 200: { description: 'Ready' }, 503: { description: 'Not ready' } },
      },
    },
    '/health/healthz': {
      get: {
        tags: ['Health'],
        summary: 'Healthz alias',
        responses: { 200: { description: 'OK' }, 503: { description: 'Down' } },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Staff login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Access + refresh tokens' },
          401: { description: 'Invalid credentials' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate refresh token',
        responses: { 200: { description: 'New token pair' } },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Revoke refresh token',
        responses: { 200: { description: 'Logged out' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        summary: 'Current staff user',
        responses: { 200: { description: 'Profile' } },
      },
    },
    '/analytics/dashboard': {
      get: {
        tags: ['Analytics'],
        security: [{ bearerAuth: [] }],
        summary: 'Executive dashboard KPIs',
        responses: { 200: { description: 'Widgets' } },
      },
    },
    '/analytics/reports/{category}': {
      get: {
        tags: ['Analytics'],
        security: [{ bearerAuth: [] }],
        summary: 'Category analytics report',
        parameters: [
          {
            name: 'category',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
              enum: [
                'appointments',
                'patients',
                'doctors',
                'treatments',
                'billing',
                'inventory',
                'crm',
                'ai',
              ],
            },
          },
        ],
        responses: { 200: { description: 'Report payload' } },
      },
    },
    '/reports/dashboards/{type}': {
      get: {
        tags: ['Reports'],
        security: [{ bearerAuth: [] }],
        summary: 'Role dashboard (Module 16)',
        parameters: [
          { name: 'type', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: { 200: { description: 'Dashboard' } },
      },
    },
    '/audit/entries': {
      get: {
        tags: ['Audit'],
        security: [{ bearerAuth: [] }],
        summary: 'Search the audit trail (NFR-018)',
        description:
          'Requires `audit.view`. Results are pinned to the caller\'s branch unless they hold a '
          + 'global scope (OWNER/ADMIN), sorted newest first, and paginated. Entry `metadata` is '
          + 'REDACTED by default because it can contain PHI; `includeMetadata=true` additionally '
          + 'requires `audit.metadata_view` and is refused (403) without it. Every search is '
          + 'itself recorded as an AUDIT_LOG_SEARCHED entry.',
        parameters: [
          { name: 'action', in: 'query', schema: { type: 'string' } },
          { name: 'actorId', in: 'query', schema: { type: 'string' } },
          { name: 'targetUserId', in: 'query', schema: { type: 'string' } },
          { name: 'patientId', in: 'query', schema: { type: 'string' } },
          { name: 'resourceType', in: 'query', schema: { type: 'string' } },
          { name: 'resourceId', in: 'query', schema: { type: 'string' } },
          { name: 'correlationId', in: 'query', schema: { type: 'string' } },
          { name: 'branchId', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
          { name: 'includeMetadata', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          200: { description: 'Audit entries + pagination meta' },
          403: { description: 'No audit.view, out-of-scope branch, or metadata not permitted' },
        },
      },
    },
    '/patient/login': {
      post: {
        tags: ['Patient Portal'],
        summary: 'Patient portal login',
        responses: { 200: { description: 'Patient tokens' } },
      },
    },
  },
};

export default openApiSpec;
