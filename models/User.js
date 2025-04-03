const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, default: uuidv4 },
    name: String,
    shopName: String,
    address: String,
    town: String,
    state: String,
    pincode: String,
    delivery: Number,
    dues: Number,
    contact: [{
        contact_1: { type: String, required: true },
        contact_2: { type: String, required: false }
    }],
    comments: [{
        message: { type: String, default: "" },
        date: { type: Date, default: Date.now }
    }]
}, { timestamps: true });

userSchema.index({ name: "text", shopName: "text" });

module.exports = mongoose.model('User', userSchema);