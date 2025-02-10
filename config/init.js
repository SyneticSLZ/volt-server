const { dbManager } = require('./database');
const models = require('../models/schemas');

async function initializeDatabase() {
    try {
        // Connect to database
        await dbManager.connect();

        // Set up event listeners
        dbManager.on('error', (error) => {
            console.error('Database error:', error);
            // Implement your error notification system here
        });

        dbManager.on('disconnected', () => {
            console.log('Database disconnected');
            // Implement your disconnection handling here
        });

        dbManager.on('reconnected', () => {
            console.log('Database reconnected');
            // Implement your reconnection handling here
        });

        // Graceful shutdown handling
        process.on('SIGINT', async () => {
            await handleShutdown();
        });

        process.on('SIGTERM', async () => {
            await handleShutdown();
        });

        return true;
    } catch (error) {
        console.error('Database initialization failed:', error);
        process.exit(1);
    }
}

async function handleShutdown() {
    console.log('Received shutdown signal');
    try {
        await dbManager.disconnect();
        console.log('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
    }
}

// Usage in your main server.js file:
/*
const { initializeDatabase } = require('./config/init');

async function startServer() {
    try {
        // Initialize database
        await initializeDatabase();
        
        // Start your Express server
        app.listen(port, () => {
            console.log(`Server is running on port ${port}`);
        });
    } catch (error) {
        console.error('Server startup failed:', error);
        process.exit(1);
    }
}

startServer();
*/

module.exports = {
    initializeDatabase,
    handleShutdown
};