const mongoose = require('mongoose');

const PRODUCT_SCHEMA = new mongoose.Schema({
    PRODUCT_ID: { type: String, required: true, unique: true },
    PRODUCT_DETAILS: { type: String },
    PRODUCT_IMAGE: { type: String },
    MRP: { type: String },
    WEIGHT: { type: String },
    RATE: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('PRODUCT', PRODUCT_SCHEMA);