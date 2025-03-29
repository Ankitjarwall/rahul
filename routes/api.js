const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

// Function to check for missing fields
const validateFields = (requiredFields, data) => {
    for (const field of requiredFields) {
        if (!data[field]) {
            return field;
        }
    }
    return null;
};

// Generate Order ID
const generateOrderId = async () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const datePrefix = `${day}${month}${year}`;

    const count = await Order.countDocuments({ orderId: { $regex: `^${datePrefix}` } });
    return `${datePrefix}OR${count + 1}`;
};

// Generate User ID
const generateUserId = async (userData) => {
    const state = (userData.state || 'NA').toUpperCase().slice(0, 2);
    const pincode = userData.pincode || userData.town || '000000';
    const username = (userData.username || userData.shopName || 'Unknown').replace(/\s+/g, '');

    const count = await User.countDocuments({ userId: { $regex: `^${state}${pincode}${username}` } });
    return `${state}${pincode}${username}${String(count + 1).padStart(2, '0')}`;
};

// Orders
router.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/orders', async (req, res) => {
    const requiredFields = ['customerName', 'product', 'quantity', 'price'];
    const missingField = validateFields(requiredFields, req.body);
    if (missingField) {
        return res.status(400).json({ error: `${missingField} is empty` });
    }

    try {
        const orderId = await generateOrderId();
        const order = new Order({ ...req.body, orderId });
        await order.save();
        res.json({ success: 'Order added successfully', orderId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/orders', async (req, res) => {
    try {
        const { orderId, ...updates } = req.body;
        const order = await Order.findOneAndUpdate({ orderId }, updates, { new: true });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: 'Order updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Users
router.post('/users', async (req, res) => {
    const requiredFields = ['username', 'email', 'state', 'pincode'];
    const missingField = validateFields(requiredFields, req.body);
    if (missingField) {
        return res.status(400).json({ error: `${missingField} is empty` });
    }

    try {
        const userId = await generateUserId(req.body);
        const user = new User({ ...req.body, userId });
        await user.save();
        res.json({ success: 'User added successfully', userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/users', async (req, res) => {
    try {
        const { userId, ...updates } = req.body;
        const user = await User.findOneAndUpdate({ userId }, updates, { new: true });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Products
router.post('/products', async (req, res) => {
    const requiredFields = ['productName', 'category', 'price', 'stock'];
    const missingField = validateFields(requiredFields, req.body);
    if (missingField) {
        return res.status(400).json({ error: `${missingField} is empty` });
    }

    try {
        const count = await Product.countDocuments();
        const productId = String(count + 1);
        const product = new Product({ ...req.body, productId });
        await product.save();
        res.json({ success: 'Product added successfully', productId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/products', async (req, res) => {
    try {
        const { productId, ...updates } = req.body;
        const product = await Product.findOneAndUpdate({ productId }, updates, { new: true });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
