import Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  LOG_LEVEL: Joi.string().valid('fatal', 'error', 'warn', 'info', 'debug', 'trace').default('info'),
  MONGODB_URI: Joi.string()
    .pattern(/^mongodb(\+srv)?:\/\/.+/)
    .default('mongodb://localhost:27017/vehicles')
    .messages({
      'string.pattern.base':
        '"MONGODB_URI" must be a mongodb:// or mongodb+srv:// connection string',
    }),
  NHTSA_API_BASE_URL: Joi.string().uri().default('https://vpic.nhtsa.dot.gov/api/vehicles'),
  NHTSA_TIMEOUT_MS: Joi.number().integer().min(1).default(10000),
  NHTSA_MAX_RETRIES: Joi.number().integer().min(0).default(3),
  NHTSA_RETRY_DELAY_MS: Joi.number().integer().min(0).default(500),
  NHTSA_CONCURRENCY: Joi.number().integer().min(1).max(50).default(10),
  INGEST_MAKES_LIMIT: Joi.number().integer().min(0).default(0),
});
