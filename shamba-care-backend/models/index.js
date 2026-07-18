// models/index.js
const { sequelize, Sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');

// ==================== USER MODEL ====================
const User = sequelize.define('User', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: Sequelize.STRING, allowNull: false },
  email: { type: Sequelize.STRING, allowNull: false, unique: true },
  phone: { type: Sequelize.STRING, allowNull: false },
  county: { type: Sequelize.STRING, allowNull: false },
  password_hash: { type: Sequelize.STRING, allowNull: false },
  role: { type: Sequelize.STRING, defaultValue: 'farmer' },
  is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
  reset_token: { type: Sequelize.STRING },
  reset_expires: { type: Sequelize.DATE },
  email_verified: { type: Sequelize.BOOLEAN, defaultValue: false },
  profile_image: { type: Sequelize.STRING },
  last_login: { type: Sequelize.DATE }
}, {
  tableName: 'users',
  timestamps: true,
  underscored: true,
  hooks: {
    beforeCreate: async (user) => {
      if (user.password_hash) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(user.password_hash, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password_hash')) {
        const salt = await bcrypt.genSalt(10);
        user.password_hash = await bcrypt.hash(user.password_hash, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password_hash);
};

// ==================== FARM MODEL ====================
const Farm = sequelize.define('Farm', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: Sequelize.STRING, allowNull: false },
  location: { type: Sequelize.STRING },
  county: { type: Sequelize.STRING },
  size_acres: { type: Sequelize.FLOAT },
  main_crop: { type: Sequelize.STRING },
  planting_date: { type: Sequelize.DATE },
  health_score: { type: Sequelize.INTEGER, defaultValue: 85 }
}, { tableName: 'farms', timestamps: true, underscored: true });

// ==================== CROP MODEL ====================
const Crop = sequelize.define('Crop', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: Sequelize.STRING, allowNull: false },
  variety: { type: Sequelize.STRING },
  planting_date: { type: Sequelize.DATE },
  area: { type: Sequelize.FLOAT },
  health_score: { type: Sequelize.INTEGER, defaultValue: 85 },
  status: { type: Sequelize.STRING, defaultValue: 'Active' }
}, { tableName: 'crops', timestamps: true, underscored: true });

// ==================== DIAGNOSIS MODEL (UPDATED) ====================
const Diagnosis = sequelize.define('Diagnosis', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: Sequelize.INTEGER, allowNull: false },
  crop_name: { type: Sequelize.STRING(50), allowNull: false },
  disease_name: { type: Sequelize.STRING(100), allowNull: true },
  confidence_score: { type: Sequelize.INTEGER, allowNull: true },  // ✅ fixed
  image_url: { type: Sequelize.STRING(255), allowNull: true },
  symptoms: { type: Sequelize.TEXT, allowNull: true },
  recommended_solution: { type: Sequelize.TEXT, allowNull: true },
  status: { type: Sequelize.STRING, defaultValue: 'Pending' },
  admin_notes: { type: Sequelize.TEXT, allowNull: true }
}, {
  tableName: 'diagnoses',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: false
});

// ==================== DISEASE MODEL ====================
const Disease = sequelize.define('Disease', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: Sequelize.STRING, allowNull: false },
  crop_type: { type: Sequelize.STRING },
  description: { type: Sequelize.TEXT },
  symptoms: { type: Sequelize.TEXT },
  organic_solution: { type: Sequelize.TEXT },
  chemical_solution: { type: Sequelize.TEXT },
  prevention_tips: { type: Sequelize.TEXT },
  severity: { type: Sequelize.STRING }
}, { tableName: 'diseases', timestamps: true, underscored: true });

// ==================== SUBSCRIPTION MODEL ====================
const Subscription = sequelize.define('Subscription', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  plan: { type: Sequelize.STRING, allowNull: false },
  status: { type: Sequelize.STRING, defaultValue: 'active' },
  start_date: { type: Sequelize.DATE },
  end_date: { type: Sequelize.DATE }
}, { tableName: 'subscriptions', timestamps: true, underscored: true });

