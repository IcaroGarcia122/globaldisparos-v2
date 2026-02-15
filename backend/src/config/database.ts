import { Sequelize } from 'sequelize';
import config from './index';
import logger from '../utils/logger';

const sequelize = new Sequelize({
  host: config.database.host,
  port: config.database.port,
  database: config.database.name,
  username: config.database.user,
  password: config.database.password,
  dialect: 'postgres',
  logging: config.env === 'development' ? (msg) => logger.debug(msg) : false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
  define: {
    timestamps: true,
    underscored: true,
    freezeTableName: true,
  },
});

export const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info('✅ Conexão com PostgreSQL estabelecida com sucesso!');
  } catch (error) {
    logger.error('❌ Erro ao conectar no PostgreSQL:', error);
    throw error;
  }
};

export const syncDatabase = async (force: boolean = false): Promise<void> => {
  try {
    await sequelize.sync({ force, alter: !force && config.env === 'development' });
    logger.info(`✅ Banco de dados sincronizado ${force ? '(FORCE)' : ''}!`);
  } catch (error) {
    logger.error('❌ Erro ao sincronizar banco de dados:', error);
    throw error;
  }
};

export default sequelize;
