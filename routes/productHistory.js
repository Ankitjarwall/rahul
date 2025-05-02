const express = require('express');
const router = express.Router();
const ProductHistory = require('../models/productHistory');
const Joi = require('joi');
const Product = require('../models/Product');
const User = require('../models/User');

// Validation schema for ProductHistory
const productHistorySchema = Joi.object({
    productId: Joi.string().required(), // Expects Product.productId
    productName: Joi.string().optional(),
    userId: Joi.string().required(),
    userShopName: Joi.string().required(),
    orderId: Joi.string().required() // Expects Order._id as string
}).unknown(true);

// Validation schema for search (POST and GET query)
const searchSchema = Joi.object({
    userId: Joi.string().optional(),
    productId: Joi.string().optional()
}).or('userId', 'productId'); // At least one must be provided

// GET all product history entries or filter by userId/productId
router.get('/', async (req, res) => {
    try {
        const { userId, productId } = req.query;

        // If query parameters are provided, validate and filter
        if (userId || productId) {
            const { error } = searchSchema.validate({ userId, productId }, { abortEarly: false });
            if (error) {
                const errors = error.details.map(err => err.message);
                return res.status(400).json({ error: 'Validation failed', details: errors });
            }

            const query = {};

            if (userId) {
                const user = await User.findOne({ userId });
                if (!user) return res.status(400).json({ error: `Invalid userId: ${userId}` });
                query.userId = user._id;
            }

            if (productId) {
                const product = await Product.findOne({ productId });
                if (!product) return res.status(400).json({ error: `Invalid productId: ${productId}` });
                query.productId = product._id;
            }

            const histories = await ProductHistory.find(query)
                .populate('productId', 'productId productName')
                .populate('userId', 'userId name shopName')
                .populate('orderId', 'orderId')
                .select('productName userShopName createdAt');

            return res.json(histories);
        }

        // If no query parameters, return all entries
        const histories = await ProductHistory.find()
            .populate('productId', 'productId productName')
            .populate('userId', 'userId name shopName')
            .populate('orderId', 'orderId')
            .select('productName userShopName createdAt');
        res.json(histories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET specific product history entry
router.get('/:id', async (req, res) => {
    try {
        const history = await ProductHistory.findById(req.params.id)
            .populate('productId', 'productId productName')
            .populate('userId', 'userId name shopName')
            .populate('orderId', 'orderId');
        if (!history) return res.status(404).json({ error: 'Product history entry not found' });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD product history entry
router.post('/', async (req, res) => {
    try {
        const { error } = productHistorySchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        // Verify productId exists
        const product = await Product.findOne({ productId: req.body.productId });
        if (!product) {
            return res.status(400).json({ error: `Invalid productId: ${req.body.productId}` });
        }

        // Verify userId exists
        const user = await User.findOne({ userId: req.body.userId });
        if (!user) {
            return res.status(400).json({ error: `Invalid userId: ${req.body.userId}` });
        }

        const history = new ProductHistory({
            productId: product._id,
            productName: req.body.productName || product.productName,
            userId: user._id,
            userShopName: req.body.userShopName,
            orderId: req.body.orderId
        });
        await history.save();
        res.status(201).json({ success: 'Product history entry added successfully', history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE product history entry
router.put('/:id', async (req, res) => {
    try {
        const { error } = productHistorySchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        // Verify productId exists
        const product = await Product.findOne({ productId: req.body.productId });
        if (!product) {
            return res.status(400).json({ error: `Invalid productId: ${req.body.productId}` });
        }

        // Verify userId exists
        const user = await User.findOne({ userId: req.body.userId });
        if (!user) {
            return res.status(400).json({ error: `Invalid userId: ${req.body.userId}` });
        }

        const history = await ProductHistory.findByIdAndUpdate(
            req.params.id,
            {
                productId: product._id,
                productName: req.body.productName || product.productName,
                userId: user._id,
                userShopName: req.body.userShopName,
                orderId: req.body.orderId
            },
            { new: true }
        );
        if (!history) return res.status(404).json({ error: 'Product history entry not found' });
        res.json({ success: 'Product history entry updated successfully', history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE product history entry
router.delete('/:id', async (req, res) => {
    try {
        const history = await ProductHistory.findByIdAndDelete(req.params.id);
        if (!history) return res.status(404).json({ error: 'Product history entry not found' });
        res.json({ success: 'Product history entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SEARCH product history entries by productId
router.post('/search', async (req, res) => {
    try {
        const { error } = searchSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            console.error('Validation errors:', errors);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { productId } = req.body;
        const query = {};

        if (productId) {
            const product = await Product.findOne({ productId });
            console.log('Found product:', product);
            if (!product) return res.status(400).json({ error: `Invalid productId: ${productId}` });
            query.productId = product._id;
        }

        const histories = await ProductHistory.find(query)
            .populate('productId', 'productId productName productImage') // Added productImage
            .populate('userId', 'userId name shopName')
            .populate('orderId', 'orderId')
            .select('productName userShopName createdAt');

        console.log('Found histories:', histories);
        res.json(histories);
    } catch (error) {
        console.error('Error in POST /api/product-history/search:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;