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
    orderAmount: Joi.number().required(),
    deliveryCharges: Joi.number().min(0).required(),
    totalAmount: Joi.number().required(),
    paymentMethod: Joi.string().required(),
    moneyGiven: Joi.number().required(),
    pastOrderDue: Joi.number().required(),
    finalAmount: Joi.number().required(),
    duesFromThisOrder: Joi.number().default(0) // Remaining unpaid from this order
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

// Simplified validation schema for new order
const simpleOrderSchema = Joi.object({
    userId: Joi.string().required(),
    products: Joi.array().items(Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        rate: Joi.number().positive().optional() // Optional custom rate, otherwise use product's default
    })).required().min(1),
    freeProducts: Joi.array().items(Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).default(1)
    })).optional(),
    deliveryCharges: Joi.number().min(0).optional(), // Optional, will use user's delivery rate if not provided
    moneyGiven: Joi.number().min(0).default(0),
    paymentMethod: Joi.string().valid('Cash', 'Credit').default('Cash'),
    comments: Joi.string().allow('', null).optional()
});

// ORDER REVIEW - Preview order summary before placing (no save)
router.post('/review', async (req, res) => {
    console.log("Order Review Request:", JSON.stringify(req.body, null, 2));
    try {
        const { error, value } = simpleOrderSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { userId, products, freeProducts, moneyGiven, paymentMethod, comments } = value;
        let { deliveryCharges } = value;

        // Fetch user details
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(400).json({ error: `User not found: ${userId}` });
        }

        // Use user's delivery rate if deliveryCharges not provided
        if (deliveryCharges === undefined || deliveryCharges === null) {
            deliveryCharges = user.delivery || 0;
        }

        // Helper function to parse weight string (e.g., "100g", "1kg", "500ml") to numeric value in grams
        const parseWeight = (weightStr) => {
            if (!weightStr) return 0;
            if (typeof weightStr === 'number') return weightStr;
            const str = String(weightStr).toLowerCase().trim();
            const match = str.match(/^([\d.]+)\s*(g|gm|gram|grams|kg|kilogram|ml|l|liter|litre|pcs|pc|piece|pieces)?$/i);
            if (!match) return 0;
            const value = parseFloat(match[1]);
            const unit = match[2] || 'g';
            if (unit === 'kg' || unit === 'kilogram') return value * 1000;
            if (unit === 'l' || unit === 'liter' || unit === 'litre') return value * 1000;
            return value;
        };

        // Validate and fetch all products
        const productDetails = [];
        let orderAmount = 0;
        let orderWeight = 0;

        for (const item of products) {
            const product = await Product.findOne({ productId: item.productId });
            if (!product) {
                return res.status(400).json({ error: `Product not found: ${item.productId}` });
            }

            const rate = item.rate || product.rate || product.mrp;
            const totalAmount = rate * item.quantity;
            const numericWeight = parseWeight(product.weight);
            const itemWeight = numericWeight * item.quantity;

            productDetails.push({
                productId: product.productId,
                productName: product.productName || 'Unknown',
                weight: product.weight || 'N/A',
                unit: product.unit || 'N/A',
                mrp: product.mrp || 0,
                rate: rate,
                quantity: item.quantity,
                totalAmount: totalAmount,
                item_total_weight: itemWeight,
                image: product.productImage?.[0]?.image || ''
            });

            orderAmount += totalAmount;
            orderWeight += itemWeight;
        }

        // Calculate billing (pastOrderDue not included in review - only for this order)
        const userCurrentDues = user.dues || 0;
        const totalAmount = orderAmount + deliveryCharges;
        const finalAmount = totalAmount; // No pastOrderDue in review
        const newDues = finalAmount - moneyGiven; // Dues from this order only

        // Process free products - fetch from database
        const freeProductsList = [];
        let freeProductsWeight = 0;
        let freeProductsMrpTotal = 0;
        let freeProductsRateTotal = 0;
        if (freeProducts && freeProducts.length > 0) {
            for (const fp of freeProducts) {
                const freeProduct = await Product.findOne({ productId: fp.productId });
                if (!freeProduct) {
                    return res.status(400).json({ error: `Free product not found: ${fp.productId}` });
                }
                const numericFpWeight = parseWeight(freeProduct.weight);
                const fpWeight = numericFpWeight * (fp.quantity || 1);
                const fpRate = freeProduct.rate || freeProduct.mrp || 0;
                const fpTotalAmount = fpRate * (fp.quantity || 1);
                const fpMrpTotal = (freeProduct.mrp || 0) * (fp.quantity || 1);
                freeProductsWeight += fpWeight;
                freeProductsMrpTotal += fpMrpTotal;
                freeProductsRateTotal += fpTotalAmount;
                freeProductsList.push({
                    productId: freeProduct.productId,
                    productName: freeProduct.productName || 'Unknown',
                    weight: freeProduct.weight || 'N/A',
                    unit: freeProduct.unit || 'N/A',
                    mrp: freeProduct.mrp || 0,
                    rate: fpRate,
                    quantity: fp.quantity || 1,
                    totalAmount: fpTotalAmount,
                    item_total_weight: fpWeight,
                    item_mrp_total: fpMrpTotal,
                    image: freeProduct.productImage?.[0]?.image || ''
                });
            }
        }

        // Calculate total order weight (products + free products)
        const totalOrderWeight = orderWeight + freeProductsWeight;

        // Build review response (same structure as saved order)
        const orderReview = {
            user: {
                userId: user.userId,
                name: user.name,
                shopName: user.shopName,
                currentDues: userCurrentDues, // User's existing dues (info only)
                address: user.address || '',
                town: user.town || '',
                state: user.state || '',
                pincode: user.pincode || 0,
                fullAddress: `${user.address || ''}, ${user.town || ''}, ${user.state || ''} - ${user.pincode || ''}`,
                contact: user.contact || []
            },
            productDetails,
            freeProducts: freeProductsList,
            billing: {
                productsWeight: orderWeight,
                freeProductsWeight: freeProductsWeight,
                totalOrderWeight: totalOrderWeight,
                productsAmount: orderAmount,
                freeProductsValue: freeProductsRateTotal,
                freeProductsMrpValue: freeProductsMrpTotal,
                orderAmount,
                deliveryCharges,
                totalAmount,
                paymentMethod,
                moneyGiven,
                finalAmount,
                duesFromThisOrder: newDues // Dues generated from this order only
            },
            summary: {
                totalProducts: productDetails.length,
                totalQuantity: productDetails.reduce((sum, p) => sum + p.quantity, 0),
                totalOrderWeight: totalOrderWeight,
                hasFreeProducts: freeProductsList.length > 0,
                freeProductsCount: freeProductsList.length,
                freeProductsQuantity: freeProductsList.reduce((sum, p) => sum + p.quantity, 0),
                willCreateDues: newDues > 0
            },
            isfreeProducts: freeProductsList.length > 0,
            comments: comments || ''
        };

        res.json({
            success: true,
            message: 'Order review generated successfully',
            data: orderReview
        });
    } catch (error) {
        console.error('Error generating order review:', error);
        res.status(500).json({ error: error.message });
    }
});

