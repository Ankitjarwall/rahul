const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    productId: { type: String, required: true, unique: true },
    productName: String,
    productImage: [{
        image: { type: String, required: true },
    }],
    productDescription: [{
        title: { type: String, required: true },
        description: { type: String, required: true }
    }],
    productFeatures: [{
        feature: { type: String, required: true }
    }],
    howToUse: [{
        step: { type: String, required: true },
    }],
    precautions: [{
        precaution: { type: String, required: true }
    }],
    note: [{
        note: { type: String, required: true }
    }],
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