const mongoose = require('mongoose');

const QCampaignSchema = new mongoose.Schema({
    userEmail: { 
        type: String, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['pending', 'processing', 'completed', 'failed'],
        default: 'pending'
    },
    template: {
        pitch: String,
        name: String,
        subject: String,
        templateId: String,
        signature: String
    },
    emails: [{
        recipient: String,
        metadata: {
            website: String,
            name: String
        },
        status: String,
        sentAt: Date,
        messageId: String,
        updatedAt: Date
    }],
    attachments: [{
        filename: String,
        contentType: String,
        data: Buffer,
        size: Number
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    startedAt: Date,
    completedAt: Date,
    failedAt: Date,
    scheduledFor: Date,
    processedEmails: { 
        type: Number, 
        default: 0 
    },
    successfulEmails: { 
        type: Number, 
        default: 0 
    },
    failedEmails: { 
        type: Number, 
        default: 0 
    },
    warmupDays: {
        type: Number,
        default: 1,
        min: 1,
        max: 30
    },
    error: String,
    metrics: {
        successRate: Number,
        completionTime: Number
    },
    progress: {
        currentBatch: Number,
        totalBatches: Number,
        percentage: Number
    }
});

module.exports = mongoose.model('QCampaign', QCampaignSchema);