import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface MessageAttributes {
  id: string;
  campaignId: string;
  contactId: string;
  phoneNumber: string;
  messageText: string;
  status: 'scheduled' | 'sent' | 'failed' | 'delivered' | 'read';
  errorMessage: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MessageCreationAttributes
  extends Optional<MessageAttributes, 'id' | 'status' | 'errorMessage' | 'sentAt' | 'deliveredAt' | 'readAt'> {}

class Message extends Model<MessageAttributes, MessageCreationAttributes> implements MessageAttributes {
  public id!: string;
  public campaignId!: string;
  public contactId!: string;
  public phoneNumber!: string;
  public messageText!: string;
  public status!: 'scheduled' | 'sent' | 'failed' | 'delivered' | 'read';
  public errorMessage!: string | null;
  public sentAt!: Date | null;
  public deliveredAt!: Date | null;
  public readAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Message.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    campaignId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'campaigns',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    contactId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'contacts',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    messageText: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('scheduled', 'sent', 'failed', 'delivered', 'read'),
      defaultValue: 'scheduled',
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    sentAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    deliveredAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'messages',
    indexes: [
      {
        fields: ['campaign_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['phone_number'],
      },
    ],
  }
);

export default Message;
