const path = require('path');
const { EventEmitter } = require('events');
const pLimit = require('p-limit');

// Queue system configuration
const QUEUE_CONFIG = {
    maxConcurrentCampaigns: 15,
    maxCampaignsPerUser: 3,
    batchSize: 10,
    retryAttempts: 3,
    retryDelay: 5000,
    delays: {
        minDelay: 120000,  // 2 minutes
        maxDelay: 300000,  // 5 minutes
        errorDelay: 300000 // 5 minutes
    },
    warmup: {
        startingLimit: 20,
        maxLimit: 100,
        incrementPerDay: 10
    }
};

// Email send limits per timeframe
const RATE_LIMITS = {
    perSecond: 1,
    perMinute: 20,
    perHour: 200,
    perDay: 500
};

// Error types and handling configurations
const ERROR_TYPES = {
    RATE_LIMIT: 'RATE_LIMIT',
    AUTH_ERROR: 'AUTH_ERROR',
    NETWORK_ERROR: 'NETWORK_ERROR',
    MAILBOX_ERROR: 'MAILBOX_ERROR',
    RECIPIENT_ERROR: 'RECIPIENT_ERROR'
};

const ERROR_HANDLING = {
    [ERROR_TYPES.RATE_LIMIT]: {
        retryAfter: 3600000, // 1 hour
        maxRetries: 3
    },
    [ERROR_TYPES.AUTH_ERROR]: {
        retryAfter: 300000, // 5 minutes
        maxRetries: 2
    },
    [ERROR_TYPES.NETWORK_ERROR]: {
        retryAfter: 60000, // 1 minute
        maxRetries: 5
    },
    [ERROR_TYPES.MAILBOX_ERROR]: {
        retryAfter: 1800000, // 30 minutes
        maxRetries: 2
    },
    [ERROR_TYPES.RECIPIENT_ERROR]: {
        retryAfter: 0, // Don't retry
        maxRetries: 0
    }
};

class QueueEvents extends EventEmitter {
    constructor() {
        super();
        this.setMaxListeners(20);
    }
}

const queueEvents = new QueueEvents();

module.exports = {
    QUEUE_CONFIG,
    RATE_LIMITS,
    ERROR_TYPES,
    ERROR_HANDLING,
    queueEvents
};