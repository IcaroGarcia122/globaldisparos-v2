import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WarmupSessionAttributes {
  id: string;
  instanceId: string;
  status: 'active' | 'paused' | 'completed';
  targetDailyMessages: number;
  currentDailyMessages: number;
  startDate: Date;
  estimatedCompletionDate: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface WarmupSessionCreationAttributes extends Optional<WarmupSessionAttributes, 'id' | 'status' | 'currentDailyMessages'> {}

class WarmupSession extends Model<WarmupSessionAttributes, WarmupSessionCreationAttributes> implements WarmupSessionAttributes {
  public id!: string;
  public instanceId!: string;
  public status!: 'active' | 'paused' | 'completed';
  public targetDailyMessages!: number;
  public currentDailyMessages!: number;
  public startDate!: Date;
  public estimatedCompletionDate!: Date;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Método para calcular progresso
  public getProgress(): number {
    if (this.targetDailyMessages === 0) return 0;
    return (this.currentDailyMessages / this.targetDailyMessages) * 100;
  }
}

WarmupSession.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    instanceId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'whatsapp_instances',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    status: {
      type: DataTypes.ENUM('active', 'paused', 'completed'),
      defaultValue: 'active',
      allowNull: false,
    },
    targetDailyMessages: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    currentDailyMessages: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    startDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    estimatedCompletionDate: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'warmup_sessions',
    indexes: [
      {
        fields: ['instance_id'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export default WarmupSession;
