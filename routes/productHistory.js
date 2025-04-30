const express = require('express');
const router = express.Router();
const Joi = require('joi');
const ProductHistory = require('../models/productHistory');

// Validation schema for POST and PUT requests
const productHistorySchema = Joi.object({
    productId: Joi.string().required(),
    userId: Joi.string().required(),
    orderId: Joi.string().required()
});

// GET all product history entries
router.get('/', async (req, res) => {
    try {
        const histories = await ProductHistory.find()
            .populate('userId', 'name shopName')
            .populate('productId', 'productName')
            .populate('orderId', 'orderId billing.totalAmount');
        res.json(histories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET product history for a specific product
router.get('/:productId', async (req, res) => {
    try {
        const histories = await ProductHistory.find({ productId: req.params.productId })
            .populate('userId', 'name shopName')
            .populate('productId', 'productName')
            .populate('orderId', 'orderId billing.totalAmount');
        if (!histories.length) return res.status(404).json({ error: 'No history found for this product' });
        res.json(histories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD product history entry
router.post('/', async (req, res) => {
    try {
        const { error } = productHistorySchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const history = new ProductHistory(req.body);
        await history.save();
        const populatedHistory = await ProductHistory.findById(history._id)
            .populate('userId', 'name shopName')
            .populate('productId', 'productName')
            .populate('orderId', 'orderId billing.totalAmount');
        res.status(201).json({ success: 'Product history added', history: populatedHistory });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE product history entry
router.put('/:id', async (req, res) => {
    try {
        const { error } = productHistorySchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const history = await ProductHistory.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .populate('userId', 'name shopName')
            .populate('productId', 'productName')
            .populate('orderId', 'orderId billing.totalAmount');
        if (!history) return res.status(404).json({ error: 'Product history not found' });
        res.json({ success: 'Product history updated', history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE product history entry
router.delete('/:id', async (req, res) => {
    try {
        const history = await ProductHistory.findByIdAndDelete(req.params.id);
        if (!history) return res.status(404).json({ error: 'Product history not found' });
        res.json({ success: 'Product history deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SEARCH product history
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'No search query provided' });
        const histories = await ProductHistory.find({ $text: { $search: query } })
            .populate('userId', 'name shopName')
            .populate('productId', 'productName')
            .populate('orderId', 'orderId billing.totalAmount');
        res.json(histories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;