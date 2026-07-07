 const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Farm = sequelize.define('Farm', {
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
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    location: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    size_acres: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    main_crop: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    health_score: {
        type: DataTypes.INTEGER,
        defaultValue: 85
    }
}, {
    tableName: 'farms',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Farm;
