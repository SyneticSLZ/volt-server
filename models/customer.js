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
    campaigns: [campaignSchema]
});
const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);


module.exports = Customer;
