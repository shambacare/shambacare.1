const User = require('./User');
const Farm = require('./Farm');
const Crop = require('./Crop');
const Diagnosis = require('./Diagnosis');
const Disease = require('./Disease');
const Subscription = require('./Subscription');
const Alert = require('./Alert');


// Define associations
User.hasMany(Farm, { foreignKey: 'user_id', as: 'farms' });
Farm.belongsTo(User, { foreignKey: 'user_id', as: 'owner' });

Farm.hasMany(Crop, { foreignKey: 'farm_id', as: 'crops' });
Crop.belongsTo(Farm, { foreignKey: 'farm_id', as: 'farm' });

User.hasMany(Diagnosis, { foreignKey: 'user_id', as: 'diagnoses' });
Diagnosis.belongsTo(User, { foreignKey: 'user_id', as: 'farmer' });

User.hasOne(Subscription, { foreignKey: 'user_id', as: 'subscription' });
Subscription.belongsTo(User, { foreignKey: 'user_id', as: 'subscriber' });

module.exports = {
    User,
    Farm,
    Crop,
    Diagnosis,
    Disease,
    Subscription,
    Alert
};