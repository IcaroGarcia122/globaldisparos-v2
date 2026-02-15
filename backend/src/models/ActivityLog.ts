import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ActivityLogAttributes {
  id: string;
  userId: string | null;
  instanceId: string | null;
  action: string;
  details: Record<string, any>;
  level: 'info' | 'warning' | 'error' | 'success';
  ipAddress: string | null;
  userAgent: string | null;
  createdAt?: Date;
}

interface ActivityLogCreationAttributes extends Optional<ActivityLogAttributes, 'id' | 'userId' | 'instanceId' | 'details' | 'level' | 'ipAddress' | 'userAgent'> {}

class ActivityLog extends Model<ActivityLogAttributes, ActivityLogCreationAttributes> implements ActivityLogAttributes {
  public id!: string;
  public userId!: string | null;
  public instanceId!: string | null;
  public action!: string;
  public details!: Record<string, any>;
  public level!: 'info' | 'warning' | 'error' | 'success';
  public ipAddress!: string | null;
  public userAgent!: string | null;

  public readonly createdAt!: Date;
}

ActivityLog.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    instanceId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'whatsapp_instances',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    details: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
    level: {
      type: DataTypes.ENUM('info', 'warning', 'error', 'success'),
      defaultValue: 'info',
      allowNull: false,
    },
    ipAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'activity_logs',
    updatedAt: false,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['instance_id'],
      },
      {
        fields: ['level'],
      },
      {
        fields: ['created_at'],
      },
    ],
  }
);

export default ActivityLog;
