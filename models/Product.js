const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    productDetails: String,
    productImage: String,
    mrp: Number,
    weight: String,
    unit: String,
    rate: Number,
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);