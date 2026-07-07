// config/database.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

// Validate DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set');
  process.exit(1);
}

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false, // set to console.log for debugging
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false // Neon requires false
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
    process.exit(1);
  }
};

// Optional: test SSL connection
const testSSL = async () => {
  try {
    const [result] = await sequelize.query('SHOW ssl;');
    console.log('🔒 SSL Status:', result[0].ssl === 'on' ? 'Enabled ✅' : 'Disabled ❌');
  } catch (e) {
    // ignore
  }
};

module.exports = {
  sequelize,
  Sequelize,    // ✅ IMPORTANT – needed for models/index.js
  connectDB,
  testSSL
};