const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    userId: String,
    shopName: String,
    address: String,
    town: String,
    state: String,
    pincode: Number,
    contact: String,
    productDetails: String,
    weight: String,
    totalWeight: Number,
    rate: String,
    piece: Number,
    free: Number,
    totalAmount: Number,
    paymentMethod: String,
    dues: Number,
    totalOutstanding: Number,
    finalAmount: Number,
    comments: String,
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);