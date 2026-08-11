import { env } from './env.js';

/**
 * Central application configuration.
 * Never hardcode runtime values in services/controllers — use this module.
 */
export const config = Object.freeze({
  app: {
    name: env.APP_NAME,
    url: env.APP_URL,
    port: env.PORT,
    apiPrefix: env.API_PREFIX,
    env: env.NODE_ENV,
    timezone: env.TZ,
  },
  clinic: {
    name: env.CLINIC_NAME,
    defaultTimezone: env.CLINIC_DEFAULT_TIMEZONE,
    defaultLocale: env.CLINIC_DEFAULT_LOCALE,
  },
  billing: {
    discountApprovalThresholdPercent: env.BILLING_DISCOUNT_APPROVAL_THRESHOLD_PERCENT,
    refundApprovalThresholdAmount: env.BILLING_REFUND_APPROVAL_THRESHOLD_AMOUNT,
    cashCloseVarianceEscalationThresholdAmount: env.BILLING_CASH_CLOSE_VARIANCE_ESCALATION_THRESHOLD_AMOUNT,
  },
  inventory: {
    adjustmentApprovalThresholdQuantity: env.INVENTORY_ADJUSTMENT_APPROVAL_THRESHOLD_QUANTITY,
    adjustmentApprovalThresholdValueInr: env.INVENTORY_ADJUSTMENT_APPROVAL_THRESHOLD_VALUE_INR,
  },
  cors: {
    origins: env.corsOrigins,
  },
  mongo: {
    uri: env.MONGODB_URI,
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
    db: env.REDIS_DB,
  },
  jwt: {
    accessSecret: env.JWT_ACCESS_SECRET,
    refreshSecret: env.JWT_REFRESH_SECRET,
    accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
  },
  patientJwt: {
    accessSecret: env.PATIENT_JWT_ACCESS_SECRET,
    refreshSecret: env.PATIENT_JWT_REFRESH_SECRET,
    accessExpiresIn: env.PATIENT_JWT_ACCESS_EXPIRES_IN,
    refreshExpiresIn: env.PATIENT_JWT_REFRESH_EXPIRES_IN,
  },
  cookie: {
    secure: env.COOKIE_SECURE,
    sameSite: env.COOKIE_SAME_SITE,
  },
  storage: {
    driver: env.STORAGE_DRIVER,
    localPath: env.STORAGE_LOCAL_PATH,
  },
  logging: {
    level: env.LOG_LEVEL,
    dir: env.LOG_DIR,
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
  },
  swagger: {
    enabled: Boolean(env.ENABLE_SWAGGER),
  },
  ai: {
    enabled: env.AI_ENABLED,
    provider: env.AI_PROVIDER,
    apiKey: env.AI_API_KEY,
    apiBaseUrl: env.AI_API_BASE_URL,
    model: env.AI_MODEL,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    anthropicModel: env.ANTHROPIC_MODEL,
    geminiApiKey: env.GEMINI_API_KEY,
    geminiModel: env.GEMINI_MODEL,
    timeoutMs: env.AI_TIMEOUT_MS,
    monthlyBudgetUsd: env.AI_MONTHLY_BUDGET_USD,
  },
  notificationProviders: {
    whatsapp: {
      provider: env.WHATSAPP_PROVIDER,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      accessToken: env.WHATSAPP_ACCESS_TOKEN,
      webhookVerifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
      appSecret: env.WHATSAPP_APP_SECRET,
    },
    sms: {
      provider: env.SMS_PROVIDER,
      dltPrincipalEntityId: env.SMS_DLT_PRINCIPAL_ENTITY_ID,
      dltSenderHeader: env.SMS_DLT_SENDER_HEADER,
      apiUrl: env.SMS_API_URL,
      apiKey: env.SMS_API_KEY,
      webhookSecret: env.SMS_WEBHOOK_SECRET,
      // BulkSenders.in DLT gateway (GET-based API) — used when SMS_PROVIDER=BULKSENDERS.
      bulkSenders: {
        baseUrl: env.SMS_BULKSENDERS_BASE_URL,
        apiKey: env.SMS_BULKSENDERS_API_KEY,
        campaign: env.SMS_BULKSENDERS_CAMPAIGN,
        routeId: env.SMS_BULKSENDERS_ROUTE_ID,
        senderId: env.SMS_BULKSENDERS_SENDER_ID,
        templateId: env.SMS_BULKSENDERS_TEMPLATE_ID,
        peId: env.SMS_BULKSENDERS_PE_ID,
      },
    },
    voice: {
      provider: env.VOICE_PROVIDER,
      exotelSid: env.VOICE_EXOTEL_SID,
      exotelToken: env.VOICE_EXOTEL_TOKEN,
      callerId: env.VOICE_EXOTEL_CALLER_ID,
      quietHoursStart: env.VOICE_QUIET_HOURS_START,
      quietHoursEnd: env.VOICE_QUIET_HOURS_END,
      webhookSecret: env.VOICE_WEBHOOK_SECRET,
    },
    email: {
      provider: env.EMAIL_PROVIDER,
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from: env.SMTP_FROM,
    },
    push: {
      provider: env.PUSH_PROVIDER,
      fcmServerKey: env.FCM_SERVER_KEY,
    },
  },
  security: {
    mfaIssuer: env.MFA_ISSUER,
    mfaRequiredRoles: env.mfaRequiredRoles,
    stepUpTtlMinutes: env.STEP_UP_TTL_MINUTES,
    breakGlassTtlMinutes: env.BREAK_GLASS_TTL_MINUTES,
    fileTokenSecret: env.FILE_TOKEN_SECRET,
    fileTokenTtlMinutes: env.FILE_TOKEN_TTL_MINUTES,
  },
  retention: {
    auditLogDays: env.AUDIT_LOG_RETENTION_DAYS,
    documentDays: env.DEFAULT_DOCUMENT_RETENTION_DAYS,
    photoDays: env.DEFAULT_PHOTO_RETENTION_DAYS,
  },
  patientApp: {
    url: env.PATIENT_APP_URL,
  },
});

export default config;
