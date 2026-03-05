import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

interface Config {
  env: string;
  port: number;
  host: string;
  database: {
    host: string;
    port: number;
    name: string;
    user: string;
    password: string;
    dialect: string;
  };
  jwt: {
    secret: string;
    expiresIn: string;
    refreshSecret: string;
    refreshExpiresIn: string;
  };
  diggion: {
    webhookSecret: string;
    productId: string;
  };
  admin: {
    email: string;
    password: string;
  };
  frontendUrl: string;
  authSessionsDir: string;
  antiBan: {
    newAccountDays: number;
    mediumAccountDays: number;
    newDailyLimit: number;
    mediumDailyLimit: number;
    oldDailyLimit: number;
    newDelayMin: number;
    newDelayMax: number;
    mediumDelayMin: number;
    mediumDelayMax: number;
    oldDelayMin: number;
    oldDelayMax: number;
    burstMin: number;
    burstMax: number;
    pauseMin: number;
    pauseMax: number;
    startHour: number;
    endHour: number;
    errorThreshold: number;
  };
  uploads: {
    dir: string;
    maxFileSize: number;
  };
}

const config: Config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3001', 10),
  host: process.env.HOST || '0.0.0.0',
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    name: process.env.DB_NAME || 'whatsapp_saas',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    dialect: process.env.DB_DIALECT || 'postgres',
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'change_this_secret_key',
    expiresIn: process.env.JWT_EXPIRES_IN || process.env.JWT_EXPIRY || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change-this-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || process.env.JWT_REFRESH_EXPIRY || '30d',
  },
  diggion: {
    webhookSecret: process.env.DIGGION_WEBHOOK_SECRET || '',
    productId: process.env.DIGGION_PRODUCT_ID || '',
  },
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@123456',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  authSessionsDir: process.env.AUTH_SESSIONS_DIR || path.join(process.cwd(), 'auth_sessions'),
  antiBan: {
    newAccountDays: parseInt(process.env.ANTI_BAN_NEW_ACCOUNT_DAYS || '7', 10),
    mediumAccountDays: parseInt(process.env.ANTI_BAN_MEDIUM_ACCOUNT_DAYS || '30', 10),
    newDailyLimit: parseInt(process.env.ANTI_BAN_NEW_DAILY_LIMIT || '50', 10),
    mediumDailyLimit: parseInt(process.env.ANTI_BAN_MEDIUM_DAILY_LIMIT || '150', 10),
    oldDailyLimit: parseInt(process.env.ANTI_BAN_OLD_DAILY_LIMIT || '500', 10),
    newDelayMin: parseInt(process.env.ANTI_BAN_NEW_DELAY_MIN || '15', 10),
    newDelayMax: parseInt(process.env.ANTI_BAN_NEW_DELAY_MAX || '45', 10),
    mediumDelayMin: parseInt(process.env.ANTI_BAN_MEDIUM_DELAY_MIN || '8', 10),
    mediumDelayMax: parseInt(process.env.ANTI_BAN_MEDIUM_DELAY_MAX || '20', 10),
    oldDelayMin: parseInt(process.env.ANTI_BAN_OLD_DELAY_MIN || '3', 10),
    oldDelayMax: parseInt(process.env.ANTI_BAN_OLD_DELAY_MAX || '10', 10),
    burstMin: parseInt(process.env.ANTI_BAN_BURST_MIN || '5', 10),
    burstMax: parseInt(process.env.ANTI_BAN_BURST_MAX || '20', 10),
    pauseMin: parseInt(process.env.ANTI_BAN_PAUSE_MIN || '120', 10),
    pauseMax: parseInt(process.env.ANTI_BAN_PAUSE_MAX || '300', 10),
    startHour: parseInt(process.env.ANTI_BAN_START_HOUR || '9', 10),
    endHour: parseInt(process.env.ANTI_BAN_END_HOUR || '21', 10),
    errorThreshold: parseInt(process.env.ANTI_BAN_ERROR_THRESHOLD || '70', 10),
  },
  uploads: {
    dir: process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads'),
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
  },
};

export default config;
