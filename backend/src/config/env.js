import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_NAME: z.string().default('Aurah360ClinicOS'),
  APP_URL: z.string().url().default('http://localhost:5000'),
  PORT: z.coerce.number().default(5000),
  API_PREFIX: z.string().default('/api/v1'),
  TZ: z.string().default('Asia/Kolkata'),

  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1),

  REDIS_HOST: z.string().default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional().default(''),
  REDIS_DB: z.coerce.number().default(0),

  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  /** Patient portal JWT — separate from staff; defaults keep local .env working */
  PATIENT_JWT_ACCESS_SECRET: z.string().min(32).optional(),
  PATIENT_JWT_REFRESH_SECRET: z.string().min(32).optional(),
  PATIENT_JWT_ACCESS_EXPIRES_IN: z.string().default('30m'),
  PATIENT_JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  COOKIE_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  STORAGE_DRIVER: z.enum(['local', 's3', 'azure', 'gcs']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('./uploads'),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'http', 'debug']).default('info'),
  LOG_DIR: z.string().default('./logs'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(200),

  ENABLE_SWAGGER: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  CLINIC_NAME: z.string().default('Aurah 360'),
  CLINIC_DEFAULT_TIMEZONE: z.string().default('Asia/Kolkata'),
  CLINIC_DEFAULT_LOCALE: z.string().default('en'),

  /** Billing — discount above this percent of subtotal requires explicit approval before finalize. */
  BILLING_DISCOUNT_APPROVAL_THRESHOLD_PERCENT: z.coerce.number().default(20),

  /** AI clinical copilot gateway (Module 9) — provider-neutral; MOCK is safe default. */
  AI_PROVIDER: z.enum(['MOCK', 'OPENAI_COMPATIBLE', 'ANTHROPIC']).default('MOCK'),
  AI_API_KEY: z.string().optional().default(''),
  AI_API_BASE_URL: z.string().optional().default(''),
  AI_MODEL: z.string().default('mock-clinical-copilot-v1'),
  /** Anthropic provider — key is read from env only, never logged, never committed. */
  ANTHROPIC_API_KEY: z.string().optional().default(''),
  ANTHROPIC_MODEL: z.string().default('claude-sonnet-5'),
  AI_TIMEOUT_MS: z.coerce.number().default(8000),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().default(50),
  AI_ENABLED: z
    .string()
    .default('true')
    .transform((v) => v !== 'false'),

  /** Notification providers — default MOCK; set to real provider when credentials exist. */
  WHATSAPP_PROVIDER: z.enum(['MOCK', 'WHATSAPP_CLOUD']).default('MOCK'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().optional().default(''),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional().default(''),
  WHATSAPP_APP_SECRET: z.string().optional().default(''),

  SMS_PROVIDER: z.enum(['MOCK', 'HTTP_DLT', 'BULKSENDERS']).default('MOCK'),
  SMS_DLT_PRINCIPAL_ENTITY_ID: z.string().optional().default(''),
  SMS_DLT_SENDER_HEADER: z.string().optional().default(''),
  SMS_API_URL: z.string().optional().default(''),
  SMS_API_KEY: z.string().optional().default(''),
  /** BulkSenders.in DLT gateway — GET-based API, used when SMS_PROVIDER=BULKSENDERS. */
  SMS_BULKSENDERS_BASE_URL: z.string().optional().default('https://login.bulksenders.in/app/smsapi/index.php'),
  SMS_BULKSENDERS_API_KEY: z.string().optional().default(''),
  SMS_BULKSENDERS_CAMPAIGN: z.string().optional().default(''),
  SMS_BULKSENDERS_ROUTE_ID: z.string().optional().default(''),
  SMS_BULKSENDERS_SENDER_ID: z.string().optional().default(''),
  SMS_BULKSENDERS_TEMPLATE_ID: z.string().optional().default(''),
  SMS_BULKSENDERS_PE_ID: z.string().optional().default(''),
  /**
   * BulkSenders.in does not support outbound webhook request signing (no HMAC/signature
   * scheme is documented or configurable for its delivery callbacks) — the next-best
   * mitigation is a shared-secret verification token the callback URL must carry
   * (e.g. `?token=<SMS_WEBHOOK_SECRET>`), checked in NotificationWebhookController#sms.
   */
  SMS_WEBHOOK_SECRET: z.string().optional().default(''),

  VOICE_PROVIDER: z.enum(['MOCK', 'EXOTEL']).default('MOCK'),
  VOICE_EXOTEL_SID: z.string().optional().default(''),
  VOICE_EXOTEL_TOKEN: z.string().optional().default(''),
  VOICE_EXOTEL_CALLER_ID: z.string().optional().default(''),
  /**
   * Exotel's own callback signature scheme isn't confirmed against code/config already
   * present in this repo, so we apply the same shared-secret token fallback used for SMS:
   * the configured callback URL must carry `?token=<VOICE_WEBHOOK_SECRET>`, checked in
   * NotificationWebhookController#voice.
   */
  VOICE_WEBHOOK_SECRET: z.string().optional().default(''),
  VOICE_QUIET_HOURS_START: z.string().default('21:00'),
  VOICE_QUIET_HOURS_END: z.string().default('08:00'),

  EMAIL_PROVIDER: z.enum(['MOCK', 'SMTP']).default('MOCK'),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_FROM: z.string().optional().default(''),

  PUSH_PROVIDER: z.enum(['MOCK', 'FCM']).default('MOCK'),
  FCM_SERVER_KEY: z.string().optional().default(''),

  /** Staff MFA / step-up (SEC-002) */
  MFA_ISSUER: z.string().default('Aurah 360 ClinicOS'),
  MFA_REQUIRED_ROLES: z.string().default('OWNER,ADMIN,BRANCH_MANAGER'),
  STEP_UP_TTL_MINUTES: z.coerce.number().default(10),
  BREAK_GLASS_TTL_MINUTES: z.coerce.number().default(30),

  /** Retention / privacy defaults (PRV-003) */
  AUDIT_LOG_RETENTION_DAYS: z.coerce.number().default(2555), // ~7 years
  DEFAULT_DOCUMENT_RETENTION_DAYS: z.coerce.number().default(3650),
  DEFAULT_PHOTO_RETENTION_DAYS: z.coerce.number().default(3650),

  /** Patient app deep-link base (used in secure manage links) */
  PATIENT_APP_URL: z.string().optional().default('https://app.aurah360.local'),

  /** Short-lived signed file-access tokens (FileAccessController) — separate secret from JWT; defaults keep local .env working. */
  FILE_TOKEN_SECRET: z.string().min(32).optional(),
  FILE_TOKEN_TTL_MINUTES: z.coerce.number().default(10),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const data = parsed.data;

/** Production defaults when flags are omitted from the environment. */
const enableSwagger =
  data.NODE_ENV === 'production' && process.env.ENABLE_SWAGGER === undefined
    ? false
    : data.ENABLE_SWAGGER;

if (data.NODE_ENV === 'production' && !data.COOKIE_SECURE) {
  console.warn(
    '⚠️  COOKIE_SECURE is false in production — set COOKIE_SECURE=true behind HTTPS.'
  );
}

export const env = {
  ...data,
  ENABLE_SWAGGER: enableSwagger,
  PATIENT_JWT_ACCESS_SECRET:
    data.PATIENT_JWT_ACCESS_SECRET || `${data.JWT_ACCESS_SECRET}::patient-access`,
  PATIENT_JWT_REFRESH_SECRET:
    data.PATIENT_JWT_REFRESH_SECRET || `${data.JWT_REFRESH_SECRET}::patient-refresh`,
  FILE_TOKEN_SECRET: data.FILE_TOKEN_SECRET || `${data.JWT_ACCESS_SECRET}::file-token`,
  isDev: data.NODE_ENV === 'development',
  isProd: data.NODE_ENV === 'production',
  isTest: data.NODE_ENV === 'test',
  corsOrigins: data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean),
  mfaRequiredRoles: data.MFA_REQUIRED_ROLES.split(',').map((r) => r.trim()).filter(Boolean),
};

export default env;
