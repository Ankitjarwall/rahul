const express = require('express');
const router = express.Router();
const ProductHistory = require('../models/productHistory');
const Joi = require('joi');
const Product = require('../models/Product');
const User = require('../models/User');
const Order = require('../models/Order');
const PDFDocument = require('pdfkit');

// Validation schema for ProductHistory
const productHistorySchema = Joi.object({
    productId: Joi.string().required(), // Expects Product.productId
    productName: Joi.string().optional(),
    userId: Joi.string().required(),
    userShopName: Joi.string().required(),
    orderId: Joi.string().required() // Expects Order._id as string
}).unknown(true);

// Validation schema for search (POST and GET query)
const searchSchema = Joi.object({
    userId: Joi.string().optional(),
    productId: Joi.string().optional()
}).or('userId', 'productId'); // At least one must be provided

// GET all product history entries or filter by userId/productId
router.get('/', async (req, res) => {
    try {
        const { userId, productId } = req.query;

        // If query parameters are provided, validate and filter
        if (userId || productId) {
            const { error } = searchSchema.validate({ userId, productId }, { abortEarly: false });
            if (error) {
                const errors = error.details.map(err => err.message);
                return res.status(400).json({ error: 'Validation failed', details: errors });
            }

            const query = {};

            if (userId) {
                const user = await User.findOne({ userId });
                if (!user) return res.status(400).json({ error: `Invalid userId: ${userId}` });
                query.userId = user._id;
            }

            if (productId) {
                const product = await Product.findOne({ productId });
                if (!product) return res.status(400).json({ error: `Invalid productId: ${productId}` });
                query.productId = product._id;
            }

            const histories = await ProductHistory.find(query)
                .populate('productId', 'productId productName')
                .populate('userId', 'userId name shopName')
                .populate('orderId', 'orderId')
                .select('productName userShopName createdAt');

            return res.json(histories);
        }

        // If no query parameters, return all entries
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

// SEARCH product history entries by productId
router.post('/search', async (req, res) => {
    try {
        const { error } = searchSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            console.error('Validation errors:', errors);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { productId } = req.body;
        const query = {};

        if (productId) {
            const product = await Product.findOne({ productId });
            console.log('Found product:', product);
            if (!product) return res.status(400).json({ error: `Invalid productId: ${productId}` });
            query.productId = product._id;
        }

        const histories = await ProductHistory.find(query)
            .populate('productId', 'productId productName productImage') // Added productImage
            .populate('userId', 'userId name shopName')
            .populate('orderId', 'orderId')
            .select('productName userShopName createdAt');

        console.log('Found histories:', histories);
        res.json(histories);
    } catch (error) {
        console.error('Error in POST /api/product-history/search:', error);
        res.status(500).json({ error: error.message });
    }
});

// GENERATE PRODUCT HISTORY PDF
router.get('/product/:productId/history-pdf', async (req, res) => {
    try {
        const { productId } = req.params;

        // Validate and fetch product
        const product = await Product.findOne({ productId });
        if (!product) {
            return res.status(404).json({ error: `Product not found with productId: ${productId}` });
        }

        // Fetch product history entries
        const histories = await ProductHistory.find({ productId: product._id })
            .populate('userId', 'name shopName')
            .populate('orderId', 'orderId')
            .select('productName userShopName createdAt');

        if (!histories || histories.length === 0) {
            return res.status(404).json({ error: 'No purchase history found for this product' });
        }

        // Fetch order details for each history entry to get Rate, Quantity, and Total Amount
        const historyWithOrderDetails = await Promise.all(histories.map(async (history) => {
            const order = await Order.findById(history.orderId._id);
            if (!order) {
                return null; // Skip if order not found
            }
            const productDetail = order.productDetails.find(p => p.name === history.productName);
            if (!productDetail) {
                return null; // Skip if product not found in order
            }
            return {
                date: history.createdAt,
                userName: history.userId.name || history.userShopName,
                rate: productDetail.rate,
                quantity: productDetail.quantity,
                totalAmount: productDetail.totalAmount
            };
        }));

        // Filter out null entries (where order or product details were not found)
        const validHistory = historyWithOrderDetails.filter(h => h !== null);

        if (validHistory.length === 0) {
            return res.status(404).json({ error: 'No valid purchase history found with order details' });
        }

        // Sort history by date for chronological order
        validHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=product-history-${productId}.pdf`);

        // Pipe the PDF to the response
        doc.pipe(res);

        // Helper function to add text with wrapping
        const addText = (text, x, y, options = {}) => {
            if (isNaN(y)) {
                console.error('Invalid y coordinate:', y);
                y = doc.y || 50; // Fallback to a safe value
            }
            doc.text(text, x, y, { width: options.width || 500, ...options });
        };

        // Company Details (centered)
        doc.fontSize(14).font('Helvetica-Bold').text('Durga Sai Enterprises', { align: 'center' });
        doc.fontSize(10);
        doc.text('Contact Us : (+91) 9876 54310', { align: 'center' });
        doc.text('durgasaienterprises@email.com', { align: 'center' });
        doc.text('Reg. No. RAN5207102024166530', { align: 'center' });
        doc.moveDown(2);

        // Two-column layout for Product Details and History Info
        const columnWidth = 250; // Each column width (total page width ~550 - margins)
        const startY = doc.y;

        // Left Column: Product Details
        doc.fontSize(14).font('Helvetica-Bold').text('Product Details', 50, doc.y, { underline: true });
        doc.fontSize(10).font('Helvetica');
        addText(`Product ID: ${productId}`, 50, doc.y + 5, { width: columnWidth });
        addText(`Product Name: ${product.productName}`, 50, doc.y + 5, { width: columnWidth });

        // Right Column: History Info (aligned with Product Details)
        doc.fontSize(20).text('PURCHASE HISTORY', 300, startY, { align: 'right' });
        doc.fontSize(12);
        doc.text(`Date: ${new Date().toLocaleDateString()}`, 300, doc.y + 5, { align: 'right' });
        doc.moveDown(2);

        // Adjust Y position to the bottom of the tallest column
        const productDetailsHeight = doc.y - startY;
        doc.y = startY + productDetailsHeight + 20; // Move down after the tallest column

        // Purchase History Table (full width)
        doc.fontSize(14).font('Helvetica-Bold').text('Purchase History', 50, doc.y, { underline: true });

        let tableTop = doc.y + 10;
        if (isNaN(tableTop)) {
            console.error('Invalid tableTop:', tableTop);
            tableTop = 200; // Fallback to a safe value
        }
        const col1 = 50, col2 = 120, col3 = 220, col4 = 370, col5 = 440, col6 = 490;

        // Table Headers
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Date', col1, tableTop);
        doc.text('User Name', col2, tableTop);
        doc.text('Rate (INR)', col3, tableTop);
        doc.text('Quantity', col4, tableTop);
        doc.text('Total (INR)', col5, tableTop);

        // Table Divider
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Table Rows
        doc.font('Helvetica');
        let y = tableTop + 20;
        validHistory.forEach((entry) => {
            doc.text(new Date(entry.date).toLocaleDateString(), col1, y);
            addText(entry.userName, col2, y, { width: 90 });
            doc.text(`${entry.rate}`, col3, y);
            doc.text(`${entry.quantity}`, col4, y);
            doc.text(`${entry.totalAmount}`, col5, y);

            y += 20;
            if (y > 700) {
                doc.addPage();
                y = 50;
            }
        });

        // Footer
        doc.moveDown(2);
        doc.text('Thank you for your business!', 0, 730, { align: 'center' });

        // Finalize the PDF
        doc.end();
    } catch (error) {
        console.error('Error generating product history PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

module.exports = router;