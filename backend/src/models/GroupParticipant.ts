import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface GroupParticipantAttributes {
  id: string;
  groupId: string;
  phoneNumber: string;
  name: string | null;
  isAdmin: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

interface GroupParticipantCreationAttributes extends Optional<GroupParticipantAttributes, 'id' | 'name' | 'isAdmin'> {}

class GroupParticipant extends Model<GroupParticipantAttributes, GroupParticipantCreationAttributes> implements GroupParticipantAttributes {
  public id!: string;
  public groupId!: string;
  public phoneNumber!: string;
  public name!: string | null;
  public isAdmin!: boolean;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

GroupParticipant.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    groupId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'whatsapp_groups',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    isAdmin: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'group_participants',
    indexes: [
      {
        fields: ['group_id'],
      },
      {
        fields: ['phone_number'],
      },
      {
        unique: true,
        fields: ['group_id', 'phone_number'],
      },
    ],
  }
);

export default GroupParticipant;
