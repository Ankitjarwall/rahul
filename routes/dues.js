const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Order = require('../models/Order');
const Joi = require('joi');

// Validation schema for dues payment
const duesPaymentSchema = Joi.object({
    amount: Joi.number().positive().required(),
    paymentMethod: Joi.string().required(),
    comments: Joi.string().optional().allow('')
});

// GET user dues - Calculate and return total payable dues
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: `User not found with userId: ${userId}` });
        }

        const currentDues = user.dues || 0;

        res.json({
            success: true,
            data: {
                userId: user.userId,
                name: user.name,
                shopName: user.shopName,
                currentDues: currentDues,
                payableDue: currentDues > 0 ? currentDues : 0,
                hasDues: currentDues > 0
            }
        });
    } catch (error) {
        console.error('Error fetching user dues:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST pay dues - Subtract paid amount from user dues and create order record
router.post('/:userId/pay', async (req, res) => {
    try {
        const { userId } = req.params;

        // Validate request body
        const { error } = duesPaymentSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { amount, paymentMethod, comments } = req.body;

        // Find the user
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: `User not found with userId: ${userId}` });
        }

        const currentDues = user.dues || 0;

        // Check if user has dues to pay
        if (currentDues <= 0) {
            return res.status(400).json({ error: 'User has no outstanding dues to pay' });
        }

        // Check if payment amount exceeds dues
        if (amount > currentDues) {
            return res.status(400).json({
                error: `Payment amount (${amount}) exceeds outstanding dues (${currentDues})`,
                currentDues: currentDues
            });
        }

        // Calculate new dues after payment
        const newDues = currentDues - amount;

        // Generate order ID for dues payment
        const generateDuesOrderId = async () => {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const datePrefix = `${day}${month}${year}`;
            const count = await Order.countDocuments({ orderId: { $regex: `^${datePrefix}DUE` } });
            return `${datePrefix}DUE${count + 1}`;
        };

        const orderId = await generateDuesOrderId();

        // Create order record for dues payment
        const duesOrder = new Order({
            orderId: orderId,
            user: {
                userId: user.userId,
                name: user.name,
                shopName: user.shopName,
                userDues: currentDues,
                address: user.address || 'N/A',
                town: user.town || 'N/A',
                state: user.state || 'N/A',
                pincode: user.pincode || 0,
                contact: user.contact || []
            },
            productDetails: [{
                productId: 'DUES_PAYMENT',
                name: 'Dues Payment',
                weight: 0,
                unit: 'N/A',
                mrp: 0,
                rate: 0,
                quantity: 1,
                totalAmount: 0
            }],
            billing: {
                orderWeight: 0,
                orderAmount: 0,
                deliveryCharges: 0,
                totalAmount: 0,
                paymentMethod: paymentMethod,
                moneyGiven: amount,
                pastOrderDue: currentDues,
                finalAmount: -amount // Negative to indicate payment received
            },
            comments: comments ? [{
                message: `Dues Payment: ${comments}`,
                date: new Date().toISOString()
            }] : [{
                message: `Dues payment of INR ${amount} received. Previous dues: INR ${currentDues}, Remaining dues: INR ${newDues}`,
                date: new Date().toISOString()
            }],
            isfreeProducts: false
        });

        await duesOrder.save();

        // Update user dues
        await User.findOneAndUpdate(
            { userId: userId },
            {
                $set: { dues: newDues },
                $push: {
                    comments: {
                        message: `Dues payment of INR ${amount} received via ${paymentMethod}. Order ID: ${orderId}. Remaining dues: INR ${newDues}`,
                        date: new Date().toISOString()
                    }
                }
            }
        );

        res.status(201).json({
            success: true,
            message: 'Dues payment recorded successfully',
            data: {
                orderId: orderId,
                userId: user.userId,
                shopName: user.shopName,
                previousDues: currentDues,
                amountPaid: amount,
                remainingDues: newDues,
                paymentMethod: paymentMethod,
                duesCleared: newDues === 0
            }
        });
    } catch (error) {
        console.error('Error processing dues payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET dues payment history for a user
router.get('/:userId/history', async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(404).json({ error: `User not found with userId: ${userId}` });
        }

        // Find all dues payment orders for this user
        const duesPayments = await Order.find({
            'user.userId': userId,
            orderId: { $regex: /DUE/ }
        })
        .select('orderId billing.moneyGiven billing.pastOrderDue billing.paymentMethod comments createdAt')
        .sort({ createdAt: -1 });

        res.json({
            success: true,
            data: {
                userId: user.userId,
                shopName: user.shopName,
                currentDues: user.dues || 0,
                paymentHistory: duesPayments.map(payment => ({
                    orderId: payment.orderId,
                    amountPaid: payment.billing.moneyGiven,
                    duesAtPayment: payment.billing.pastOrderDue,
                    paymentMethod: payment.billing.paymentMethod,
                    date: payment.createdAt,
                    comments: payment.comments
                }))
            }
        });
    } catch (error) {
        console.error('Error fetching dues history:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
