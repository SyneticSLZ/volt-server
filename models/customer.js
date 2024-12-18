const mongoose = require('mongoose');

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

const EDataSchema = new mongoose.Schema({
    id: String,
    recipient:String,
    from:String,
    UUID:String,
    threadId:String,
    body:String,
    subject:String,
    date:String,
    sentwith:String,
    status:String,
    customID:String
});

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

const mailboxSchema = new mongoose.Schema({
    smtp: {
        host: { type: String },
        port: { type: Number},
        secure: { type: Boolean }, // true for 465, false for other ports
        user: { type: String, required: true },   // SMTP username
        pass: { type: String },
        gmail:
        {
            id:{ type: String},
            provider: { type: String},
            email: { type: String },
            accessToken: { type: String },
            refreshToken:{ type: String},
            expiresAt: { type: Number }
        }   // SMTP password
    },  
    isActive: { type: Boolean, default: false }
});


// Define Customer Schema
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
    campaigns: [campaignSchema],
    emails: [EDataSchema],
    mailboxes: [mailboxSchema],
    unsubscribedEmails: { type: [String], default: [] } // New field for unsubscribed emails
});
// const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);


// module.exports = Customer;

// Create Models
const Email = mongoose.models.Email || mongoose.model('Email', emailSchema);
const EData = mongoose.models.EData || mongoose.model('EData', EDataSchema );
const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
const Mailbox = mongoose.models.Mailbox || mongoose.model('Mailbox', mailboxSchema);

// Export the models and schemas
module.exports = {
    Email,
    EData,
    Campaign,
    Customer,
    Mailbox,
    emailSchema,
    EDataSchema,
    campaignSchema,
    customerSchema,
    mailboxSchema
};