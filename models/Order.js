const mongoose = require('mongoose');

// Order Schema
const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },

    // User Details
    user: {
        userId: { type: String, required: true },
        name: { type: String, required: true },
        shopName: { type: String, required: true },
        userDues: { type: Number, default: 0 },
        address: { type: String, required: true },
        town: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: Number, required: true },
        contact: [
            {
                contact: { type: String, required: true },
                whatsapp: { type: Boolean, default: false }
            }
        ]
    },

    // Product Details
    productDetails: [{
        productId: { type: String, required: true },
        name: { type: String, required: true },
        weight: { type: Number, required: true },
        unit: { type: String, required: true },
        mrp: { type: Number, required: true },
        rate: { type: Number, required: true },
        quantity: { type: Number, required: true },
        totalAmount: { type: Number, required: true },
        image: { type: String, optional: true }
    }],

    // Free Products
    freeProducts: [{
        name: { type: String, required: true, default: "NA" },
        weight: { type: Number, required: true, default: 0 },
        unit: { type: String, required: true, default: "NA" },
        mrp: { type: Number, required: true },
        rate: { type: Number, required: true, default: 0 },
        quantity: { type: Number, required: true, default: 0 },
        totalAmount: { type: Number, required: true, default: 0 }
    }],

    // Billing Details
    billing: {
        orderWeight: { type: Number, required: true },
        orderAmount: { type: Number, required: true },
        deliveryCharges: { type: Number, required: true },
        totalAmount: { type: Number, required: true },
        paymentMethod: { type: String, required: true },
        moneyGiven: { type: Number, required: true },
        pastOrderDue: { type: Number, default: 0 },
        finalAmount: { type: Number, required: true }
    },
    comments: [{
        message: { type: String, default: "" },
        date: { type: String, default: "" }
    }],
    isfreeProducts: { type: Boolean, default: false }
}, { timestamps: true });

// Index for search functionality
orderSchema.index({
    "user.shopName": "text",
    "user.name": "text",
    "user.address": "text",
    "billing.paymentMethod": "text"
});

// Add index on productDetails.name to support $regex queries
orderSchema.index({ "productDetails.name": 1 });

module.exports = mongoose.model('Order', orderSchema);