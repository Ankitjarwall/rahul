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

// Helper function to find matched field in a document
const findMatchedField = (doc, query, fieldsToCheck) => {
    const regex = new RegExp(query, 'i');
    const numericQuery = parseFloat(query);
    const isNumeric = !isNaN(numericQuery);

    for (const field of fieldsToCheck) {
        const keys = field.split('.');
        let value = doc;

        // Navigate nested fields
        for (const key of keys) {
            if (value && typeof value === 'object') {
                value = value[key];
            } else {
                value = undefined;
                break;
            }
        }

        // Check arrays (like contact or comments)
        if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === 'object') {
                    // Check nested field in array (e.g., contact.contact, comments.message)
                    const lastKey = keys[keys.length - 1];
                    const nestedValue = item[lastKey] || item;
                    if (typeof nestedValue === 'string' && regex.test(nestedValue)) {
                        return [{ [field]: nestedValue }];
                    }
                } else if (typeof item === 'string' && regex.test(item)) {
                    return [{ [field]: item }];
                }
            }
        }
        // Check string values
        else if (typeof value === 'string' && regex.test(value)) {
            return [{ [field]: value }];
        }
        // Check numeric values
        else if (typeof value === 'number' && isNumeric && value === numericQuery) {
            return [{ [field]: value }];
        }
    }

    return [];
};

// SEARCH PRODUCTS
// Searches: productName, weight, price (mrp/rate), productId
router.get('/products', async (req, res) => {
    try {
        const { error } = searchSchema.validate(req.query, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { q } = req.query;
        const query = q.trim();
        const regex = new RegExp(query, 'i');
        const numericQuery = parseFloat(query);
        const isNumeric = !isNaN(numericQuery);

        const productQuery = {
            $or: [
                { productName: regex },
                { weight: regex },
                { productId: regex },
                ...(isNumeric ? [
                    { mrp: numericQuery },
                    { rate: numericQuery }
                ] : [])
            ]
        };

        const products = await Product.find(productQuery)
            .select('_id productId productName productImage mrp rate weight')
            .lean();

        // Add matched_field to each product
        const fieldsToCheck = ['productName', 'weight', 'productId', 'mrp', 'rate'];
        const productsWithMatch = products.map(product => ({
            ...product,
            matched_field: findMatchedField(product, query, fieldsToCheck)
        }));

        res.json(productsWithMatch);
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// SEARCH ORDERS
// Searches: name, shopName, comments, contact, product name, orderId
router.get('/orders', async (req, res) => {
    try {
        const { error } = searchSchema.validate(req.query, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { q } = req.query;
        const query = q.trim();
        const regex = new RegExp(query, 'i');

        const orderQuery = {
            $or: [
                { orderId: regex },
                { 'user.name': regex },
                { 'user.shopName': regex },
                { 'user.contact.contact': regex },
                { 'productDetails.name': regex },
                { 'comments.message': regex }
            ]
        };

        const orders = await Order.find(orderQuery)
            .select('_id orderId user.name user.shopName user.town user.state user.contact billing.totalAmount productDetails.name comments createdAt')
            .lean();

        // Add matched_field to each order
        const ordersWithMatch = orders.map(order => {
            const matched = findOrderMatchedField(order, query);
            return { ...order, matched_field: matched };
        });

        res.json(ordersWithMatch);
    } catch (error) {
        console.error('Error searching orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function for order matched fields
const findOrderMatchedField = (order, query) => {
    const regex = new RegExp(query, 'i');

    // Check orderId
    if (order.orderId && regex.test(order.orderId)) {
        return [{ orderId: order.orderId }];
    }
    // Check user.name
    if (order.user?.name && regex.test(order.user.name)) {
        return [{ name: order.user.name }];
    }
    // Check user.shopName
    if (order.user?.shopName && regex.test(order.user.shopName)) {
        return [{ shopName: order.user.shopName }];
    }
    // Check user.contact
    if (order.user?.contact && Array.isArray(order.user.contact)) {
        for (const c of order.user.contact) {
            if (c.contact && regex.test(c.contact)) {
                return [{ contact: c.contact }];
            }
        }
    }
    // Check productDetails.name
    if (order.productDetails && Array.isArray(order.productDetails)) {
        for (const p of order.productDetails) {
            if (p.name && regex.test(p.name)) {
                return [{ productName: p.name }];
            }
        }
    }
    // Check comments.message
    if (order.comments && Array.isArray(order.comments)) {
        for (const c of order.comments) {
            if (c.message && regex.test(c.message)) {
                return [{ comment: c.message }];
            }
        }
    }

    return [];
};

// SEARCH USERS
// Searches: name, shopName, userId, address, town, state, pincode, contacts, comments
router.get('/users', async (req, res) => {
    try {
        const { error } = searchSchema.validate(req.query, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { q } = req.query;
        const query = q.trim();
        const regex = new RegExp(query, 'i');
        const numericQuery = parseInt(query);
        const isNumeric = !isNaN(numericQuery);

        const userQuery = {
            $or: [
                { name: regex },
                { shopName: regex },
                { userId: regex },
                { address: regex },
                { town: regex },
                { state: regex },
                { 'contact.contact': regex },
                { 'comments.message': regex },
                ...(isNumeric ? [{ pincode: numericQuery }] : [])
            ]
        };

        const users = await User.find(userQuery)
            .select('_id userId name shopName address town state pincode contact comments')
            .lean();

        // Add matched_field to each user
        const usersWithMatch = users.map(user => {
            const matched = findUserMatchedField(user, query);
            return { ...user, matched_field: matched };
        });

        res.json(usersWithMatch);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// Helper function for user matched fields
const findUserMatchedField = (user, query) => {
    const regex = new RegExp(query, 'i');
    const numericQuery = parseInt(query);
    const isNumeric = !isNaN(numericQuery);

    // Check fields in order of priority
    if (user.name && regex.test(user.name)) {
        return [{ name: user.name }];
    }
    if (user.shopName && regex.test(user.shopName)) {
        return [{ shopName: user.shopName }];
    }
    if (user.userId && regex.test(user.userId)) {
        return [{ userId: user.userId }];
    }
    if (user.address && regex.test(user.address)) {
        return [{ address: user.address }];
    }
    if (user.town && regex.test(user.town)) {
        return [{ town: user.town }];
    }
    if (user.state && regex.test(user.state)) {
        return [{ state: user.state }];
    }
    if (isNumeric && user.pincode === numericQuery) {
        return [{ pincode: user.pincode }];
    }
    // Check contact array
    if (user.contact && Array.isArray(user.contact)) {
        for (const c of user.contact) {
            if (c.contact && regex.test(c.contact)) {
                return [{ contact: c.contact }];
            }
        }
    }
    // Check comments array
    if (user.comments && Array.isArray(user.comments)) {
        for (const c of user.comments) {
            if (c.message && regex.test(c.message)) {
                return [{ comment: c.message }];
            }
        }
    }

    return [];
};

module.exports = router;