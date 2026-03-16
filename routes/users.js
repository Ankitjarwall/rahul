const express = require('express');
const router = express.Router();
const User = require('../models/User');

// GET all users (limited fields for main page)
router.get('/', async (req, res) => {
    console.log("Get All Users Request");
    try {
        const users = await User.find()
            .select('userId name shopName town state contact');
        console.log(`Found ${users.length} users`);
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// SEARCH users (must be before /:userId route)
router.post('/search', async (req, res) => {
    console.log("Search Users Request - Query:", req.body.query);
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'No search query provided' });
        const users = await User.find({ $text: { $search: query } })
            .select('userId name shopName town state contact');
        console.log(`Search found ${users.length} users for query: "${query}"`);
        res.json(users);
    } catch (error) {
        console.error('Error searching users:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET specific user (full details)
router.get('/:userId', async (req, res) => {
    console.log("Get User Request - UserId:", req.params.userId);
    try {
        const user = await User.findOne({ userId: req.params.userId });
        if (!user) {
            console.log("User not found:", req.params.userId);
            return res.status(404).json({ error: 'User not found' });
        }

        // Convert to object and add fullAddress
        const userObj = user.toObject();
        userObj.fullAddress = `${user.address || ''}, ${user.town || ''}, ${user.state || ''} - ${user.pincode || ''}`;

        console.log("User found:", user.userId);
        res.json(userObj);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: error.message });
    }
});

// ADD user
router.post('/', async (req, res) => {
    console.log("Add User Request:", JSON.stringify(req.body, null, 2));
    try {
        // Validate required fields
        if (!req.body.name && !req.body.shopName) {
            return res.status(400).json({ error: 'Either name or shopName is required' });
        }

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
        console.log("User created successfully:", userId);
        res.status(201).json({ success: 'User added successfully', userId });
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE user
router.put('/:userId', async (req, res) => {
    console.log("Received updated user data:", req.body);
    try {
        const { comments, ...otherUpdates } = req.body; // Separate comments from other fields

        // Prepare the update object with $set for regular fields
        const update = {};

        // Use $set for regular field updates if there are any
        if (Object.keys(otherUpdates).length > 0) {
            update.$set = otherUpdates;
        }

        // If comments are provided, append them to the existing comments array
        if (comments && Array.isArray(comments) && comments.length > 0) {
            update.$push = { comments: { $each: comments } };
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
    console.log("Delete User Request - UserId:", req.params.userId);
    try {
        const user = await User.findOneAndDelete({ userId: req.params.userId });
        if (!user) {
            console.log("User not found for deletion:", req.params.userId);
            return res.status(404).json({ error: 'User not found' });
        }
        console.log("User deleted successfully:", req.params.userId);
        res.json({ success: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;