// ADD order (Simplified - auto-fetches user & product details)
router.post('/', async (req, res) => {
    console.log("Received order data:", JSON.stringify(req.body, null, 2));
    try {
        const { error, value } = simpleOrderSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            const errors = error.details.map(err => err.message);
            console.error('Validation errors:', errors);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const { userId, products, freeProducts, moneyGiven, paymentMethod, comments } = value;
        let { deliveryCharges } = value;

        // Fetch user details
        const user = await User.findOne({ userId });
        if (!user) {
            return res.status(400).json({ error: `User not found: ${userId}` });
        }

        // Use user's delivery rate if deliveryCharges not provided
        if (deliveryCharges === undefined || deliveryCharges === null) {
            deliveryCharges = user.delivery || 0;
        }

        // Helper function to parse weight string (e.g., "100g", "1kg", "500ml") to numeric value
        const parseWeight = (weightStr) => {
            if (!weightStr) return 0;
            if (typeof weightStr === 'number') return weightStr;
            const str = String(weightStr).toLowerCase().trim();
            const match = str.match(/^([\d.]+)\s*(g|gm|gram|grams|kg|kilogram|ml|l|liter|litre|pcs|pc|piece|pieces)?$/i);
            if (!match) return 0;
            const value = parseFloat(match[1]);
            const unit = match[2] || 'g';
            if (unit === 'kg' || unit === 'kilogram') return value * 1000;
            if (unit === 'l' || unit === 'liter' || unit === 'litre') return value * 1000;
            return value;
        };

        // Validate and fetch all products BEFORE creating order
        const productDetails = [];
        let orderAmount = 0;
        let orderWeight = 0;

        for (const item of products) {
            const product = await Product.findOne({ productId: item.productId });
            if (!product) {
                return res.status(400).json({ error: `Product not found: ${item.productId}` });
            }

            const rate = item.rate || product.rate || product.mrp;
            const totalAmount = rate * item.quantity;
            const numericWeight = parseWeight(product.weight);
            const itemWeight = numericWeight * item.quantity;

            productDetails.push({
                productId: product.productId,
                name: product.productName || 'Unknown',
                weight: numericWeight,
                unit: product.unit || 'N/A',
                mrp: product.mrp || 0,
                rate: rate,
                quantity: item.quantity,
                totalAmount: totalAmount,
                image: product.productImage?.[0]?.image || ''
            });

            orderAmount += totalAmount;
            orderWeight += itemWeight;
        }

        // Calculate billing
        const pastOrderDue = user.dues || 0;
        const totalAmount = orderAmount + deliveryCharges;
        const duesFromThisOrder = totalAmount - moneyGiven; // Unpaid from this order
        const finalAmount = pastOrderDue + duesFromThisOrder; // Total remaining dues after payment

        // Process free products - fetch from database
        const freeProductsList = [];
        if (freeProducts && freeProducts.length > 0) {
            for (const fp of freeProducts) {
                const freeProduct = await Product.findOne({ productId: fp.productId });
                if (!freeProduct) {
                    return res.status(400).json({ error: `Free product not found: ${fp.productId}` });
                }
                const fpNumericWeight = parseWeight(freeProduct.weight);
                freeProductsList.push({
                    productId: freeProduct.productId,
                    name: freeProduct.productName || 'Unknown',
                    weight: fpNumericWeight,
                    unit: freeProduct.unit || 'N/A',
                    mrp: freeProduct.mrp || 0,
                    rate: 0,
                    quantity: fp.quantity || 1,
                    totalAmount: 0,
                    image: freeProduct.productImage?.[0]?.image || ''
                });
            }
        }

        // Generate order ID
        const generateOrderId = async () => {
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const datePrefix = `${day}${month}${year}`;
            const count = await Order.countDocuments({ orderId: { $regex: `^${datePrefix}OR` } });
            return `${datePrefix}OR${count + 1}`;
        };

        const orderId = await generateOrderId();

        // Build order data
        const orderData = {
            orderId,
            user: {
                userId: user.userId,
                name: user.name,
                shopName: user.shopName,
                userDues: pastOrderDue,
                address: user.address || '',
                town: user.town || '',
                state: user.state || '',
                pincode: user.pincode || 0,
                contact: user.contact || []
            },
            productDetails,
            freeProducts: freeProductsList,
            billing: {
                orderWeight,
                orderAmount,
                deliveryCharges,
                totalAmount,
                paymentMethod,
                moneyGiven,
                pastOrderDue,
                duesFromThisOrder,
                finalAmount // pastOrderDue + duesFromThisOrder (total remaining dues)
            },
            isfreeProducts: freeProductsList.length > 0
        };

        // Generate comment - use provided or create default (IST timezone)
        const commentDate = new Date();
        const formattedCommentDate = commentDate.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        });
        const formattedCommentTime = commentDate.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        }).replace(' ', '');
        const remainingAmount = totalAmount - moneyGiven;
        const defaultComment = `Used ${paymentMethod} the amount remaining is ${remainingAmount}rs. ${formattedCommentDate}`;

        // Store date in IST format
        const istDateString = commentDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
        // Use provided comment or default (empty string also uses default)
        const finalComment = (comments && comments.trim()) ? comments.trim() : defaultComment;
        orderData.comments = [{
            message: finalComment,
            date: `${formattedCommentDate} ${formattedCommentTime} IST`
        }];

        // Save order
        const order = new Order(orderData);
        await order.save();

        // Update user dues - finalAmount is the new total dues
        await User.findOneAndUpdate(
            { userId },
            { $set: { dues: finalAmount } }
        );

        // Save user and product history
        for (const product of productDetails) {
            const productDoc = await Product.findOne({ productId: product.productId });

            const userHistory = new UserHistory({
                productId: productDoc._id,
                productName: product.name,
                userShopName: user.shopName,
                userId: user._id,
                orderId: order._id,
                orderIdString: order.orderId
            });
            await userHistory.save();

            const productHistory = new ProductHistory({
                productId: productDoc._id,
                productName: product.name,
                userId: user._id,
                userShopName: user.shopName,
                orderId: order._id,
                orderIdString: order.orderId
            });
            await productHistory.save();
        }

        // Format response (IST timezone)
        const now = new Date();
        const formattedOrderDate = now.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
        });
        const formattedOrderTime = now.toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
            timeZone: 'Asia/Kolkata'
        }).replace(' ', '');

        res.status(201).json({
            success: true,
            message: 'Order created successfully',
            data: {
                orderId: order.orderId,
                userId: user.userId,
                shopName: user.shopName,
                totalProducts: productDetails.length,
                orderAmount,
                deliveryCharges,
                totalAmount,
                moneyGiven,
                duesFromThisOrder, // Dues generated from this order
                userTotalDues: finalAmount, // User's total dues after this order
                paymentMethod,
                orderDate: formattedOrderDate,
                orderTime: formattedOrderTime
            }
        });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET all orders
