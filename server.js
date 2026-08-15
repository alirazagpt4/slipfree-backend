import 'dotenv/config';
import app from './app/app.js';
import sequelize from './config/database.js';
import { initSyncScheduler } from './jobs/syncRunner.job.js';

const PORT = process.env.PORT || 3000;

async function start() {
    try {
        await sequelize.authenticate();
        // Only sync models in non-production environment
        if (process.env.NODE_ENV !== 'production') {
            await sequelize.sync();
            console.log('✅ Database models synchronized.');
        }
        console.log('✅ Database connected & synced.');

        app.listen(PORT, () => {
            console.log(`🚀 Server running at http://localhost:${PORT}`);

            try {
                initSyncScheduler();
                console.log('⚙️ Retail Pro background sync engine initialized.');
            } catch (cronError) {
                console.error('❌ Failed to initialize Sync Scheduler:', cronError.message);
            }

        });
    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

start();