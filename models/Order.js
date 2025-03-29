const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    userId: String,
    shopName: String,
    address: String,
    town: String,
    contact: String,
    productDetails: String,
    weight: String,
    rate: String,
    piece: Number,
    free: Number,
    amount: Number,
    paymentMethod: String,
    dues: Number,
    totalOutstanding: Number,
    finalAmount: Number,
    comments: String,
}, { timestamps: true });

// Pre-save middleware to capitalize string fields
orderSchema.pre('save', function (next) {
    if (this.shopName) this.shopName = this.shopName.toUpperCase();
    if (this.address) this.address = this.address.toUpperCase();
    if (this.town) this.town = this.town.toUpperCase();
    if (this.contact) this.contact = this.contact.toUpperCase();
    if (this.productDetails) this.productDetails = this.productDetails.toUpperCase();
    if (this.weight) this.weight = this.weight.toUpperCase();
    if (this.rate) this.rate = this.rate.toUpperCase();
    if (this.paymentMethod) this.paymentMethod = this.paymentMethod.toUpperCase();
    if (this.comments) this.comments = this.comments.toUpperCase();
    next();
});

module.exports = mongoose.model('Order', orderSchema);