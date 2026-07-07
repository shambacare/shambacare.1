const { DataTypes } = require('sequelize'); 
const { sequelize } = require('../config/database'); 
 
const CropActivity = sequelize.define('CropActivity', { 
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true }, 
    crop_id: { type: DataTypes.INTEGER, allowNull: false }, 
    activity_type: { type: DataTypes.STRING, allowNull: false }, 
    activity_date: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }, 
    notes: { type: DataTypes.TEXT }, 
    images: { type: DataTypes.JSON }, 
    health_status: { type: DataTypes.ENUM('excellent', 'good', 'fair', 'poor', 'critical'), defaultValue: 'good' }, 
    created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW } 
}, { timestamps: false }); 
 
module.exports = CropActivity; 
