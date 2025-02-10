const mongoose = require('mongoose');
const { EventEmitter } = require('events');

class DatabaseManager extends EventEmitter {
    constructor() {
        super();
        this.isConnected = false;
        this.retryAttempts = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000; // 5 seconds
    }

    async connect() {
        try {
            if (this.isConnected) {
                console.log('Already connected to MongoDB');
                return;
            }

            // MongoDB connection options
            const options = {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                autoIndex: true,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
                maxPoolSize: 50,
                minPoolSize: 10,
                maxIdleTimeMS: 10000,
                waitQueueTimeoutMS: 10000
            };

            // Connect to MongoDB
            await mongoose.connect(process.env.MONGO_URI, options);

            this.isConnected = true;
            this.retryAttempts = 0;
            console.log('Connected to MongoDB successfully');

            // Set up connection event handlers
            mongoose.connection.on('error', this.handleError.bind(this));
            mongoose.connection.on('disconnected', this.handleDisconnect.bind(this));
            mongoose.connection.on('reconnected', () => {
                console.log('MongoDB reconnected');
                this.emit('reconnected');
            });

            // Enable debug mode in development
            if (process.env.NODE_ENV === 'development') {
                mongoose.set('debug', true);
            }

            // Create indexes if they don't exist
            await this.ensureIndexes();

            this.emit('connected');
            return true;

        } catch (error) {
            console.error('MongoDB connection error:', error);
            await this.handleConnectionError(error);
            return false;
        }
    }

    async handleConnectionError(error) {
        if (this.retryAttempts < this.maxRetries) {
            this.retryAttempts++;
            console.log(`Retrying connection attempt ${this.retryAttempts} of ${this.maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, this.retryDelay));
            return this.connect();
        } else {
            this.emit('error', error);
            throw new Error('Failed to connect to MongoDB after maximum retry attempts');
        }
    }

    handleError(error) {
        console.error('MongoDB error:', error);
        this.emit('error', error);
    }

    async handleDisconnect() {
        console.log('MongoDB disconnected');
        this.isConnected = false;
        this.emit('disconnected');
        
        // Attempt to reconnect
        if (this.retryAttempts < this.maxRetries) {
            await this.connect();
        }
    }

    async ensureIndexes() {
        try {
            // Ensure indexes for Campaign collection
            await mongoose.model('Campaign').createIndexes();
            
            // Ensure indexes for Customer collection
            await mongoose.model('Customer').createIndexes();
            
            // Ensure indexes for EData collection
            await mongoose.model('EData').createIndexes();

            console.log('Database indexes created successfully');
        } catch (error) {
            console.error('Error creating indexes:', error);
            throw error;
        }
    }

    async disconnect() {
        if (this.isConnected) {
            await mongoose.disconnect();
            this.isConnected = false;
            console.log('Disconnected from MongoDB');
        }
    }

    // Health check method
    async healthCheck() {
        try {
            if (!this.isConnected) {
                return { status: 'disconnected' };
            }

            // Check if we can perform a simple operation
            await mongoose.connection.db.admin().ping();
            
            return {
                status: 'connected',
                retryAttempts: this.retryAttempts,
                poolSize: mongoose.connection.client.topology.connections().length
            };
        } catch (error) {
            return {
                status: 'error',
                error: error.message
            };
        }
    }
}

// Create and export singleton instance
const dbManager = new DatabaseManager();

// Export utility functions
module.exports = {
    dbManager,
    
    // Utility middleware for ensuring database connection
    requireDatabaseConnection: async (req, res, next) => {
        try {
            if (!dbManager.isConnected) {
                await dbManager.connect();
            }
            next();
        } catch (error) {
            res.status(500).json({ error: 'Database connection error' });
        }
    },

    // Health check endpoint
    getDatabaseStatus: async () => {
        return await dbManager.healthCheck();
    }
};