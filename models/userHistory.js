const mongoose = require('mongoose');

const userHistorySchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userShopName: { type: String, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true }
}, { timestamps: true });

userHistorySchema.index({ userId: 1, productId: 1 });
userHistorySchema.index({ productName: 'text', userShopName: 'text' });

module.exports = mongoose.model('UserHistory', userHistorySchema);