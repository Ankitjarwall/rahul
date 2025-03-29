const mongoose = require('mongoose');

const ORDER_SCHEMA = new mongoose.Schema({
    ORDER_ID: { type: String, required: true, unique: true },
    USER_ID: { type: String },
    SHOP_NAME: { type: String },
    ADDRESS: { type: String },
    TOWN: { type: String },
    CONTACT: { type: String },
    PRODUCT_DETAILS: { type: String },
    WEIGHT: { type: String },
    RATE: { type: String },
    PIECE: { type: String },
    FREE: { type: String },
    AMOUNT: { type: String },
    PAYMENT_METHOD: { type: String },
    DUES: { type: String },
    TOTAL_OUTSTANDING: { type: String },
    FINAL_AMOUNT: { type: String },
    COMMENTS: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ORDER', ORDER_SCHEMA);