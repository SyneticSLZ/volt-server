
const mongoose = require('mongoose');

// Define Email Schema
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






const Email = mongoose.model.Email || mongoose.model('Customer', emailSchema);

module.exports = Email;
