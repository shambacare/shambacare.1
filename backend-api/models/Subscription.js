 const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Subscription = sequelize.define('Subscription', {
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
    plan: {
        type: DataTypes.ENUM('Basic', 'Pro', 'Enterprise'),
        defaultValue: 'Basic'
    },
    price_kes: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    started_at: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    expires_at: {
        type: DataTypes.DATEONLY,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('Active', 'Expired', 'Cancelled', 'Pending'),
        defaultValue: 'Pending'
    },
    payment_method: {
        type: DataTypes.ENUM('Mpesa', 'Card', 'Bank'),
        defaultValue: 'Mpesa'
    },
    transaction_id: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    auto_renew: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    }
}, {
    tableName: 'subscriptions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = Subscription;
