const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const UserHistory = require('../models/userHistory');
const ProductHistory = require('../models/productHistory');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// GET all orders (limited fields for main page)
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find()
            .select('orderId user.name user.shopName user.town user.state productDetails.name billing.totalAmount createdAt');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET specific order (full details)
router.get('/:orderId', async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD order
router.post('/', async (req, res) => {
    console.log("Received order data:", req.body);
    try {
        const generateOrderId = async () => {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const datePrefix = `${day}${month}${year}`;
            const count = await Order.countDocuments({ orderId: { $regex: `^${datePrefix}` } });
            return `${datePrefix}OR${count + 1}`;
        };

        const orderId = await generateOrderId();
        const order = new Order({ ...req.body, orderId });
        await order.save();

        // Add UserHistory and ProductHistory entries for each product
        const { user, productDetails } = req.body;
        for (const product of productDetails) {
            const userHistory = new UserHistory({
                productId: product._id, // Assuming productDetails contains _id
                userId: user.userId,
                orderId: order._id
            });
            await userHistory.save();

            const productHistory = new ProductHistory({
                productId: product._id,
                userId: user.userId,
                orderId: order._id
            });
            await productHistory.save();
        }

        res.status(201).json({ success: 'Order added successfully', order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE order
router.put('/:orderId', async (req, res) => {
    try {
        const order = await Order.findOneAndUpdate(
            { orderId: req.params.orderId },
            req.body,
            { new: true }
        );
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: 'Order updated successfully', order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE order
router.delete('/:orderId', async (req, res) => {
    try {
        const order = await Order.findOneAndDelete({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: 'Order deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SEARCH orders
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'No search query provided' });
        const orders = await Order.find({ $text: { $search: query } })
            .select('user.name user.shopName user.town user.state productDetails.name billing.totalAmount createdAt');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GENERATE PDF INVOICE
function convertToDownloadUrl(driveLink) {
    const fileIdMatch = driveLink.match(/\/d\/(.+?)\//);
    if (!fileIdMatch) throw new Error("Invalid Google Drive link");

    const fileId = fileIdMatch[1];
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

router.get('/invoice/:orderId', async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const isPreview = req.query.preview === 'true';

        // Apps Script endpoint
        const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbx_iJ6Xxd5AQ413NcKvDZ7t1A0SsUvyOt8CeXBQ06-8tjo65cR_voTWAWHt4o9T_ETHqQ/exec';

        // Request to Apps Script
        const response = await axios.post(appsScriptUrl, order, {
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const { status, pdfLink, message } = response.data;

        if (!pdfLink) {
            return res.status(500).json({ error: message || 'PDF link missing' });
        }

        if (isPreview) {
            // Open in browser (Google Drive view)
            return res.redirect(pdfLink);
        } else {
            // Download PDF (convert to direct download link)
            const downloadUrl = convertToDownloadUrl(pdfLink);
            const pdfResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename=invoice-${order.orderId}.pdf`
            );

            return res.send(pdfResponse.data);
        }

    } catch (error) {
        console.error('PDF Generation Error:', error.message);
        if (error.response?.data) {
            console.error('Apps Script Response:', error.response.data);
        }
        res.status(500).json({ error: `Failed to generate PDF: ${error.message}` });
    }
});

module.exports = router;