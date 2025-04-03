const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

// Function to convert a string to a number
const convertToNumber = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const number = parseFloat(value.replace(/,/g, ''));
        return isNaN(number) ? 0 : number;
    }
    return 0;
};

// Route to convert string into a number
router.post('/cal', (req, res) => {
    const { value } = req.body;
    if (!value) {
        return res.status(400).json({ error: "No value provided" });
    }
    const number = convertToNumber(value);
    res.json({ convertedValue: number });
});

// Function for multiplication
router.post('/multi', (req, res) => {
    const { value1, value2 } = req.body;
    if (value1 === undefined || value2 === undefined) {
        return res.status(400).json({ error: "Missing values for multiplication" });
    }
    const result = convertToNumber(value1) * convertToNumber(value2);
    res.json({ result });
});

// Function for addition
router.post('/add', (req, res) => {
    const { value1, value2 } = req.body;
    if (value1 === undefined || value2 === undefined) {
        return res.status(400).json({ error: "Missing values for addition" });
    }
    const result = convertToNumber(value1) + convertToNumber(value2);
    res.json({ result });
});

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

// GET All Orders
router.get('/orders', async (req, res) => {
    try {
        const orders = await Order.find();
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// CREATE New Order
router.post('/orders', async (req, res) => {
    try {
        const { user, productDetails, freeProducts, billing, isfreeProducts, comments } = req.body;

        // Validate required fields
        if (!user || !productDetails || !billing) {
            return res.status(400).json({ error: "Missing required fields: user, productDetails, and billing are required" });
        }

        // Validate and format user details
        const requiredUserFields = ["userId", "shopName", "userDues", "address", "town", "state", "pincode", "contact"];
        for (const field of requiredUserFields) {
            if (user[field] === undefined || user[field] === null) {
                return res.status(400).json({ error: `Missing required user field: ${field}` });
            }
        }

        // Ensure user.contact is an array of objects
        if (!Array.isArray(user.contact)) {
            return res.status(400).json({ error: "User contact must be an array" });
        }
        user.contact = user.contact.map(contact => ({
            contact_1: contact.contact_1 || String(contact),
            contact_2: contact.contact_2 || ""
        }));

        // Validate pincode and contact format
        if (!/^\d{6}$/.test(user.pincode.toString())) {
            return res.status(400).json({ error: "Invalid pincode. Must be 6 digits." });
        }
        for (const contact of user.contact) {
            if (!/^\d{10}$/.test(contact.contact_1)) {
                return res.status(400).json({ error: "Invalid contact number. Must be 10 digits." });
            }
        }

        // Validate user.comments (optional, but must be an array if provided)
        if (user.comments && !Array.isArray(user.comments)) {
            return res.status(400).json({ error: "User comments must be an array" });
        }
        user.comments = (user.comments || []).map(comment => ({
            message: comment.message || String(comment),
            date: comment.date || Date.now()
        }));

        // Validate product details
        if (!Array.isArray(productDetails) || productDetails.length === 0) {
            return res.status(400).json({ error: "Product details must be a non-empty array" });
        }
        for (const product of productDetails) {
            const requiredProductFields = ["name", "weight", "unit", "rate", "quantity", "totalAmount"];
            for (const field of requiredProductFields) {
                if (product[field] === undefined || product[field] === null) {
                    return res.status(400).json({ error: `Missing required product field: ${field}` });
                }
            }
        }

        // Validate free products if applicable
        if (isfreeProducts) {
            if (!Array.isArray(freeProducts) || freeProducts.length === 0) {
                return res.status(400).json({ error: "Free products must be provided if isfreeProducts is true" });
            }
        }

        // Validate top-level comments (optional, but must be an array if provided)
        if (comments && !Array.isArray(comments)) {
            return res.status(400).json({ error: "Top-level comments must be an array" });
        }
        const formattedComments = (comments || []).map(comment => ({
            message: comment.message || String(comment),
            date: comment.date || Date.now()
        }));

        // Generate unique Order ID
        const orderId = await generateOrderId();

        // Create and save the order
        const order = new Order({ ...req.body, orderId, comments: formattedComments });
        await order.save();

        res.status(201).json({ success: "Order added successfully", order });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE Order
router.put('/orders', async (req, res) => {
    try {
        const { orderId, ...updates } = req.body;

        if (!orderId) return res.status(400).json({ error: "Order ID is required" });

        const order = await Order.findOneAndUpdate(
            { orderId },
            { $set: updates },
            { new: true, runValidators: true }
        );

        if (!order) return res.status(404).json({ error: "Order not found" });

        res.json({ success: "Order updated successfully", order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SEARCH Orders
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

// DELETE Order
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

        const productData = {
            productId,
            productName: req.body.productName,
            productImage: req.body.productImage.map(img => ({ image_1: img })),
            productDescription: req.body.productDescription,
            productFeatures: req.body.productFeatures,
            howToUse: req.body.howToUse,
            precautions: req.body.precautions,
            note: req.body.note,
            mrp: req.body.mrp,
            weight: req.body.weight,
            unit: req.body.unit,
            rate: req.body.rate,
        };

        const product = new Product(productData);
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