const mongoose = require('mongoose');
const productHistorySchema = new mongoose.Schema({
    productId: { type: String, required: true }, // Changed to String
    userId: { type: String, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
}, { timestamps: true });
productHistorySchema.index({ productId: 1, userId: 1 });
module.exports = mongoose.model('ProductHistory', productHistorySchema);