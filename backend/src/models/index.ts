import User from './User';
import WhatsAppInstance from './WhatsAppInstance';
import ContactList from './ContactList';
import Contact from './Contact';
import Campaign from './Campaign';
import Message from './Message';
import WhatsAppGroup from './WhatsAppGroup';
import GroupParticipant from './GroupParticipant';
import ActivityLog from './ActivityLog';
import Payment from './Payment';
import WarmupSession from './WarmupSession';
import Achievement from './Achievement';

// ===================================
// RELAÇÕES ENTRE MODELOS
// ===================================

// USER -> WHATSAPP INSTANCES (1:N)
User.hasMany(WhatsAppInstance, {
  foreignKey: 'userId',
  as: 'instances',
  onDelete: 'CASCADE',
});
WhatsAppInstance.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// USER -> CONTACT LISTS (1:N)
User.hasMany(ContactList, {
  foreignKey: 'userId',
  as: 'contactLists',
  onDelete: 'CASCADE',
});
ContactList.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// CONTACT LIST -> CONTACTS (1:N)
ContactList.hasMany(Contact, {
  foreignKey: 'contactListId',
  as: 'contacts',
  onDelete: 'CASCADE',
});
Contact.belongsTo(ContactList, {
  foreignKey: 'contactListId',
  as: 'list',
});

// USER -> CAMPAIGNS (1:N)
User.hasMany(Campaign, {
  foreignKey: 'userId',
  as: 'campaigns',
  onDelete: 'CASCADE',
});
Campaign.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// WHATSAPP INSTANCE -> CAMPAIGNS (1:N)
WhatsAppInstance.hasMany(Campaign, {
  foreignKey: 'instanceId',
  as: 'campaigns',
  onDelete: 'CASCADE',
});
Campaign.belongsTo(WhatsAppInstance, {
  foreignKey: 'instanceId',
  as: 'instance',
});

// CONTACT LIST -> CAMPAIGNS (1:N)
ContactList.hasMany(Campaign, {
  foreignKey: 'contactListId',
  as: 'campaigns',
  onDelete: 'CASCADE',
});
Campaign.belongsTo(ContactList, {
  foreignKey: 'contactListId',
  as: 'contactList',
});

// CAMPAIGN -> MESSAGES (1:N)
Campaign.hasMany(Message, {
  foreignKey: 'campaignId',
  as: 'messages',
  onDelete: 'CASCADE',
});
Message.belongsTo(Campaign, {
  foreignKey: 'campaignId',
  as: 'campaign',
});

// CONTACT -> MESSAGES (1:N)
Contact.hasMany(Message, {
  foreignKey: 'contactId',
  as: 'messages',
  onDelete: 'CASCADE',
});
Message.belongsTo(Contact, {
  foreignKey: 'contactId',
  as: 'contact',
});

// WHATSAPP INSTANCE -> WHATSAPP GROUPS (1:N)
WhatsAppInstance.hasMany(WhatsAppGroup, {
  foreignKey: 'instanceId',
  as: 'groups',
  onDelete: 'CASCADE',
});
WhatsAppGroup.belongsTo(WhatsAppInstance, {
  foreignKey: 'instanceId',
  as: 'instance',
});

// WHATSAPP GROUP -> GROUP PARTICIPANTS (1:N)
WhatsAppGroup.hasMany(GroupParticipant, {
  foreignKey: 'groupId',
  as: 'participants',
  onDelete: 'CASCADE',
});
GroupParticipant.belongsTo(WhatsAppGroup, {
  foreignKey: 'groupId',
  as: 'group',
});

// USER -> ACTIVITY LOGS (1:N)
User.hasMany(ActivityLog, {
  foreignKey: 'userId',
  as: 'activityLogs',
  onDelete: 'SET NULL',
});
ActivityLog.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// WHATSAPP INSTANCE -> ACTIVITY LOGS (1:N)
WhatsAppInstance.hasMany(ActivityLog, {
  foreignKey: 'instanceId',
  as: 'activityLogs',
  onDelete: 'SET NULL',
});
ActivityLog.belongsTo(WhatsAppInstance, {
  foreignKey: 'instanceId',
  as: 'instance',
});

// USER -> PAYMENTS (1:N)
User.hasMany(Payment, {
  foreignKey: 'userId',
  as: 'payments',
  onDelete: 'CASCADE',
});
Payment.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

// WHATSAPP INSTANCE -> WARMUP SESSION (1:1)
WhatsAppInstance.hasOne(WarmupSession, {
  foreignKey: 'instanceId',
  as: 'warmupSession',
  onDelete: 'CASCADE',
});
WarmupSession.belongsTo(WhatsAppInstance, {
  foreignKey: 'instanceId',
  as: 'instance',
});

// USER -> ACHIEVEMENTS (1:N)
User.hasMany(Achievement, {
  foreignKey: 'userId',
  as: 'achievements',
  onDelete: 'CASCADE',
});
Achievement.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
});

export {
  User,
  WhatsAppInstance,
  ContactList,
  Contact,
  Campaign,
  Message,
  WhatsAppGroup,
  GroupParticipant,
  ActivityLog,
  Payment,
  WarmupSession,
  Achievement,
};
