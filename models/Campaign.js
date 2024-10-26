
const mongoose = require('mongoose');



// Define Campaign Schema
const campaignSchema = new mongoose.Schema({
    campaignName: String,
    template: String,
    pitch: String,
    sentEmails: [emailSchema],
    createdTime: { type: Date, default: Date.now },
    SENT_EMAILS: { type: Number, default: 0 },
    bounceRate: { type: Number, default: 0 },
    replyRate: { type: Number, default: 0 }
});

const emailSchema = new mongoose.Schema({
    recipientEmail: String,
    subject: String,
    messageId: String,
    threadId: String,
    sentTime: Date,
    status: { type: String, enum: ['sent', 'bounced', 'delivered'], default: 'sent' },
    bounces: { type: Boolean, default: false },
    responseCount: { type: Number, default: 0 }
});




const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);

module.exports = Campaign;
