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

productSchema.index({
    "productName": "text",
    "weight": "text",
    "productId": "text"
});

// Fix typo in the regular index
productSchema.index({ "productName": 1 });

module.exports = mongoose.model('Product', productSchema);