import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface WhatsAppInstanceAttributes {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'banned';
  qrCode: string | null;
  connectedAt: Date | null;
  accountAge: number; // dias desde a criação da conta no WhatsApp
  dailyMessagesSent: number;
  totalMessagesSent: number;
  totalMessagesFailed: number;
  lastMessageAt: Date | null;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface WhatsAppInstanceCreationAttributes
  extends Optional<
    WhatsAppInstanceAttributes,
    'id' | 'phoneNumber' | 'status' | 'qrCode' | 'connectedAt' | 'accountAge' | 'dailyMessagesSent' | 'totalMessagesSent' | 'totalMessagesFailed' | 'lastMessageAt' | 'isActive'
  > {}

class WhatsAppInstance extends Model<WhatsAppInstanceAttributes, WhatsAppInstanceCreationAttributes> implements WhatsAppInstanceAttributes {
  public id!: string;
  public userId!: string;
  public name!: string;
  public phoneNumber!: string | null;
  public status!: 'disconnected' | 'connecting' | 'connected' | 'banned';
  public qrCode!: string | null;
  public connectedAt!: Date | null;
  public accountAge!: number;
  public dailyMessagesSent!: number;
  public totalMessagesSent!: number;
  public totalMessagesFailed!: number;
  public lastMessageAt!: Date | null;
  public isActive!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Método para determinar categoria de idade da conta
  public getAgeCategory(): 'new' | 'medium' | 'old' {
    if (this.accountAge < 7) return 'new';
    if (this.accountAge < 30) return 'medium';
    return 'old';
  }

  // Método para calcular taxa de erro
  public getErrorRate(): number {
    const total = this.totalMessagesSent + this.totalMessagesFailed;
    if (total === 0) return 0;
    return (this.totalMessagesFailed / total) * 100;
  }
}

WhatsAppInstance.init(
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
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('disconnected', 'connecting', 'connected', 'banned'),
      defaultValue: 'disconnected',
      allowNull: false,
    },
    qrCode: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    connectedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    accountAge: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    dailyMessagesSent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    totalMessagesSent: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    totalMessagesFailed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'whatsapp_instances',
  }
);

export default WhatsAppInstance;
