const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Order = require('../models/Order');
const Product = require('../models/Product');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const UserHistory = require('../models/userHistory');
const ProductHistory = require('../models/productHistory');

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
    finalAmount: Joi.number().required()
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
        const data = { ...req.body };
        if (data.user && typeof data.user.pincode === 'string') {
            data.user.pincode = parseInt(data.user.pincode, 10);
        }
        if (data.billing && typeof data.billing.moneyGiven === 'string') {
            data.billing.moneyGiven = parseFloat(data.billing.moneyGiven);
        }
        if (data.productDetails) {
            data.productDetails = data.productDetails.map(product => ({
                ...product,
                weight: typeof product.weight === 'string' ? parseFloat(product.weight) : product.weight
            }));
        }

        const { error } = orderSchema.validate(data, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            console.error('Validation errors:', errors);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const user = await User.findOne({ userId: data.user.userId });
        if (!user) {
            return res.status(400).json({ error: `Invalid userId: ${data.user.userId}` });
        }

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
        const order = new Order({ ...data, orderId });
        await order.save();

        const { productDetails } = data;
        for (const product of productDetails) {
            const productExists = await Product.findOne({ productId: product.productId });
            if (!productExists) {
                return res.status(400).json({ error: `Invalid productId: ${product.productId}` });
            }

            const userHistory = new UserHistory({
                productId: productExists._id,
                productName: product.name,
                userShopName: user.shopName,
                userId: user._id,
                orderId: order._id
            });
            await userHistory.save();

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

// GET all orders
router.get('/', async (req, res) => {
    try {
        const orders = await Order.find()
            .select('orderId user.name user.shopName user.town user.state productDetails.name billing.totalAmount createdAt');
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET specific order
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
        const data = { ...req.body };
        if (data.user && typeof data.user.pincode === 'string') {
            data.user.pincode = parseInt(data.user.pincode, 10);
        }
        if (data.billing && typeof data.billing.moneyGiven === 'string') {
            data.billing.moneyGiven = parseFloat(data.billing.moneyGiven);
        }
        if (data.productDetails) {
            data.productDetails = data.productDetails.map(product => ({
                ...product,
                weight: typeof product.weight === 'string' ? parseFloat(product.weight) : product.weight
            }));
        }

        const { error } = orderSchema.validate(data, { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => err.message);
            console.error('Validation errors:', errors);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const order = await Order.findOneAndUpdate(
            { orderId: req.params.orderId },
            data,
            { new: true }
        );
        if (!order) return res.status(404).json({ error: 'Order not found' });
        res.json({ success: 'Order updated successfully', order });
    } catch (error) {
        console.error('Error updating order:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE order
router.delete('/:orderId', async (req, res) => {
    try {
        const order = await Order.findOneAndDelete({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found' });
        await UserHistory.deleteMany({ orderId: order._id });
        await ProductHistory.deleteMany({ orderId: order._id });
        res.json({ success: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
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
        console.error('Error searching orders:', error);
        res.status(500).json({ error: error.message });
    }
});



// GENERATE PDF INVOICE
router.get('/:orderId/invoice', async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Create a new PDF document
        const doc = new PDFDocument({ margin: 50 });

        // Set response headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

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

        // Two-column layout for Customer Details and Invoice Info
        const columnWidth = 250; // Each column width (total page width ~550 - margins)
        const startY = doc.y;

        // Left Column: Customer Details
        doc.fontSize(14).font('Helvetica-Bold').text('Customer Details', 50, doc.y, { underline: true });
        doc.fontSize(10).font('Helvetica');;
        addText(`${order.user.shopName}`, 50, doc.y + 5, { width: columnWidth });
        addText(`Address: ${order.user.address}, ${order.user.town}, ${order.user.state}, ${order.user.pincode}`, 50, doc.y + 5, { width: columnWidth });
        addText(`Contact: ${order.user.contact?.[0]?.contact || 'N/A'}`, 50, doc.y + 5, { width: columnWidth });

        const formattedDate = new Date(order.createdAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        // Right Column: Invoice Info (aligned with Customer Details)
        doc.fontSize(20).text('INVOICE', 300, startY, { align: 'right' });
        doc.fontSize(12);
        doc.text(`Order ID: ${order.orderId}`, 300, doc.y + 5, { align: 'right' });
        doc.text(`Date: ${formattedDate}`, 300, doc.y + 5, {
            width: 250,
            align: 'right'
        });
        doc.moveDown(2);

        // Adjust Y position to the bottom of the tallest column
        const customerDetailsHeight = doc.y - startY;
        doc.y = startY + customerDetailsHeight + 20; // Move down after the tallest column

        // Product Details Table (full width)
        doc.fontSize(14).font('Helvetica-Bold').text('Order Details', 50, doc.y, { underline: true });
        
        let tableTop = doc.y + 10;
        if (isNaN(tableTop)) {
            console.error('Invalid tableTop:', tableTop);
            tableTop = 200; // Fallback to a safe value
        }
        const col1 = 50, col2 = 200, col3 = 250, col4 = 300, col5 = 350, col6 = 450;

        // Table Headers
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Product Name', col1, tableTop);
        doc.text('Weight', col2, tableTop);
        doc.text('Unit', col3, tableTop);
        doc.text('Rate (INR)', col4, tableTop);
        doc.text('Quantity', col5, tableTop);
        doc.text('Total (INR)', col6, tableTop);

        // Table Divider
        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        // Table Rows
        doc.font('Helvetica');
        let y = tableTop + 20;
        order.productDetails.forEach(product => {
            addText(product.name, col1, y, { width: 140 });
            doc.text(`${product.weight}`, col2, y);
            doc.text(product.unit, col3, y);
            doc.text(`${product.rate}`, col4, y);
            doc.text(`${product.quantity}`, col5, y);
            doc.text(`${product.totalAmount}`, col6, y);
            y += 20;
            if (y > 700) {
                doc.addPage();
                y = 50;
            }
        });
        doc.moveDown(2);

        // Free Products (if any)
        if (order.isfreeProducts && order.freeProducts?.length > 0) {
            doc.fontSize(14).text('Free Products', 50, doc.y, { underline: true });
            let freeTableTop = doc.y + 10;
            if (isNaN(freeTableTop)) {
                console.error('Invalid freeTableTop:', freeTableTop);
                freeTableTop = 200;
            }
            doc.fontSize(10).font('Helvetica-Bold');
            doc.text('Product Name', col1, freeTableTop);
            doc.text('Weight', col2, freeTableTop);
            doc.text('Unit', col3, freeTableTop);
            doc.text('Rate (INR)', col4, freeTableTop);
            doc.text('Quantity', col5, freeTableTop);
            doc.text('Total (INR)', col6, freeTableTop);
            doc.moveTo(50, freeTableTop + 15).lineTo(550, freeTableTop + 15).stroke();
            doc.font('Helvetica');
            y = freeTableTop + 20;
            order.freeProducts.forEach(product => {
                addText(product.name, col1, y, { width: 140 });
                doc.text(`${product.weight}`, col2, y);
                doc.text(product.unit, col3, y);
                doc.text(`${product.rate}`, col4, y);
                doc.text(`${product.quantity}`, col5, y);
                doc.text(`${product.totalAmount}`, col6, y);
                y += 20;
                if (y > 700) {
                    doc.addPage();
                    y = 50;
                }
            });
            doc.moveDown(2);
        }
        // Billing Summary (three columns: left, center, right)
        doc.fontSize(14).font('Helvetica-Bold').text('Billing Summary', 50, doc.y, { underline: true });
        doc.fontSize(10).font('Helvetica');
        y = doc.y + 10;

        const columnLeft = 50;
        const columnCenter = 200;
        const columnRight = 400;

        // Set a consistent starting Y position for all columns
        const billingStartY = y;

        // Left Column: Dues
        doc.font('Helvetica-Bold').text('Dues', columnLeft, billingStartY);
        doc.font('Helvetica').text(`Past Order Due: INR ${order.billing.pastOrderDue}`, columnLeft, billingStartY + 15);

        // Center Column: Current Order Billing
        doc.font('Helvetica-Bold').text('Current Order Billing', columnCenter, billingStartY);
        doc.font('Helvetica');
        addText(`Order Weight: ${order.billing.orderWeight} kg`, columnCenter, billingStartY + 15);
        addText(`Payment Method: ${order.billing.paymentMethod}`, columnCenter, billingStartY + 30);
        addText(`Money Given: INR ${order.billing.moneyGiven}`, columnCenter, billingStartY + 45);
        addText(`Order Amount: INR ${order.billing.orderAmount}`, columnCenter, billingStartY + 60);
        addText(`Delivery Charges: INR ${order.billing.deliveryCharges}`, columnCenter, billingStartY + 75);
        addText(`Total Amount: INR ${order.billing.totalAmount}`, columnCenter, billingStartY + 90);

        // Right Column: Final Billing
        doc.font('Helvetica-Bold').text('Final Billing', columnRight, billingStartY);
        doc.font('Helvetica');
        addText(`Total Amount: INR ${order.billing.totalAmount}`, columnRight, billingStartY + 15);
        addText(`Past Order Due: INR ${order.billing.pastOrderDue}`, columnRight, billingStartY + 30);
        addText(`Final Amount: INR ${order.billing.finalAmount}`, columnRight, billingStartY + 45);

        // Footer
        doc.moveDown(2);
        // Move to the bottom of the page
        // doc.moveDown(10);
        doc.text('Thank you for your business! Please pay within 15 days of receiving this invoice.', 0, 730, { align: 'center' });

        // Finalize the PDF
        doc.end();
    } catch (error) {
        console.error('Error generating invoice:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
});

module.exports = router;