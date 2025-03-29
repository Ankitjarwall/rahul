const mongoose = require('mongoose');

// Order Schema
const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },

    // User Details
    user: {
        userId: { type: String, required: true },
        shopName: { type: String, required: true },
        address: { type: String, required: true },
        town: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: Number, required: true },
        contact: { type: String, required: true },
        userDues: { type: Number, default: 0 }
    },

    // Product Details (Array of Products)
    productDetails: [{
        name: { type: String, required: true },
        description: String,
        weight: { type: Number, required: true },
        rate: { type: Number, required: true },
        quantity: { type: Number, required: true },
        free: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true }
    }],

    // Billing Details
    billing: {
        totalWeight: { type: Number, required: true },
        totalAmount: { type: Number, required: true },
        paymentMethod: { type: String, required: true },
        dues: { type: Number, default: 0 },
        totalOutstanding: { type: Number, default: 0 },
        finalAmount: { type: Number, required: true }
    },

    comments: { type: String, default: "" }

}, { timestamps: true });

// Index for search functionality
orderSchema.index({
    "user.shopName": "text",
    "user.address": "text",
    "billing.paymentMethod": "text"
});

module.exports = mongoose.model('Order', orderSchema);
