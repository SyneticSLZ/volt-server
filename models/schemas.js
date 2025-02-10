const mongoose = require('mongoose');

// Email Schema
const enhancedEmailSchema = new mongoose.Schema({
    // Original EData fields
    id: String,
    recipient: String,
    from: String,
    UUID: String,
    threadId: String,
    body: String,
    subject: String,
    date: String,
    sentwith: String,
    status: {
        type: String,
        enum: ['pending', 'sent', 'bounced', 'delivered', 'failed', 'opened', 'clicked'],
        default: 'pending'
    },
    customID: String,

    // Queue fields
    messageId: String,
    metadata: {
        name: String,
        website: String
    },
    processedAt: Date,
    sentTime: Date,
    bounces: { type: Boolean, default: false },
    responseCount: { type: Number, default: 0 },
    retryCount: { type: Number, default: 0 },
    errorDetails: String,
    attachments: [{
        filename: String,
        contentType: String,
        size: Number
    }],
    signature: String
});

// Campaign Schema
const enhancedCampaignSchema = new mongoose.Schema({
    // Original fields
    campaignName: String,
    template: String,
    pitch: String,
    sentEmails: [enhancedEmailSchema],
    createdTime: { type: Date, default: Date.now },
    SENT_EMAILS: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    replyRate: { type: Number, default: 0 },

    // Queue fields
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'paused'],
        default: 'pending'
    },
    userEmail: String,
    startedAt: Date,
    completedAt: Date,
    processedEmails: { type: Number, default: 0 },
    successfulEmails: { type: Number, default: 0 },
    failedEmails: { type: Number, default: 0 },
    lastProcessedAt: Date,
    error: String,
    
    template: {
        pitch: String,
        name: String,
        subject: String,
        templateId: String,
        signature: String
    },
    
    priority: { type: Number, default: 1 },
    batchSize: { type: Number, default: 10 },
    progress: {
        currentBatch: Number,
        totalBatches: Number,
        percentage: Number
    }
});

// Mailbox Schema
const mailboxSchema = new mongoose.Schema({
    smtp: {
        host: String,
        port: Number,
        secure: Boolean,
        user: { type: String, required: true },
        pass: String,
        gmail: {
            id: String,
            provider: String,
            email: String,
            accessToken: String,
            refreshToken: String,
            expiresAt: Number
        }
    },
    isActive: { type: Boolean, default: false }
});

// Customer Schema
const customerSchema = new mongoose.Schema({
    stripeID: String,
    email: { type: String, required: true, unique: true },
    plan: String,
    total_emails: { type: Number, default: 0 },
    priceID: String,
    password: String,
    name: String,
    plan_emails: { type: Number, default: 0 },
    affiliate: String,
    totalBounces: { type: Number, default: 0 },
    totalReplies: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    replyRate: { type: Number, default: 0 },
    campaigns: [enhancedCampaignSchema],
    emails: [enhancedEmailSchema],
    mailboxes: [mailboxSchema],
    unsubscribedEmails: { type: [String], default: [] },
    queueSettings: {
        maxConcurrentCampaigns: { type: Number, default: 3 },
        maxDailyEmails: { type: Number, default: 100 },
        warmupPeriod: { type: Number, default: 1 },
        isWarmupEnabled: { type: Boolean, default: true }
    }
});

// Add indexes
enhancedCampaignSchema.index({ status: 1, priority: -1, createdTime: 1 });
enhancedCampaignSchema.index({ userEmail: 1, status: 1 });
enhancedEmailSchema.index({ status: 1, processedAt: 1 });

// Maintain backward compatibility
enhancedCampaignSchema.pre('save', function(next) {
    if (this.isModified('successfulEmails')) {
        this.SENT_EMAILS = this.successfulEmails;
    }
    next();
});

// Create models
const EData = mongoose.models.EData || mongoose.model('EData', enhancedEmailSchema);
const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', enhancedCampaignSchema);
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
const Mailbox = mongoose.models.Mailbox || mongoose.model('Mailbox', mailboxSchema);

module.exports = {
    EData,
    Campaign,
    Customer,
    Mailbox,
    enhancedEmailSchema,
    enhancedCampaignSchema,
    customerSchema,
    mailboxSchema
};