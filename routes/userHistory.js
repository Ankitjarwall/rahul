const express = require('express');
const router = express.Router();
const UserHistory = require('../models/userHistory');
const Joi = require('joi');
const Product = require('../models/Product');
const User = require('../models/User');

// Validation schema for UserHistory
const userHistorySchema = Joi.object({
    productId: Joi.string().required(), // Expects Product.productId
    productName: Joi.string().optional(),
    userShopName: Joi.string().required(),
    userId: Joi.string().required(),
    orderId: Joi.string().required() // Expects Order._id as string
}).unknown(true);

// GET all user history entries (limited fields)
router.get('/', async (req, res) => {
    try {
        const histories = await UserHistory.find()
            .populate('productId', 'productId productName')
            .populate('userId', 'userId name shopName')
            .populate('orderId', 'orderId')
            .select('productName userShopName createdAt');
        res.json(histories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET specific user history entry
router.get('/:id', async (req, res) => {
    try {
        const history = await UserHistory.findById(req.params.id)
            .populate('productId', 'productId productName')
            .populate('userId', 'userId name shopName')
            .populate('orderId', 'orderId');
        if (!history) return res.status(404).json({ error: 'User history entry not found' });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD user history entry
router.post('/', async (req, res) => {
    try {
        const { error } = userHistorySchema.validate(req.body, { abortEarly: false });
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

        const history = new UserHistory({
            productId: product._id,
            productName: req.body.productName || product.productName,
            userShopName: req.body.userShopName,
            userId: req.body.userId,
            orderId: req.body.orderId
        });
        await history.save();
        res.status(201).json({ success: 'User history entry added successfully', history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE user history entry
router.put('/:id', async (req, res) => {
    try {
        const { error } = userHistorySchema.validate(req.body, { abortEarly: false });
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

        const history = await UserHistory.findByIdAndUpdate(
            req.params.id,
            {
                productId: product._id,
                productName: req.body.productName || product.productName,
                userShopName: req.body.userShopName,
                userId: req.body.userId,
                orderId: req.body.orderId
            },
            { new: true }
        );
        if (!history) return res.status(404).json({ error: 'User history entry not found' });
        res.json({ success: 'User history entry updated successfully', history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE user history entry
router.delete('/:id', async (req, res) => {
    try {
        const history = await UserHistory.findByIdAndDelete(req.params.id);
        if (!history) return res.status(404).json({ error: 'User history entry not found' });
        res.json({ success: 'User history entry deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;