const express = require('express');
const router = express.Router();
const Joi = require('joi');
const UserHistory = require('../models/userHistory');

// Validation schema for POST and PUT requests
const userHistorySchema = Joi.object({
    productId: Joi.string().required(), // Assuming Product._id is string
    userId: Joi.string().required(), // Assuming User._id is string
    orderId: Joi.string().required() // Assuming Order._id is string
});

// GET all user history entries
router.get('/', async (req, res) => {
    try {
        const histories = await UserHistory.find()
            .populate('userId', 'name shopName')
            .populate('productId', 'productName')
            .populate('orderId', 'orderId billing.totalAmount');
        res.json(histories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET user history for a specific user
router.get('/:userId', async (req, res) => {
    try {
        const histories = await UserHistory.find({ userId: req.params.userId })
            .populate('userId', 'name shopName')
            .populate('productId', 'productName')
            .populate('orderId', 'orderId billing.totalAmount');
        if (!histories.length) return res.status(404).json({ error: 'No history found for this user' });
        res.json(histories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD user history entry
router.post('/', async (req, res) => {
    try {
        const { error } = userHistorySchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const history = new UserHistory(req.body);
        await history.save();
        const populatedHistory = await UserHistory.findById(history._id)
            .populate('userId', 'name shopName')
            .populate('productId', 'productName')
            .populate('orderId', 'orderId billing.totalAmount');
        res.status(201).json({ success: 'User history added', history: populatedHistory });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE user history entry
router.put('/:id', async (req, res) => {
    try {
        const { error } = userHistorySchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });

        const history = await UserHistory.findByIdAndUpdate(req.params.id, req.body, { new: true })
            .populate('userId', 'name shopName')
            .populate('productId', 'productName')
            .populate('orderId', 'orderId billing.totalAmount');
        if (!history) return res.status(404).json({ error: 'User history not found' });
        res.json({ success: 'User history updated', history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE user history entry
router.delete('/:id', async (req, res) => {
    try {
        const history = await UserHistory.findByIdAndDelete(req.params.id);
        if (!history) return res.status(404).json({ error: 'User history not found' });
        res.json({ success: 'User history deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SEARCH user history
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'No search query provided' });
        const histories = await UserHistory.find({ $text: { $search: query } })
            .populate('userId', 'name shopName')
            .populate('productId', 'productName')
            .populate('orderId', 'orderId billing.totalAmount');
        res.json(histories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;