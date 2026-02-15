import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface CampaignAttributes {
  id: string;
  userId: string;
  instanceId: string;
  contactListId: string;
  name: string;
  message: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'banned';
  scheduledFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  totalContacts: number;
  messagesSent: number;
  messagesFailed: number;
  messagesScheduled: number;
  useAntibanVariations: boolean;
  useAntibanDelays: boolean;
  useCommercialHours: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CampaignCreationAttributes
  extends Optional<
    CampaignAttributes,
    | 'id'
    | 'status'
    | 'scheduledFor'
    | 'startedAt'
    | 'completedAt'
    | 'totalContacts'
    | 'messagesSent'
    | 'messagesFailed'
    | 'messagesScheduled'
    | 'useAntibanVariations'
    | 'useAntibanDelays'
    | 'useCommercialHours'
  > {}

class Campaign extends Model<CampaignAttributes, CampaignCreationAttributes> implements CampaignAttributes {
  public id!: string;
  public userId!: string;
  public instanceId!: string;
  public contactListId!: string;
  public name!: string;
  public message!: string;
  public status!: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'banned';
  public scheduledFor!: Date | null;
  public startedAt!: Date | null;
  public completedAt!: Date | null;
  public totalContacts!: number;
  public messagesSent!: number;
  public messagesFailed!: number;
  public messagesScheduled!: number;
  public useAntibanVariations!: boolean;
  public useAntibanDelays!: boolean;
  public useCommercialHours!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Método para calcular taxa de sucesso
  public getSuccessRate(): number {
    const total = this.messagesSent + this.messagesFailed;
    if (total === 0) return 0;
    return (this.messagesSent / total) * 100;
  }
}

Campaign.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onDelete: 'CASCADE',
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
    contactListId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'contact_lists',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'paused', 'completed', 'cancelled', 'banned'),
      defaultValue: 'pending',
      allowNull: false,
    },
    scheduledFor: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    totalContacts: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    messagesSent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    messagesFailed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    messagesScheduled: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    useAntibanVariations: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    useAntibanDelays: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
    useCommercialHours: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'campaigns',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['instance_id'],
      },
      {
        fields: ['status'],
      },
    ],
  }
);

export default Campaign;
