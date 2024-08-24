const mongoose = require('mongoose');

// Define a schema for the Rally-Drivers collection
const driverSchema = new mongoose.Schema({
    name: String,
    url: String,
    email: String,
    nextRace: String,
    emailSent: String,
    raceDone: String
});

// Create a model based on the schema
const Driver = mongoose.model('Driver', driverSchema);

module.exports = Driver;
