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
    status: String, // e.g., sent, bounced, delivered
    bounces: { type: Boolean, default: false },
    responseCount: { type: Number, default: 0 }
});

const campaignSchema = new mongoose.Schema({
    campaignName: String,
    sentEmails: [emailSchema], // Array of sent emails
    createdTime: Date,
    SENT_EMAILS: { type: Number, default: 0 }
});

const customerSchema = new mongoose.Schema({
    stripeID: String,
    email: { type: String, required: true, unique: true },
    plan: String,
    total_emails: Number,
    priceID: String,
    password: String,
    name: String,
    plan_emails: Number,
    affiliate: String,
    campaigns: [campaignSchema] // Array of campaigns
});

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
