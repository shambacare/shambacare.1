const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
    dialect: 'postgres',
    logging: false,
    pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
    },
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: false   // Set to false for Neon compatibility
        }
    }
});

const connectDB = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ PostgreSQL Database connected successfully');
        return true;
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        
        // Provide helpful troubleshooting info
        if (error.message.includes('ENOTFOUND')) {
            console.error('\n🔍 DNS Resolution Failed - Troubleshooting steps:');
            console.error('1. Check your internet connection');
            console.error('2. Verify the database exists in Neon Console');
            console.error('3. Try toggling OFF "Connection pooling" in Neon Connect modal');
            console.error('4. Try using a different network (e.g., mobile hotspot)');
            console.error('5. Check if VPN/firewall is blocking DNS queries\n');
        } else if (error.message.includes('SSL')) {
            console.error('\n🔒 SSL Error - Try these solutions:');
            console.error('1. Update .env DATABASE_URL to use sslmode=verify-full');
            console.error('2. Or add uselibpqcompat=true&sslmode=require to the connection string');
            console.error('3. Ensure your Node.js version is up to date\n');
        }
        
        process.exit(1);
    }
};

// Optional: Test the connection with additional SSL diagnostics
const testSSLConnection = async () => {
    try {
        const [results] = await sequelize.query('SHOW ssl;');
        console.log('🔒 SSL Status:', results[0].ssl === 'on' ? 'Enabled ✅' : 'Disabled ❌');
    } catch (error) {
        console.log('⚠️ Could not check SSL status:', error.message);
    }
};

module.exports = { sequelize, connectDB };