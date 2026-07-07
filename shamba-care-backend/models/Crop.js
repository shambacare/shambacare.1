 const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Crop = sequelize.define('Crop', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    farm_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'farms',
            key: 'id'
        }
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false
    },
    variety: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    planting_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    stage: {
        type: DataTypes.ENUM('Germination', 'Vegetative', 'Flowering', 'Fruiting', 'Maturity', 'Harvested'),
        defaultValue: 'Vegetative'
    },
    health_score: {
        type: DataTypes.INTEGER,
        defaultValue: 85
    },
    status: {
        type: DataTypes.ENUM('Excellent', 'Good', 'Fair', 'Poor', 'Critical'),
        defaultValue: 'Good'
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    tableName: 'crops',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Crop;
