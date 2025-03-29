const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

// Generate Unique Order ID
const generateOrderId = async () => {
    try {
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const datePrefix = `${day}${month}${year}`;

        const count = await Order.countDocuments({ orderId: { $regex: `^${datePrefix}` } });
        return `${datePrefix}OR${count + 1}`;
    } catch (error) {
        console.error("Error generating order ID:", error);
        throw new Error("Failed to generate order ID");
    }
};


// Generate User ID
const generateUserId = async (userData) => {
    const state = (userData.state || 'NA').toUpperCase().slice(0, 2);
    const pincode = userData.pincode || userData.town || '000000';
    const username = (userData.username || userData.shopName || 'Unknown').replace(/\s+/g, '');

    const count = await User.countDocuments({ userId: { $regex: `^${state}${pincode}${username}` } });
    return `${state}${pincode}${username}${String(count + 1).padStart(2, '0')}`;
};

// 🟢 GET All Orders
router.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🟢 CREATE New Order
router.post('/orders', async (req, res) => {
    try {
        const { user, productDetails, billing } = req.body;

        // Validate required fields
        if (!user || !productDetails || !billing) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const orderId = await generateOrderId();
        const order = new Order({ ...req.body, orderId });

        await order.save();
        res.json({ success: "Order added successfully", orderId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🟢 UPDATE Order
router.put('/orders', async (req, res) => {
    try {
        const { orderId, ...updates } = req.body;
        if (!orderId) return res.status(400).json({ error: "Order ID is required" });

        const order = await Order.findOneAndUpdate({ orderId }, updates, { new: true, runValidators: true });

        if (!order) return res.status(404).json({ error: "Order not found" });
        res.json({ success: "Order updated successfully", order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🟢 SEARCH Orders
router.post('/orders/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: "No search query provided" });

        const orders = await Order.find({ $text: { $search: query } });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 🟢 DELETE Order
router.delete('/orders', async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) return res.status(400).json({ error: "Order ID is required" });

        const order = await Order.findOneAndDelete({ orderId });
        if (!order) return res.status(404).json({ error: "Order not found" });

        res.json({ success: "Order deleted successfully" });
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

router.post('/users/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'No search query provided' });
        const users = await User.find({ $text: { $search: query } });
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

router.post('/products/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'No search query provided' });
        const products = await Product.find({ $text: { $search: query } });
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;