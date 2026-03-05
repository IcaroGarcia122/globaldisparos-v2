/**
 * Environment Variables Validation
 * Validates and types all env vars using dotenv-safe
 */

import dotenvSafe from 'dotenv-safe';
import path from 'path';

// Load and validate environment variables
dotenvSafe.config({
  path: path.resolve(__dirname, '../../.env'),
  example: path.resolve(__dirname, '../../.env.example'),
  allowEmptyValues: true,
  sample: path.resolve(__dirname, '../../.env.example'),
});

interface EnvConfig {
  // Server
  nodeEnv: 'development' | 'production' | 'staging' | 'test';
  port: number;
  host: string;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
  enableRequestLogging: boolean;

  // Database
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbDialect: 'postgres';
  dbSSL: boolean;
  dbPoolMin: number;
  dbPoolMax: number;
  dbPoolIdleTimeout: number;

  // JWT
  jwtSecret: string;
  jwtRefreshSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;

  // Redis
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDB: number;
  redisTTL: number;

  // CORS
  frontendUrl: string;
  corsOrigins: string[];
  corsCredentials: boolean;

  // Rate Limiting
  rateLimitWindowMs: number;
  rateLimitMaxRequests: number;

  // Security
  helmetEnabled: boolean;
  securityHeadersEnabled: boolean;
  csrfProtectionEnabled: boolean;

  // WhatsApp
  whatsappAdapter: 'evolution';
  authSessionsDir: string;
  evolutionApiUrl?: string;
  evolutionApiKey?: string;

  // Sentry
  sentryDSN?: string;
  sentryEnvironment: string;
  sentryTracesSampleRate: number;
  sentryEnabled: boolean;

  // Backups
  backupEnabled: boolean;
  backupSchedule: string;
  awsS3Bucket?: string;
  awsS3Region?: string;
  awsS3AccessKey?: string;
  awsS3SecretKey?: string;

  // Files
  uploadsDir: string;
  maxFileSize: number;

  // Admin
  adminEmail: string;
  adminPassword: string;
}

const getEnvBoolean = (value: string | undefined, defaultValue: boolean): boolean => {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

const getEnvNumber = (value: string | undefined, defaultValue: number): number => {
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
};

const parseCorsOrigins = (value: string): string[] => {
  if (!value) return [];
  return value.split(',').map((origin) => origin.trim());
};

const envConfig: EnvConfig = {
  // Server
  nodeEnv: (process.env.NODE_ENV as any) || 'production',
  port: getEnvNumber(process.env.PORT, 3001),
  host: process.env.HOST || '0.0.0.0',
  logLevel: (process.env.LOG_LEVEL as any) || 'info',
  enableRequestLogging: getEnvBoolean(process.env.ENABLE_REQUEST_LOGGING, true),

  // Database
  dbHost: process.env.DB_HOST || 'localhost',
  dbPort: getEnvNumber(process.env.DB_PORT, 5432),
  dbName: process.env.DB_NAME || 'globaldisparos',
  dbUser: process.env.DB_USER || 'postgres',
  dbPassword: process.env.DB_PASSWORD || 'postgres',
  dbDialect: 'postgres',
  dbSSL: getEnvBoolean(process.env.DB_SSL, process.env.NODE_ENV === 'production'),
  dbPoolMin: getEnvNumber(process.env.DB_POOL_MIN, 2),
  dbPoolMax: getEnvNumber(process.env.DB_POOL_MAX, 20),
  dbPoolIdleTimeout: getEnvNumber(process.env.DB_POOL_IDLE_TIMEOUT, 30000),

  // JWT
  jwtSecret: process.env.JWT_SECRET || 'change-this-secret-key-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRY || '7d',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || process.env.JWT_REFRESH_EXPIRY || '30d',

  // Redis
  redisHost: process.env.REDIS_HOST && process.env.REDIS_HOST.trim() ? process.env.REDIS_HOST : undefined,
  redisPort: getEnvNumber(process.env.REDIS_PORT, 6379),
  redisPassword: process.env.REDIS_PASSWORD,
  redisDB: getEnvNumber(process.env.REDIS_DB, 0),
  redisTTL: getEnvNumber(process.env.REDIS_TTL, 3600), // 1 hour

  // CORS
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS || 'http://localhost:5173'),
  corsCredentials: getEnvBoolean(process.env.CORS_CREDENTIALS, true),

  // Rate Limiting
  rateLimitWindowMs: getEnvNumber(process.env.RATE_LIMIT_WINDOW_MS, 900000), // 15 min
  rateLimitMaxRequests: getEnvNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),

  // Security
  helmetEnabled: getEnvBoolean(process.env.HELMET_ENABLED, true),
  securityHeadersEnabled: getEnvBoolean(process.env.SECURITY_HEADERS_ENABLED, true),
  csrfProtectionEnabled: getEnvBoolean(process.env.CSRF_PROTECTION_ENABLED, true),

  // WhatsApp
  whatsappAdapter: (process.env.WHATSAPP_ADAPTER as any) || 'evolution',
  authSessionsDir: process.env.AUTH_SESSIONS_DIR || './auth_sessions',
  evolutionApiUrl: process.env.EVOLUTION_API_URL,
  evolutionApiKey: process.env.EVOLUTION_API_KEY,

  // Sentry
  sentryDSN: process.env.SENTRY_DSN,
  sentryEnvironment: process.env.SENTRY_ENVIRONMENT || 'production',
  sentryTracesSampleRate: getEnvNumber(process.env.SENTRY_TRACES_SAMPLE_RATE, 0.1) / 100,
  sentryEnabled: getEnvBoolean(process.env.SENTRY_ENABLED, false),

  // Backups
  backupEnabled: getEnvBoolean(process.env.BACKUP_ENABLED, true),
  backupSchedule: process.env.BACKUP_SCHEDULE || '0 2 * * *',
  awsS3Bucket: process.env.AWS_S3_BUCKET,
  awsS3Region: process.env.AWS_S3_REGION,
  awsS3AccessKey: process.env.AWS_S3_ACCESS_KEY,
  awsS3SecretKey: process.env.AWS_S3_SECRET_KEY,

  // Files
  uploadsDir: process.env.UPLOADS_DIR || './uploads',
  maxFileSize: getEnvNumber(process.env.MAX_FILE_SIZE, 10485760), // 10MB

  // Admin
  adminEmail: process.env.ADMIN_EMAIL || 'admin@localhost',
  adminPassword: process.env.ADMIN_PASSWORD || 'Admin@123456',
};

// Validate critical configurations
if (envConfig.nodeEnv === 'production') {
  if (envConfig.jwtSecret === 'change-this-secret-key-in-production') {
    throw new Error('❌ JWT_SECRET must be changed in production!');
  }
  if (envConfig.jwtRefreshSecret === 'change-this-refresh-secret') {
    throw new Error('❌ JWT_REFRESH_SECRET must be changed in production!');
  }
  if (!envConfig.sentryDSN && envConfig.sentryEnabled) {
    console.warn('⚠️  Sentry enabled but SENTRY_DSN not set');
  }
}

export default envConfig;
