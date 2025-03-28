const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    PRODUCTID: { type: String, required: true, unique: true },
    PRODUCTDETAILS: String,
    PRODUCTIMAGE: String,
    MRP: Number,
    WEIGHT: String,
    RATE: Number,
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);