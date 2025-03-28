const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

// Normalize request body keys to uppercase
const normalizeBody = (body) => {
    return Object.keys(body).reduce((acc, key) => {
        acc[key.toUpperCase()] = body[key];
        return acc;
    }, {});
};

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
    const STATE = (userData.STATE || 'NA').toUpperCase().slice(0, 2);
    const PINCODE = userData.PINCODE || userData.TOWN || '000000';
    const USERNAME = (userData.USERNAME || userData.SHOPNAME || 'Unknown').replace(/\s+/g, '');

    const count = await User.countDocuments({ USERID: { $regex: `^${STATE}${PINCODE}${USERNAME}` } });
    return `${STATE}${PINCODE}${USERNAME}${String(count + 1).padStart(2, '0')}`;
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
        const normalizedBody = normalizeBody(req.body);
        const ORDERID = await generateOrderId();
        const order = new Order({ ...normalizedBody, ORDERID });
        await order.save();
        res.json({ success: 'Order added successfully', ORDERID });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/orders', async (req, res) => {
    try {
        const normalizedBody = normalizeBody(req.body);
        const { ORDERID, ...updates } = normalizedBody;
        const order = await Order.findOneAndUpdate({ ORDERID }, updates, { new: true });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: 'Order updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/orders/search', async (req, res) => {
    try {
        const normalizedBody = normalizeBody(req.body);
        const { QUERY } = normalizedBody;
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
        const normalizedBody = normalizeBody(req.body);
        const { SHOPNAME, USERNAME } = normalizedBody;
        if (!SHOPNAME && !USERNAME) {
            return res.status(400).json({ error: 'SHOPNAME or USERNAME is required' });
        }

        const USERID = await generateUserId(normalizedBody);
        const user = new User({ ...normalizedBody, USERID });
        await user.save();
        res.json({ success: 'User added successfully', USERID });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/users', async (req, res) => {
    try {
        const normalizedBody = normalizeBody(req.body);
        const { USERID, ...updates } = normalizedBody;
        const user = await User.findOneAndUpdate({ USERID }, updates, { new: true });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: 'User updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/users/search', async (req, res) => {
    try {
        const normalizedBody = normalizeBody(req.body);
        const { QUERY } = normalizedBody;
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
        const normalizedBody = normalizeBody(req.body);
        const count = await Product.countDocuments();
        const PRODUCTID = String(count + 1);
        const product = new Product({ ...normalizedBody, PRODUCTID });
        await product.save();
        res.json({ success: 'Product added successfully', PRODUCTID });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/products', async (req, res) => {
    try {
        const normalizedBody = normalizeBody(req.body);
        const { PRODUCTID, ...updates } = normalizedBody;
        const product = await Product.findOneAndUpdate({ PRODUCTID }, updates, { new: true });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: 'Product updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/products/search', async (req, res) => {
    try {
        const normalizedBody = normalizeBody(req.body);
        const { QUERY } = normalizedBody;
        if (!QUERY) return res.status(400).json({ error: 'No search query provided' });
        const products = await Product.find({ $text: { $search: QUERY } });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;