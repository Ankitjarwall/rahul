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

// GET all product history entries (limited fields)
router.get('/', async (req, res) => {
    try {
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

module.exports = router;