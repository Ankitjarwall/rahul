const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    productDetails: String,
    productImage: String,
    mrp: Number,
    weight: String,
    rate: Number,
}, { timestamps: true });

// Pre-save middleware to capitalize string fields
productSchema.pre('save', function (next) {
    if (this.productDetails) this.productDetails = this.productDetails.toUpperCase();
    if (this.productImage) this.productImage = this.productImage.toUpperCase();
    if (this.weight) this.weight = this.weight.toUpperCase();
    next();
});

module.exports = mongoose.model('Product', productSchema);