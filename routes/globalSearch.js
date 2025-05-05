const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const Joi = require('joi');

// Validation schema for the search query
const searchSchema = Joi.object({
    q: Joi.string().required().min(1)
});

// SEARCH PRODUCTS
router.get('/products', async (req, res) => {
    try {
        // Validate query parameter
        const { error } = searchSchema.validate(req.query, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { q } = req.query;
        const query = q.trim();
        const numericQuery = parseFloat(query);
        const isNumeric = !isNaN(numericQuery);

        // Search Products
        const productQuery = {
            $or: [
                { $text: { $search: query } }, // Search productName, weight, productId
                ...(isNumeric ? [
                    { mrp: numericQuery },
                    { rate: numericQuery }
                ] : [])
            ]
        };
        const products = await Product.find(productQuery)
            .select('_id productId productName productImage mrp rate')
            .lean();

        res.json(products);
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// SEARCH ORDERS
router.get('/orders', async (req, res) => {
    try {
        // Validate query parameter
        const { error } = searchSchema.validate(req.query, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { q } = req.query;
        const query = q.trim();
        const numericQuery = parseFloat(query);
        const isNumeric = !isNaN(numericQuery);

        // Search Orders
        const orderTextQuery = {
            $or: [
                { $text: { $search: query } }, // Search user.shopName, user.name, user.address, billing.paymentMethod
                { 'productDetails.name': { $regex: query, $options: 'i' } }
            ]
        };
        const orderNumericQuery = isNumeric ? {
            $or: [
                { 'billing.totalAmount': numericQuery },
                { 'billing.finalAmount': numericQuery }
            ]
        } : {};
        const orderQuery = {
            $or: [
                orderTextQuery,
                ...(isNumeric ? [orderNumericQuery] : [])
            ]
        };
        const orders = await Order.find(orderQuery)
            .select('_id orderId user.name user.shopName user.town user.state billing.totalAmount productDetails.name createdAt')
            .lean();

        res.json(orders);
    } catch (error) {
        console.error('Error searching orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// SEARCH USERS
router.get('/users', async (req, res) => {
    try {
        // Validate query parameter
        const { error } = searchSchema.validate(req.query, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { q } = req.query;
        const query = q.trim();
        const numericQuery = parseFloat(query);
        const isNumeric = !isNaN(numericQuery);

        // Search Users
        const userQuery = {
            $or: [
                { $text: { $search: query } }, // Search name, shopName, state, town, contact.contact
                ...(isNumeric ? [{ dues: numericQuery }] : [])
            ]
        };
        const users = await User.find(userQuery)
            .select('_id userId name shopName town state contact')
            .lean();

        res.json(users);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;