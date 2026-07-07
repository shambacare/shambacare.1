const { DataTypes } = require('sequelize'); 
const { sequelize } = require('../config/database'); 
 
const Task = sequelize.define('Task', { 
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, 
    farm_id: { type: DataTypes.INTEGER, allowNull: false }, 
    crop_name: { type: DataTypes.STRING, allowNull: false }, 
    task_name: { type: DataTypes.STRING, allowNull: false }, 
    task_type: { type: DataTypes.ENUM('planting', 'irrigation', 'fertilizing', 'weeding', 'spraying', 'harvesting', 'monitoring', 'other'), defaultValue: 'other' }, 
    description: { type: DataTypes.TEXT }, 
    scheduled_date: { type: DataTypes.DATE }, 
    completed: { type: DataTypes.BOOLEAN, defaultValue: false }, 
    completed_date: { type: DataTypes.DATE }, 
    days_after_previous: { type: DataTypes.INTEGER, defaultValue: 0 }, 
    position_order: { type: DataTypes.INTEGER, defaultValue: 0 }, 
    weather_conditions: { type: DataTypes.JSON }, 
    notes: { type: DataTypes.TEXT }, 
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }, 
    updated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW } 
}, { timestamps: false }); 
 
module.exports = Task; 
