const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, default: uuidv4 },
    name: String,
    shopName: String,
    address: String,
    town: String,
    state: String,
    pincode: String,
    delivery: Number,
    dues: Number,
    orderHistory_products:
        [{
            orderId: { type: String, required: true },
            orderDate: { type: Date, default: Date.now },
            orderImage: { type: String, required: true },
            orderName: { type: String, required: true },
            orderPaymentMethod: { type: String, required: true },
            orderAmount: { type: Number, required: true },
        }],
    orderHistory_freeProducts:
        [{
            orderId: { type: String, required: true },
            orderDate: { type: Date, default: Date.now },
            orderImage: { type: String, required: true },
            orderImage: { type: String, required: true },
            orderName: { type: String, required: true },
        }],
    contact: [
        {
            contact: { type: String, required: false, default: "" },
            whatsapp: { type: Boolean, default: false },
        },
    ],
    comments: [{
        message: { type: String, default: "" },
        date: { type: String, default: "" }
    }],
}, { timestamps: true });

userSchema.index({ name: "text", shopName: "text", state: "text", town: "text", dues: "text", contact: "text", });

module.exports = mongoose.model('User', userSchema);