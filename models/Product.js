const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    productName: String,
    productImage: [{
        image: { type: String, required: true },
    }],
    productDescription: string,
    productFeatures: string,
    howToUse: string,
    precautions: string,
    note: string,
    usersBuyed: [{
        userId: { type: String, required: true },
        userName: { type: String, required: true },
        userShopName: { type: String, required: true },
        userTown: { type: String, required: true },
        userState: { type: String, required: true },
        quandity: { type: Number, required: true },
        orderId: { type: String, required: true },
    }],
    mrp: Number,
    weight: String,
    unit: String,
    rate: Number,
}, { timestamps: true });

productSchema.index({ name: "text" });

module.exports = mongoose.model('Product', productSchema);