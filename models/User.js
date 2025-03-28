const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
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