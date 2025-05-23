const mongoose = require('mongoose');

const productHistorySchema = new mongoose.Schema({
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productName: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userShopName: { type: String, required: true },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    orderIdString: { type: String, required: true } // New field for text search
}, { timestamps: true });

productHistorySchema.index({ productId: 1, userId: 1 });
productHistorySchema.index({
    "productName": 'text',
    "userShopName": 'text',
    "orderIdString": 'text' // Text index on the string field
});

module.exports = mongoose.model('ProductHistory', productHistorySchema);