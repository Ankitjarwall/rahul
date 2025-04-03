const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    productName: String,
    productImage: String,
    productDetails: String,
    productFeatures: String,
    howToUse: String,
    precautions: String,
    note: String,
    mrp: Number,
    weight: String,
    unit: String,
    rate: Number,
}, { timestamps: true });

productSchema.index({ name: "text" });

module.exports = mongoose.model('Product', productSchema);