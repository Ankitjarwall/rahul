const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, default: uuidv4 },
    name: String,
    shopName: String,
    address: String,
    town: String,
    state: String,
    pincode: Number,
    delivery: Number,
    dues: Number,
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

userSchema.index({
    "name": "text",
    "shopName": "text",
    "state": "text",
    "town": "text",
    "contact.contact": "text" // Fix to index the subfield
});

userSchema.index({ "name": 1, "shopName": 1 });


module.exports = mongoose.model('User', userSchema);