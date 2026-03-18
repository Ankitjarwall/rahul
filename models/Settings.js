const mongoose = require('mongoose');

// Settings Schema - Single document for app settings
const settingsSchema = new mongoose.Schema({
    // Company Details
    company: {
        name: { type: String, default: '' },
        contactUs: { type: String, default: '' },
        email: { type: String, default: '' },
        regNumber: { type: String, default: '' },
        address: { type: String, default: '' },
        city: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' }
    },

    // App PIN (8 digits)
    appPin: { type: String, default: '0000', minlength: 4, maxlength: 4 }

}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);
