const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, default: uuidv4 },
    shopName: String,
    address: String,
    town: String,
    state: String,
    pincode: String,
    contact: String,
    dues: Number,
    comments: String,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);