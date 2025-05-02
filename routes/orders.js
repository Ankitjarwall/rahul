const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Order = require('../models/Order');
const UserHistory = require('../models/userHistory');
const ProductHistory = require('../models/productHistory');
const Product = require('../models/Product');
const axios = require('axios');

// Validation schema for productDetails
const productSchema = Joi.object({
    productId: Joi.string().required(),
    name: Joi.string().required(),
    weight: Joi.number().positive().required(),
    unit: Joi.string().required(),
    mrp: Joi.number().positive().required(),
    rate: Joi.number().positive().required(),
    quantity: Joi.number().integer().min(1).required(),
    totalAmount: Joi.number().positive().required(),
    item_total_weight: Joi.number().positive().optional(),
    image: Joi.string().uri().optional()
}).unknown(true);

// Validation schema for user.contact
const contactSchema = Joi.object({
    contact: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    whatsapp: Joi.boolean().default(false),
    _id: Joi.string().optional()
}).unknown(true);

// Validation schema for billing
const billingSchema = Joi.object({
    orderWeight: Joi.number().positive().required(),
    orderAmount: Joi.number().positive().required(),
    deliveryCharges: Joi.number().min(0).required(),
    totalAmount: Joi.number().positive().required(),
    paymentMethod: Joi.string().required(),
    moneyGiven: Joi.number().required(),
    pastOrderDue: Joi.number().min(0).required(),
    finalAmount: Joi.number().positive().required()
}).unknown(true);

// Validation schema for freeProducts
const freeProductSchema = Joi.object({
    name: Joi.string().default('NA'),
    weight: Joi.number().default(0),
    unit: Joi.string().default('NA'),
    mrp: Joi.number().required(),
    rate: Joi.number().default(0),
    quantity: Joi.number().default(0),
    totalAmount: Joi.number().default(0)
}).unknown(true);

// Validation schema for comments
const commentSchema = Joi.object({
    message: Joi.string().default(''),
    date: Joi.string().default('')
}).unknown(true);

// Validation schema for the entire order
const orderSchema = Joi.object({
    user: Joi.object({
        userId: Joi.string().required(),
        name: Joi.string().required(),
        shopName: Joi.string().required(),
        userDues: Joi.number().optional().allow(null),
        address: Joi.string().required(),
        town: Joi.string().required(),
        state: Joi.string().required(),
        pincode: Joi.number().required(),
        contact: Joi.array().items(contactSchema).optional()
    }).unknown(true),
    productDetails: Joi.array().items(productSchema).required().min(1),
    freeProducts: Joi.array().items(freeProductSchema).optional(),
    billing: billingSchema.required(),
    isfreeProducts: Joi.boolean().optional(),
    comments: Joi.array().items(commentSchema).optional()
}).unknown(true);

// ADD order
router.post('/', async (req, res) => {
    console.log("Received order data:", JSON.stringify(req.body, null, 2));
    try {
        // Validate request body
        const { error } = orderSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        // Verify user exists
        const user = await User.findOne({ userId: req.body.user.userId });
        if (!user) {
            return res.status(400).json({ error: `Invalid userId: ${req.body.user.userId}` });
        }

        // Generate unique orderId
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
        const { productDetails } = req.body;
        for (const product of productDetails) {
            // Verify productId exists in Product collection
            const productExists = await Product.findOne({ productId: product.productId });
            if (!productExists) {
                return res.status(400).json({ error: `Invalid productId: ${product.productId}` });
            }

            // Create UserHistory entry
            const userHistory = new UserHistory({
                productId: productExists._id,
                productName: product.name,
                userShopName: user.shopName,
                userId: user._id,
                orderId: order._id
            });
            await userHistory.save();

            // Create ProductHistory entry
            const productHistory = new ProductHistory({
                productId: productExists._id,
                productName: product.name,
                userId: user._id,
                userShopName: user.shopName,
                orderId: order._id
            });
            await productHistory.save();
        }

        res.status(201).json({ success: 'Order added successfully', order });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: error.message });
    }
});

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

// UPDATE order
router.put('/:orderId', async (req, res) => {
    try {
        const { error } = orderSchema.validate(req.body, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

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
        // Optionally delete related history entries
        await UserHistory.deleteMany({ orderId: order._id });
        await ProductHistory.deleteMany({ orderId: order._id });
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
        const appsScriptUrl = 'https://script.google.com/macros/s/AKfycbx_iJ6Xxd5AQ413NcKvDZ7t1A0SsUvyOt8CeXBQ06-8tjo65cR_voTWAWHt4o9T_ETHqQ/exec';

        const response = await axios.post(appsScriptUrl, order, {
            headers: { 'Content-Type': 'application/json' }
        });

        const { status, pdfLink, message } = response.data;
        if (!pdfLink) {
            return res.status(500).json({ error: message || 'PDF link missing' });
        }

        if (isPreview) {
            return res.redirect(pdfLink);
        } else {
            const downloadUrl = convertToDownloadUrl(pdfLink);
            const pdfResponse = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);
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