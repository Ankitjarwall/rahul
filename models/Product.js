const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    productName: String,
    productImage: [{
        image: { type: String, required: true },
    }],
    productDescription: String,
    productFeatures: String,
    howToUse: String,
    precautions: String,
    note: String,
    mrp: Number,
    weight: String,
    unit: String,
    rate: Number,
}, { timestamps: true });

productSchema.index({ productName: "text" });

module.exports = mongoose.model('Product', productSchema);