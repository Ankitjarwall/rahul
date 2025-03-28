const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    ORDERID: { type: String, required: true, unique: true },
    USERID: String,
    SHOPNAME: String,
    ADDRESS: String,
    TOWN: String,
    CONTACT: String,
    PRODUCTDETAILS: String,
    WEIGHT: String,
    RATE: String,
    PIECE: Number,
    FREE: Number,
    AMOUNT: Number,
    PAYMENTMETHOD: String,
    DUES: Number,
    TOTALOUTSTANDING: Number,
    FINALAMOUNT: Number,
    COMMENTS: String,
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);