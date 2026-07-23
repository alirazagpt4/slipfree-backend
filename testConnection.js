import sequelize from './config/database.js';

async function testConnection() {
    try {
        await sequelize.authenticate();
        console.log('✅ Connection successful! MySQL se juṛ gaya.');
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
    }
}

testConnection();