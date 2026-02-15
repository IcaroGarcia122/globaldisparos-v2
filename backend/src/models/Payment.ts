import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PaymentAttributes {
  id: string;
  userId: string;
  diggionTransactionId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'cancelled' | 'refunded';
  plan: 'basic' | 'pro' | 'enterprise';
  planDuration: number; // em dias
  expiresAt: Date;
  metadata: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PaymentCreationAttributes extends Optional<PaymentAttributes, 'id' | 'currency' | 'metadata'> {}

class Payment extends Model<PaymentAttributes, PaymentCreationAttributes> implements PaymentAttributes {
  public id!: string;
  public userId!: string;
  public diggionTransactionId!: string;
  public amount!: number;
  public currency!: string;
  public status!: 'pending' | 'approved' | 'cancelled' | 'refunded';
  public plan!: 'basic' | 'pro' | 'enterprise';
  public planDuration!: number;
  public expiresAt!: Date;
  public metadata!: Record<string, any>;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Payment.init(
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
    diggionTransactionId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'BRL',
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('pending', 'approved', 'cancelled', 'refunded'),
      defaultValue: 'pending',
      allowNull: false,
    },
    plan: {
      type: DataTypes.ENUM('basic', 'pro', 'enterprise'),
      allowNull: false,
    },
    planDuration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'payments',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['diggion_transaction_id'],
      },
    ],
  }
);

export default Payment;
