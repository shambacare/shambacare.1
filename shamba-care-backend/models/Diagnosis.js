 const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Diagnosis = sequelize.define('Diagnosis', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    crop_name: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    disease_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    confidence_score: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    image_url: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    symptoms: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    recommended_solution: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('Pending', 'Reviewed', 'Resolved'),
        defaultValue: 'Pending'
    },
    admin_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'diagnoses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = Diagnosis;
