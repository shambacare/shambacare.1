 const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Disease = sequelize.define('Disease', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    crop_affected: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    severity: {
        type: DataTypes.ENUM('Low', 'Medium', 'High', 'Critical'),
        defaultValue: 'Medium'
    },
    symptoms: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    organic_solution: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    chemical_solution: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    prevention_tips: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    estimated_cost_kes: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    icon: {
        type: DataTypes.STRING(10),
        allowNull: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
}, {
    tableName: 'diseases',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Disease;