// ==================== ALERT MODEL ====================
const Alert = sequelize.define('Alert', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: Sequelize.STRING, allowNull: false },
  message: { type: Sequelize.TEXT, allowNull: false },
  type: { type: Sequelize.STRING },
  read: { type: Sequelize.BOOLEAN, defaultValue: false }
}, { tableName: 'alerts', timestamps: true, underscored: true });

// ==================== TASK MODEL ====================
const Task = sequelize.define('Task', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  task_name: { type: Sequelize.STRING, allowNull: false },
  description: { type: Sequelize.TEXT },
  scheduled_date: { type: Sequelize.DATE },
  days_after_previous: { type: Sequelize.INTEGER },
  completed: { type: Sequelize.BOOLEAN, defaultValue: false },
  completed_date: { type: Sequelize.DATE },
  position_order: { type: Sequelize.INTEGER, defaultValue: 0 },
  crop_id: { type: Sequelize.INTEGER, allowNull: false },
  farm_id: { type: Sequelize.INTEGER, allowNull: false }
}, { tableName: 'tasks', timestamps: true, underscored: true });

// ==================== CROP ACTIVITY MODEL ====================
const CropActivity = sequelize.define('CropActivity', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  activity_type: { type: Sequelize.STRING },
  notes: { type: Sequelize.TEXT },
  date: { type: Sequelize.DATE }
}, { tableName: 'crop_activities', timestamps: true, underscored: true });

// ==================== CHAT MESSAGE MODEL ====================
const ChatMessage = sequelize.define('ChatMessage', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  message: { type: Sequelize.TEXT, allowNull: false },
  is_from_admin: { type: Sequelize.BOOLEAN, defaultValue: false }
}, { tableName: 'chat_messages', timestamps: true, underscored: true });

// ==================== FEEDBACK MODEL ====================
const Feedback = sequelize.define('Feedback', {
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: Sequelize.STRING, allowNull: false },
  email: { type: Sequelize.STRING, allowNull: false },
  location: { type: Sequelize.STRING, allowNull: false },
  rating: { type: Sequelize.INTEGER, allowNull: false, validate: { min: 1, max: 5 } },
  message: { type: Sequelize.TEXT, allowNull: false }
}, { tableName: 'feedbacks', timestamps: true, underscored: true });

// ==================== ASSOCIATIONS ====================
User.hasMany(Farm, { foreignKey: 'user_id', as: 'farms' });
Farm.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });

Farm.hasMany(Crop, { foreignKey: 'farm_id', as: 'crops' });
Crop.belongsTo(Farm, { foreignKey: 'farm_id', as: 'farm' });

User.hasMany(Diagnosis, { foreignKey: 'user_id', as: 'diagnoses' });
Diagnosis.belongsTo(User, { foreignKey: 'user_id', as: 'farmer' });

User.hasOne(Subscription, { foreignKey: 'user_id', as: 'subscription' });
Subscription.belongsTo(User, { foreignKey: 'user_id', as: 'subscriber' });

Crop.hasMany(Task, { foreignKey: 'crop_id', as: 'tasks' });
Task.belongsTo(Crop, { foreignKey: 'crop_id', as: 'crop' });

Farm.hasMany(Task, { foreignKey: 'farm_id', as: 'farmTasks' });
Task.belongsTo(Farm, { foreignKey: 'farm_id', as: 'farm' });

Crop.hasMany(CropActivity, { foreignKey: 'crop_id', as: 'activities' });
CropActivity.belongsTo(Crop, { foreignKey: 'crop_id', as: 'crop' });

User.hasMany(ChatMessage, { foreignKey: 'farmer_id', as: 'farmer_messages' });
User.hasMany(ChatMessage, { foreignKey: 'admin_id', as: 'admin_messages' });
ChatMessage.belongsTo(User, { foreignKey: 'farmer_id', as: 'farmer' });
ChatMessage.belongsTo(User, { foreignKey: 'admin_id', as: 'admin' });

// ==================== EXPORT ====================
module.exports = {
  sequelize,
  Sequelize,
  User,
  Farm,
  Crop,
  Diagnosis,
  Disease,
  Subscription,
  Alert,
  Task,
  CropActivity,
  ChatMessage,
  Feedback
};
