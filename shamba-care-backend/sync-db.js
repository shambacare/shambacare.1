const { sequelize, ChatMessage } = require('./models');

async function syncDatabase() {
    try {
        await sequelize.authenticate();
        console.log('✅ Database connection established');
        
        await sequelize.sync({ alter: true });
        console.log('✅ All tables synced successfully!');
        console.log('✅ ChatMessages table created/updated');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Error syncing database:', error);
        process.exit(1);
    }
}

syncDatabase();