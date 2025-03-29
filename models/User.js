const mongoose = require('mongoose');

const USER_SCHEMA = new mongoose.Schema({
    USER_ID: { type: String, required: true, unique: true },
    SHOP_NAME: { type: String },
    ADDRESS: { type: String },
    TOWN: { type: String },
    STATE: { type: String },
    PINCODE: { type: String },
    CONTACT: { type: String },
    DUES: { type: String },
    COMMENTS: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('USER', USER_SCHEMA);