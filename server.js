import 'dotenv/config';
import app from './app/app.js';
import sequelize from './config/database.js';

const PORT = process.env.PORT || 3000;

async function start() {
    try {
        await sequelize.authenticate();
        await sequelize.sync();
        console.log('✅ Database connected & synced.');

        app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

start();