const express = require('express');
const router = express.Router();
const Joi = require('joi');
const UserHistory = require('../models/userHistory');

// Validation schema for POST and PUT requests
const userHistorySchema = Joi.object({
    productId: Joi.string().required(),
    userId: Joi.string().required(),
    orderId: Joi.string().required()
});

// GET all user history entries
router.get('/', async (req, res) => {
    try {
        const histories = await UserHistory.find()
            .populate({
                path: 'userId',
                select: 'name shopName',
                match: { userId: { $exists: true } } // Match documents with userId
            })
            .populate({
                path: 'productId',
                select: 'productName',
                match: { productId: { $exists: true } }
            })
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
            .populate({
                path: 'userId',
                select: 'name shopName',
                match: { userId: { $exists: true } }
            })
            .populate({
                path: 'productId',
                select: 'productName',
                match: { productId: { $exists: true } }
            })
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
            .populate({
                path: 'userId',
                select: 'name shopName',
                match: { userId: { $exists: true } }
            })
            .populate({
                path: 'productId',
                select: 'productName',
                match: { productId: { $exists: true } }
            })
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
            .populate({
                path: 'userId',
                select: 'name shopName',
                match: { userId: { $exists: true } }
            })
            .populate({
                path: 'productId',
                select: 'productName',
                match: { productId: { $exists: true } }
            })
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
        // Note: Text search requires populated fields or additional indexes
        const histories = await UserHistory.find()
            .populate({
                path: 'userId',
                select: 'name shopName',
                match: { $text: { $search: query } }
            })
            .populate({
                path: 'productId',
                select: 'productName',
                match: { $text: { $search: query } }
            })
            .populate('orderId', 'orderId billing.totalAmount');
        res.json(histories.filter(h => h.userId || h.productId)); // Only return populated results
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;