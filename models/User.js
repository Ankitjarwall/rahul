const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    USERID: { type: String, required: true, unique: true },
    SHOPNAME: String,
    ADDRESS: String,
    TOWN: String,
    STATE: String,
    PINCODE: String,
    CONTACT: String,
    DUES: Number,
    COMMENTS: String,
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);