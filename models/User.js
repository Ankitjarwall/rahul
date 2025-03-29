const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    shopName: String,
    address: String,
    town: String,
    state: String,
    pincode: String,
    contact: String,
    dues: Number,
    comments: String,
}, { timestamps: true });

// Pre-save middleware to capitalize string fields
userSchema.pre('save', function (next) {
    if (this.shopName) this.shopName = this.shopName.toUpperCase();
    if (this.address) this.address = this.address.toUpperCase();
    if (this.town) this.town = this.town.toUpperCase();
    if (this.state) this.state = this.state.toUpperCase();
    if (this.pincode) this.pincode = this.pincode.toUpperCase();
    if (this.contact) this.contact = this.contact.toUpperCase();
    if (this.comments) this.comments = this.comments.toUpperCase();
    next();
});

module.exports = mongoose.model('User', userSchema);