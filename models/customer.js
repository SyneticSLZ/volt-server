// const mongoose = require('mongoose');

// const customerSchema = new mongoose.Schema({
//     stripeID: String,
//     email: { type: String, required: true, unique: true },
//     plan: String,
//     total_emails: Number,
//     priceID: String,
//     password: String,
//     name: String,
//     plan_emails: Number,
//     affiliate: String
// });

// const Customer = mongoose.model('Customer', customerSchema);

// module.exports = Customer;

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
        host: { type: String, required: true },
        port: { type: Number, required: true },
        secure: { type: Boolean, required: true }, // true for 465, false for other ports
        user: { type: String, required: true },   // SMTP username
        pass: { type: String, required: true }    // SMTP password
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
    mailboxes: [mailboxSchema],
    unsubscribedEmails: { type: [String], default: [] } // New field for unsubscribed emails
});
// const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);


// module.exports = Customer;

// Create Models
const Email = mongoose.models.Email || mongoose.model('Email', emailSchema);
const Campaign = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
const Mailbox = mongoose.models.Mailbox || mongoose.model('Mailbox', mailboxSchema);

// Export the models and schemas
module.exports = {
    Email,
    Campaign,
    Customer,
    Mailbox,
    emailSchema,
    campaignSchema,
    customerSchema,
    mailboxSchema
};