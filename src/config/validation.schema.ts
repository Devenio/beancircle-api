import * as Joi from 'joi';

export const validationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  PORT: Joi.number().default(3001),

  DATABASE_URL: Joi.string().uri().required(),
  REDIS_URL: Joi.string().uri().required(),

  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  FRONTEND_URL: Joi.when('NODE_ENV', {
    is: 'production',
    then: Joi.string().uri().required(),
    otherwise: Joi.string().uri().default('http://localhost:3000'),
  }),

  // Google OAuth — optional
  GOOGLE_CLIENT_ID: Joi.string().allow('').optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('').optional(),
  GOOGLE_CALLBACK_URL: Joi.string().uri().optional(),

  // SMS
  SMS_PROVIDER: Joi.string().default('mock'),
  SMSIR_API_KEY: Joi.string().allow('').optional(),
  SMSIR_LINE_NUMBER: Joi.number().optional(),
  SMSIR_OTP_TEMPLATE_ID: Joi.number().optional(),

  // Object storage (R2 / MinIO)
  R2_ENDPOINT: Joi.string().uri().required(),
  R2_ACCESS_KEY_ID: Joi.string().required(),
  R2_SECRET_ACCESS_KEY: Joi.string().required(),
  R2_BUCKET: Joi.string().required(),
  R2_PUBLIC_URL: Joi.string().uri().required(),

  // Payments
  PAYMENT_PROVIDER: Joi.string().default('mock'),
  GIFT_WEBHOOK_SECRET: Joi.string().allow('').optional(),

  // Web Push (VAPID)
  VAPID_SUBJECT: Joi.string().default('mailto:hello@beancircle.app'),
  VAPID_PUBLIC_KEY: Joi.string().allow('').optional(),
  VAPID_PRIVATE_KEY: Joi.string().allow('').optional(),

  // AI bug triage (optional). When ANTHROPIC_API_KEY is absent the triage
  // service falls back to a deterministic heuristic.
  ANTHROPIC_API_KEY: Joi.string().allow('').optional(),
  BUG_TRIAGE_MODEL: Joi.string().default('claude-haiku-4-5'),
});
