 const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Alert = sequelize.define('Alert', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    type: {
        type: DataTypes.ENUM('weather', 'disease', 'tip', 'emergency'),
        allowNull: false
    },
    subject: {
        type: DataTypes.STRING(200),
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    target_region: {
        type: DataTypes.STRING(50),
        defaultValue: 'all'
    },
    sent_by: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    is_broadcast: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    sent_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'alerts',
    timestamps: false
});

module.exports = Alert;
