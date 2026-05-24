const { sequelize, Sequelize } = require('../config/database');
const User = require('./User');
const Farm = require('./Farm');
const Crop = require('./Crop');
const Diagnosis = require('./Diagnosis');
const Disease = require('./Disease');
const Subscription = require('./Subscription');
const Alert = require('./Alert');
const Task = require('./Task');
const CropActivity = require('./CropActivity');
const ChatMessage = require('./ChatMessage');


// Define associations
User.hasMany(Farm, { foreignKey: 'user_id', as: 'farms' });
Farm.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });

Farm.hasMany(Crop, { foreignKey: 'farm_id', as: 'crops' });
Crop.belongsTo(Farm, { foreignKey: 'farm_id', as: 'farm' });

User.hasMany(Diagnosis, { foreignKey: 'user_id', as: 'diagnoses' });
Diagnosis.belongsTo(User, { foreignKey: 'user_id', as: 'farmer' });

User.hasOne(Subscription, { foreignKey: 'user_id', as: 'subscription' });
Subscription.belongsTo(User, { foreignKey: 'user_id', as: 'subscriber' });

// Add Task associations
Farm.hasMany(Task, { foreignKey: 'farm_id', as: 'tasks' });
Task.belongsTo(Farm, { foreignKey: 'farm_id', as: 'farm' });

// Add CropActivity associations
Farm.hasMany(CropActivity, { foreignKey: 'crop_id', as: 'activities' });
CropActivity.belongsTo(Farm, { foreignKey: 'crop_id', as: 'crop' });

// Add ChatMessage associations
User.hasMany(ChatMessage, { foreignKey: 'farmer_id', as: 'farmer_messages' });
User.hasMany(ChatMessage, { foreignKey: 'admin_id', as: 'admin_messages' });
ChatMessage.belongsTo(User, { foreignKey: 'farmer_id', as: 'farmer' });
ChatMessage.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });

module.exports = {
    sequelize,   // ADD THIS LINE - REQUIRED for database sync
    Sequelize,   // ADD THIS LINE - REQUIRED for database sync
    User,
    Farm,
    Crop,
    Diagnosis,
    Disease,
    Subscription,
    Alert,
    Task,
    CropActivity,
    ChatMessage
};