router.get('/', async (req, res) => {
    console.log("Get All Orders Request");
    try {
        const orders = await Order.find()
            .select('orderId user.name user.shopName user.town user.state productDetails.name billing.totalAmount createdAt');
        console.log(`Found ${orders.length} orders`);
        res.json(orders);
    } catch (error) {
        console.error('Error fetching all orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// SEARCH orders (must be before /:orderId route)
router.post('/search', async (req, res) => {
    console.log("Search Orders Request - Query:", req.body.query);
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'No search query provided' });
        const orders = await Order.find({ $text: { $search: query } })
            .select('orderId user.name user.shopName user.town user.state productDetails.name billing.totalAmount createdAt');
        console.log(`Search found ${orders.length} orders for query: "${query}"`);
        res.json(orders);
    } catch (error) {
        console.error('Error searching orders:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET specific order
router.get('/:orderId', async (req, res) => {
    console.log("Get Order Request - OrderId:", req.params.orderId);
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) {
            console.log("Order not found:", req.params.orderId);
            return res.status(404).json({ error: 'Order not found' });
        }
        console.log("Order found:", order.orderId);
        res.json(order);
    } catch (error) {
        console.error('Error fetching order:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE order
router.put('/:orderId', async (req, res) => {
    console.log("Update Order Request - OrderId:", req.params.orderId);
    console.log("Update Data:", JSON.stringify(req.body, null, 2));
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
    console.log("Delete Order Request - OrderId:", req.params.orderId);
    try {
        const order = await Order.findOneAndDelete({ orderId: req.params.orderId });
        if (!order) {
            console.log("Order not found for deletion:", req.params.orderId);
            return res.status(404).json({ error: 'Order not found' });
        }
        await UserHistory.deleteMany({ orderId: order._id });
        await ProductHistory.deleteMany({ orderId: order._id });
        console.log("Order deleted successfully:", req.params.orderId);
        res.json({ success: 'Order deleted successfully' });
    } catch (error) {
        console.error('Error deleting order:', error);
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

        const formattedDate = new Date(order.createdAt).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            timeZone: 'Asia/Kolkata'
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
        addText(`Order Amount: INR ${order.billing.orderAmount}`, columnCenter, billingStartY + 70);
        addText(`Delivery Charges: INR ${order.billing.deliveryCharges}`, columnCenter, billingStartY + 85);
        addText(`Total Amount: INR ${order.billing.totalAmount}`, columnCenter, billingStartY + 100);

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