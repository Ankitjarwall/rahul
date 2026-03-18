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
    console.log("Get User Dues Request - UserId:", req.params.userId);
    try {
        const { userId } = req.params;

        if (!userId || userId.trim() === '') {
            return res.status(400).json({ error: 'userId is required' });
        }

        const user = await User.findOne({ userId });
        if (!user) {
            console.log("User not found:", userId);
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
    console.log("Pay Dues Request - UserId:", req.params.userId);
    console.log("Pay Dues Data:", JSON.stringify(req.body, null, 2));
    try {
        const { userId } = req.params;

        if (!userId || userId.trim() === '') {
            return res.status(400).json({ error: 'userId is required' });
        }

        // Validate request body
        const { error } = duesPaymentSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
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
                totalAmount: -amount
            }],
            billing: {
                orderWeight: 0,
                orderAmount: 0,
                deliveryCharges: 0,
                totalAmount: -amount,
                paymentMethod: paymentMethod,
                moneyGiven: amount,
                pastOrderDue: currentDues,
                finalAmount: currentDues - amount // Remaining dues after payment
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
                $set: { dues: newDues }
            }
        );

        // Format date and time (IST timezone)
        const now = new Date();
        const paymentDate = now.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        });
        const paymentTime = now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        }).replace(' ', '');

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
                duesCleared: newDues === 0,
                paymentDate: paymentDate,
                paymentTime: paymentTime
            }
        });
    } catch (error) {
        console.error('Error processing dues payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET dues transaction history for a user (both DEBIT and CREDIT)
router.get('/:userId/history', async (req, res) => {
    console.log("Get Dues History Request - UserId:", req.params.userId);
    try {
        const { userId } = req.params;

        if (!userId || userId.trim() === '') {
            return res.status(400).json({ error: 'userId is required' });
        }

        const user = await User.findOne({ userId });
        if (!user) {
            console.log("User not found:", userId);
            return res.status(404).json({ error: `User not found with userId: ${userId}` });
        }

        // Find ALL orders for this user (both regular orders and dues payments)
        const allOrders = await Order.find({
            'user.userId': userId
        })
            .select('orderId billing productDetails createdAt')
            .sort({ createdAt: -1 });

        console.log(`Found ${allOrders.length} orders for user: ${userId}`);

        // Helper function to format date and time (IST timezone)
        const formatDateTime = (dateObj) => {
            if (!dateObj) {
                return { date: 'N/A', time: 'N/A' };
            }
            const date = new Date(dateObj);
            const formattedDate = date.toLocaleDateString('en-IN', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'Asia/Kolkata'
            });
            const formattedTime = date.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
                timeZone: 'Asia/Kolkata'
            }).replace(' ', '');
            return { date: formattedDate, time: formattedTime };
        };

        // Transform orders into transaction history
        const transactionHistory = allOrders.map(order => {
            // Skip orders with missing billing data
            if (!order.billing) {
                console.log(`Skipping order ${order.orderId} - missing billing data`);
                return null;
            }

            const isDuesPayment = order.orderId && order.orderId.includes('DUE');
            const { date, time } = formatDateTime(order.createdAt);

            // Ensure billing values are numbers
            const totalAmount = order.billing.totalAmount || 0; // This order's total (without past dues)
            const moneyGiven = order.billing.moneyGiven || 0;
            const pastOrderDue = order.billing.pastOrderDue || 0;

            if (isDuesPayment) {
                // CREDIT - Dues payment (reduces dues)
                return {
                    type: 'CREDIT',
                    isDebit: false,
                    orderId: order.orderId,
                    amount: moneyGiven,
                    duesBefore: pastOrderDue,
                    duesAfter: pastOrderDue - moneyGiven,
                    description: 'Dues Payment',
                    paymentMethod: order.billing.paymentMethod || 'N/A',
                    date: date,
                    time: time
                };
            } else {
                // Regular order - check if it added dues
                // duesAdded = this order's total - money paid for this order
                const duesAdded = totalAmount - moneyGiven;
                if (duesAdded > 0) {
                    // DEBIT - Order with unpaid amount (increases dues)
                    const productNames = (order.productDetails || [])
                        .map(p => p.name || 'Unknown')
                        .slice(0, 3)
                        .join(', ');
                    const moreProducts = (order.productDetails || []).length > 3
                        ? ` +${order.productDetails.length - 3} more`
                        : '';

                    return {
                        type: 'DEBIT',
                        isDebit: true,
                        orderId: order.orderId,
                        amount: duesAdded,
                        duesBefore: pastOrderDue,
                        duesAfter: pastOrderDue + duesAdded,
                        orderTotal: totalAmount,
                        moneyPaid: moneyGiven,
                        description: `Order: ${productNames}${moreProducts}`,
                        paymentMethod: order.billing.paymentMethod || 'N/A',
                        date: date,
                        time: time
                    };
                }
            }
            return null;
        }).filter(Boolean); // Remove null entries (orders with no dues impact)

        console.log(`Found ${transactionHistory.length} dues transactions for user: ${userId}`);

        res.json({
            success: true,
            data: {
                userId: user.userId,
                shopName: user.shopName,
                currentDues: user.dues || 0,
                transactionHistory: transactionHistory
            }
        });
    } catch (error) {
        console.error('Error fetching dues history:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
