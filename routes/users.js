const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET all users (limited fields for main page)
router.get('/', async (req, res) => {
    try {
        const users = await User.find()
            .select('userId name shopName town state contact');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET specific user (full details)
router.get('/:userId', async (req, res) => {
    try {
        const user = await User.findOne({ userId: req.params.userId });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD user
router.post('/', async (req, res) => {
    try {
        const generateUserId = async (userData) => {
            const state = (userData.state || 'NA').toUpperCase().slice(0, 2);
            const pincode = userData.pincode || '000000';
            const username = (userData.name || userData.shopName || 'Unknown').replace(/\s+/g, '');
            const count = await User.countDocuments({ userId: { $regex: `^${state}${pincode}${username}` } });
            return `${state}${pincode}${username}${String(count + 1).padStart(2, '0')}`;
        };

        const userId = await generateUserId(req.body);
        const user = new User({ ...req.body, userId });
        await user.save();
        res.status(201).json({ success: 'User added successfully', userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE user
router.put('/:userId', async (req, res) => {
    console.log("Received updated user data:", req.body);
    try {
        const { comments, ...otherUpdates } = req.body; // Separate comments from other fields
        // Prepare the update object
        const update = { ...otherUpdates };

        // If comments are provided, append them to the existing comments array
        if (comments && Array.isArray(comments)) {
            update.$push = { comments: { $each: comments } }; // Use $push to append new comments
        }

        const user = await User.findOneAndUpdate(
            { userId: req.params.userId },
            update,
            { new: true }
        );  

        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: 'User updated successfully', user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE user
router.delete('/:userId', async (req, res) => {
    try {
        const user = await User.findOneAndDelete({ userId: req.params.userId });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json({ success: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SEARCH users
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'No search query provided' });
        const users = await User.find({ $text: { $search: query } })
            .select('name shopName town state contact');
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;