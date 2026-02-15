import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface ContactAttributes {
  id: string;
  contactListId: string;
  name: string;
  phoneNumber: string;
  variables: Record<string, string>; // JSON para variáveis customizadas
  createdAt?: Date;
  updatedAt?: Date;
}

interface ContactCreationAttributes extends Optional<ContactAttributes, 'id' | 'variables'> {}

class Contact extends Model<ContactAttributes, ContactCreationAttributes> implements ContactAttributes {
  public id!: string;
  public contactListId!: string;
  public name!: string;
  public phoneNumber!: string;
  public variables!: Record<string, string>;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Contact.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
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
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    variables: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: 'contacts',
    indexes: [
      {
        fields: ['contact_list_id'],
      },
      {
        fields: ['phone_number'],
      },
    ],
  }
);

export default Contact;
