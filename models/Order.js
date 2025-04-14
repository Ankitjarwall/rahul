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
                contact: { type: String, required: false },
                whatsapp: { type: Boolean},
            },
        ],
        comments: [{
            message: { type: String, default: "" },
            date: { type: Date, default: Date.now }
        }]
    },


    // Product Details
    productDetails: [{
        name: { type: String, required: true },
        weight: { type: Number, required: true },
        unit: { type: String, required: true },
        rate: { type: Number, required: true },
        quantity: { type: Number, required: true },
        totalAmount: { type: Number, required: true }
    }],

    // Free Products
    freeProducts: [{
        name: { type: String, required: true, default: "NA" },
        weight: { type: Number, required: true, default: 0 },
        unit: { type: String, required: true, default: "NA" },
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
        paidAmount: { type: Number, default: 0 },
        finalAmount: { type: Number, required: true }
    },

    isfreeProducts: { type: Boolean, default: false },
    comments: [{
        message: { type: String, default: "" },
        date: { type: Date, default: Date.now }
    }]

}, { timestamps: true });

// Index for search functionality
orderSchema.index({
    "user.shopName": "text",
    "user.name": "text",
    "user.address": "text",
    "billing.paymentMethod": "text"
});

module.exports = mongoose.model('Order', orderSchema);
