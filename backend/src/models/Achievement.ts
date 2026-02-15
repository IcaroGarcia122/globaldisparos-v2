import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface AchievementAttributes {
  id: string;
  userId: string;
  type: 'messages_sent' | 'campaigns_completed' | 'contacts_imported' | 'groups_synced' | 'uptime_streak';
  title: string;
  description: string;
  icon: string;
  threshold: number;
  currentValue: number;
  isUnlocked: boolean;
  unlockedAt: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface AchievementCreationAttributes
  extends Optional<AchievementAttributes, 'id' | 'currentValue' | 'isUnlocked' | 'unlockedAt'> {}

class Achievement extends Model<AchievementAttributes, AchievementCreationAttributes> implements AchievementAttributes {
  public id!: string;
  public userId!: string;
  public type!: 'messages_sent' | 'campaigns_completed' | 'contacts_imported' | 'groups_synced' | 'uptime_streak';
  public title!: string;
  public description!: string;
  public icon!: string;
  public threshold!: number;
  public currentValue!: number;
  public isUnlocked!: boolean;
  public unlockedAt!: Date | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Método para calcular progresso
  public getProgress(): number {
    if (this.threshold === 0) return 0;
    return Math.min((this.currentValue / this.threshold) * 100, 100);
  }
}

Achievement.init(
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
    type: {
      type: DataTypes.ENUM('messages_sent', 'campaigns_completed', 'contacts_imported', 'groups_synced', 'uptime_streak'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    icon: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    threshold: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    currentValue: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    isUnlocked: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false,
    },
    unlockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'achievements',
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['is_unlocked'],
      },
    ],
  }
);

export default Achievement;
