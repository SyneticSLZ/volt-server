const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    stripeID: String,
    email: { type: String, required: true, unique: true },
    plan: String,
    total_emails: Number,
    priceID: String,
    password: String,
    name: String,
    plan_emails: Number
});

const Customer = mongoose.model('Customer', customerSchema);

module.exports = Customer;
