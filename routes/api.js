const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

// Generate Order ID
const generateOrderId = async () => {
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const datePrefix = `${day}${month}${year}`;

    const count = await Order.countDocuments({ ORDERID: { $regex: `^${datePrefix}` } });
    return `${datePrefix}OR${count + 1}`;
};

// Generate User ID
const generateUserId = async (userData) => {
    const state = (userData.STATE || 'NA').toUpperCase().slice(0, 2);
    const pincode = userData.PINCODE || userData.TOWN || '000000';
    const username = (userData.USERNAME || userData.SHOPNAME || 'Unknown').replace(/\s+/g, '');

    const count = await User.countDocuments({ USERID: { $regex: `^${state}${pincode}${username}` } });
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
    try {
        const ORDERID = await generateOrderId();
        const order = new Order({ ...req.body, ORDERID });
        await order.save();
        res.json({ success: 'Order added successfully', ORDERID });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/orders', async (req, res) => {
    try {
        const { ORDERID, ...updates } = req.body;
        const order = await Order.findOneAndUpdate({ ORDERID }, updates, { new: true });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: 'Order updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/orders/search', async (req, res) => {
    try {
        const { QUERY } = req.body;
        if (!QUERY) return res.status(400).json({ error: 'No search query provided' });
        const orders = await Order.find({ $text: { $search: QUERY } });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Users
router.get('/users', async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/users', async (req, res) => {
    try {
        const USERID = await generateUserId(req.body);
        const user = new User({ ...req.body, USERID });
        await user.save();
        res.json({ success: 'User added successfully', USERID });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/users', async (req, res) => {
    try {
        const { USERID, ...updates } = req.body;
        const user = await User.findOneAndUpdate({ USERID }, updates, { new: true });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/users/search', async (req, res) => {
    try {
        const { QUERY } = req.body;
        if (!QUERY) return res.status(400).json({ error: 'No search query provided' });
        const users = await User.find({ $text: { $search: QUERY } });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Products
router.get('/products', async (req, res) => {
    try {
        const products = await Product.find();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/products', async (req, res) => {
    try {
        const count = await Product.countDocuments();
        const PRODUCTID = String(count + 1);
        const product = new Product({ ...req.body, PRODUCTID });
        await product.save();
        res.json({ success: 'Product added successfully', PRODUCTID });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/products', async (req, res) => {
    try {
        const { PRODUCTID, ...updates } = req.body;
        const product = await Product.findOneAndUpdate({ PRODUCTID }, updates, { new: true });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/products/search', async (req, res) => {
    try {
        const { QUERY } = req.body;
        if (!QUERY) return res.status(400).json({ error: 'No search query provided' });
        const products = await Product.find({ $text: { $search: QUERY } });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
