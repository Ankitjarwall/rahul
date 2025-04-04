const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const fs = require('fs');
const path = require('path');
// const pdf = require('html-pdf');

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
router.get('/invoice/:orderId', async (req, res) => {
    try {
        // Check dependencies
        if (!PDFDocument) throw new Error('PDFDocument is not available. Check pdfkit installation.');
        if (!SVGtoPDF) throw new Error('SVGtoPDF is not available. Check svg-to-pdfkit installation.');

        // Check logo file
        const logoPath = path.join(__dirname, '../assets/logo.svg');
        if (!fs.existsSync(logoPath)) {
            throw new Error(`Logo file not found at ${logoPath}`);
        }
        let logoSVG;
        try {
            logoSVG = fs.readFileSync(logoPath, 'utf8');
        } catch (fileErr) {
            throw new Error(`Failed to read logo file: ${fileErr.message}`);
        }

        // Fetch order from MongoDB
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Load logo as base64
        const logoBase64 = fs.readFileSync(logoPath, 'base64');
        const logoDataUri = `data:image/svg+xml;base64,${logoBase64}`;

        // HTML Template (editable)
        const htmlTemplate = `
            <div style="font-family: Arial, sans-serif; color: #2c3e50; max-width: 800px; margin: 40px;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${logoDataUri}" style="width: 100px; height: auto;" />
                    <h1 style="font-size: 24px; margin: 10px 0 5px;">MacBease Connections Private Limited</h1>
                    <p style="font-size: 12px; color: #7f8c8d; margin: 0;">Be connected with each other</p>
                </div>

                <!-- Invoice Title -->
                <div style="font-size: 18px; color: #34495e; margin-bottom: 20px;">
                    Invoice #${order.orderId}
                </div>

                <!-- Order Details -->
                <div style="margin-bottom: 20px;">
                    <h2 style="font-size: 16px; border-bottom: 2px solid #34495e; padding-bottom: 5px;">Order Details</h2>
                    <p style="font-size: 12px;">Order Date: ${new Date(order.createdAt).toLocaleDateString()}</p>
                    <p style="font-size: 12px;">Status: ${order.isfreeProducts ? 'With Free Products' : 'Standard'}</p>
                    <p style="font-size: 12px;">Total Amount: ₹${order.billing.totalAmount.toFixed(2)}</p>
                </div>

                <!-- Customer Details -->
                <div style="margin-bottom: 20px;">
                    <h2 style="font-size: 16px; border-bottom: 2px solid #34495e; padding-bottom: 5px;">Customer Details</h2>
                    <p style="font-size: 12px;">Name: ${order.user.name}</p>
                    <p style="font-size: 12px;">Shop Name: ${order.user.shopName}</p>
                    <p style="font-size: 12px;">Address: ${order.user.address}, ${order.user.town}, ${order.user.state} - ${order.user.pincode}</p>
                    <p style="font-size: 12px;">Contact: ${order.user.contact.map(c => c.contact_1).join(', ')}</p>
                    <p style="font-size: 12px;">Past Dues: ₹${order.user.userDues.toFixed(2)}</p>
                </div>

                <!-- Products -->
                <div style="margin-bottom: 20px;">
                    <h2 style="font-size: 16px; border-bottom: 2px solid #34495e; padding-bottom: 5px;">Products</h2>
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background-color: #34495e; color: white;">
                                <th style="padding: 8px; font-size: 12px;">Product Name</th>
                                <th style="padding: 8px; font-size: 12px;">Weight</th>
                                <th style="padding: 8px; font-size: 12px;">Unit</th>
                                <th style="padding: 8px; font-size: 12px;">Rate</th>
                                <th style="padding: 8px; font-size: 12px;">Qty</th>
                                <th style="padding: 8px; font-size: 12px;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${order.productDetails.map((product, index) => `
                                <tr style="background-color: ${index % 2 === 0 ? '#f5f6fa' : '#ffffff'};">
                                    <td style="padding: 8px; font-size: 12px;">${product.name}</td>
                                    <td style="padding: 8px; font-size: 12px;">${product.weight}</td>
                                    <td style="padding: 8px; font-size: 12px;">${product.unit}</td>
                                    <td style="padding: 8px; font-size: 12px;">₹${product.rate}</td>
                                    <td style="padding: 8px; font-size: 12px;">${product.quantity}</td>
                                    <td style="padding: 8px; font-size: 12px;">₹${product.totalAmount}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>

                <!-- Free Products -->
                ${order.isfreeProducts && order.freeProducts.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h2 style="font-size: 16px; border-bottom: 2px solid #34495e; padding-bottom: 5px;">Free Products</h2>
                        <table style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background-color: #34495e; color: white;">
                                    <th style="padding: 8px; font-size: 12px;">Product Name</th>
                                    <th style="padding: 8px; font-size: 12px;">Weight</th>
                                    <th style="padding: 8px; font-size: 12px;">Unit</th>
                                    <th style="padding: 8px; font-size: 12px;">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.freeProducts.map((product, index) => `
                                    <tr style="background-color: ${index % 2 === 0 ? '#f5f6fa' : '#ffffff'};">
                                        <td style="padding: 8px; font-size: 12px;">${product.name}</td>
                                        <td style="padding: 8px; font-size: 12px;">${product.weight}</td>
                                        <td style="padding: 8px; font-size: 12px;">${product.unit}</td>
                                        <td style="padding: 8px; font-size: 12px;">${product.quantity}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : ''}

                <!-- Billing Summary -->
                <div style="margin-bottom: 20px;">
                    <h2 style="font-size: 16px; border-bottom: 2px solid #34495e; padding-bottom: 5px;">Billing Summary</h2>
                    <p style="font-size: 12px;">Order Amount: ₹${order.billing.orderAmount.toFixed(2)}</p>
                    <p style="font-size: 12px;">Delivery Charges: ₹${order.billing.deliveryCharges.toFixed(2)}</p>
                    <p style="font-size: 12px;">Past Dues: ₹${order.billing.pastOrderDue.toFixed(2)}</p>
                    <p style="font-size: 12px;">Payment Method: ${order.billing.paymentMethod}</p>
                    <p style="font-size: 12px;">Final Amount: ₹${order.billing.finalAmount.toFixed(2)}</p>
                </div>

                <!-- Comments -->
                ${order.comments.length > 0 ? `
                    <div style="margin-bottom: 20px;">
                        <h2 style="font-size: 16px; border-bottom: 2px solid #34495e; padding-bottom: 5px;">Notes</h2>
                        ${order.comments.map(comment => `
                            <p style="font-size: 12px;">${new Date(comment.date).toLocaleDateString()}: ${comment.message}</p>
                        `).join('')}
                    </div>
                ` : ''}

                <!-- Footer -->
                <div style="position: fixed; bottom: 20px; width: 100%; text-align: center; font-size: 10px; color: #7f8c8d; border-top: 1px solid #34495e; padding-top: 10px;">
                    MacBease Connections Private Limited | Contact: support@macbease.com | Phone: +91-123-456-7890
                </div>
            </div>
        `;

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

        // Create PDF document
        const doc = new PDFDocument({ size: 'A4', margin: 40 });
        doc.pipe(res);

        // Parse HTML manually (simplified approach)
        let y = 40; // Starting Y position

        // Header
        SVGtoPDF(doc, logoSVG, 250, y, { width: 100 });
        y += 110; // Adjust for logo height
        doc.fontSize(24).fillColor('#2c3e50').text('MacBease Connections Private Limited', 0, y, { align: 'center' });
        y += 30;
        doc.fontSize(12).fillColor('#7f8c8d').text('Be connected with each other', 0, y, { align: 'center' });
        y += 40;

        // Invoice Title
        doc.fontSize(18).fillColor('#34495e').text(`Invoice #${order.orderId}`, 40, y);
        y += 30;

        // Order Details
        doc.fontSize(16).fillColor('#2c3e50').text('Order Details', 40, y, { underline: true });
        y += 20;
        doc.fontSize(12).fillColor('#000000');
        doc.text(`Order Date: ${new Date(order.createdAt).toLocaleDateString()}`, 40, y);
        y += 15;
        doc.text(`Status: ${order.isfreeProducts ? 'With Free Products' : 'Standard'}`, 40, y);
        y += 15;
        doc.text(`Total Amount: ₹${order.billing.totalAmount.toFixed(2)}`, 40, y);
        y += 30;

        // Customer Details
        doc.fontSize(16).fillColor('#2c3e50').text('Customer Details', 40, y, { underline: true });
        y += 20;
        doc.fontSize(12).fillColor('#000000');
        doc.text(`Name: ${order.user.name}`, 40, y);
        y += 15;
        doc.text(`Shop Name: ${order.user.shopName}`, 40, y);
        y += 15;
        doc.text(`Address: ${order.user.address}, ${order.user.town}, ${order.user.state} - ${order.user.pincode}`, 40, y);
        y += 15;
        doc.text(`Contact: ${order.user.contact.map(c => c.contact_1).join(', ')}`, 40, y);
        y += 15;
        doc.text(`Past Dues: ₹${order.user.userDues.toFixed(2)}`, 40, y);
        y += 30;

        // Products Table
        doc.fontSize(16).fillColor('#2c3e50').text('Products', 40, y, { underline: true });
        y += 20;
        const tableWidth = 500;
        doc.fontSize(12).fillColor('#ffffff').rect(40, y, tableWidth, 20).fill('#34495e');
        doc.fillColor('#ffffff');
        doc.text('Product Name', 40, y + 5);
        doc.text('Weight', 190, y + 5);
        doc.text('Unit', 250, y + 5);
        doc.text('Rate', 310, y + 5);
        doc.text('Qty', 370, y + 5);
        doc.text('Total', 430, y + 5);
        y += 20;

        order.productDetails.forEach((product, index) => {
            doc.fillColor('#000000')
                .rect(40, y, tableWidth, 20)
                .fill(index % 2 === 0 ? '#f5f6fa' : '#ffffff');
            doc.fillColor('#000000');
            doc.text(product.name, 40, y + 5, { width: 150 });
            doc.text(product.weight.toString(), 190, y + 5);
            doc.text(product.unit, 250, y + 5);
            doc.text(`₹${product.rate}`, 310, y + 5);
            doc.text(product.quantity.toString(), 370, y + 5);
            doc.text(`₹${product.totalAmount}`, 430, y + 5);
            y += 20;
        });
        y += 10;

        // Free Products (if applicable)
        if (order.isfreeProducts && order.freeProducts.length > 0) {
            doc.fontSize(16).fillColor('#2c3e50').text('Free Products', 40, y, { underline: true });
            y += 20;
            doc.fillColor('#ffffff').rect(40, y, 400, 20).fill('#34495e');
            doc.fillColor('#ffffff');
            doc.text('Product Name', 40, y + 5);
            doc.text('Weight', 190, y + 5);
            doc.text('Unit', 250, y + 5);
            doc.text('Qty', 310, y + 5);
            y += 20;

            order.freeProducts.forEach((product, index) => {
                doc.fillColor('#000000')
                    .rect(40, y, 400, 20)
                    .fill(index % 2 === 0 ? '#f5f6fa' : '#ffffff');
                doc.fillColor('#000000');
                doc.text(product.name, 40, y + 5, { width: 150 });
                doc.text(product.weight.toString(), 190, y + 5);
                doc.text(product.unit, 250, y + 5);
                doc.text(product.quantity.toString(), 310, y + 5);
                y += 20;
            });
            y += 10;
        }

        // Billing Summary
        doc.fontSize(16).fillColor('#2c3e50').text('Billing Summary', 40, y, { underline: true });
        y += 20;
        doc.fontSize(12).fillColor('#000000');
        doc.text(`Order Amount: ₹${order.billing.orderAmount.toFixed(2)}`, 40, y);
        y += 15;
        doc.text(`Delivery Charges: ₹${order.billing.deliveryCharges.toFixed(2)}`, 40, y);
        y += 15;
        doc.text(`Past Dues: ₹${order.billing.pastOrderDue.toFixed(2)}`, 40, y);
        y += 15;
        doc.text(`Payment Method: ${order.billing.paymentMethod}`, 40, y);
        y += 15;
        doc.text(`Final Amount: ₹${order.billing.finalAmount.toFixed(2)}`, 40, y);
        y += 30;

        // Comments
        if (order.comments.length > 0) {
            doc.fontSize(16).fillColor('#2c3e50').text('Notes', 40, y, { underline: true });
            y += 20;
            doc.fontSize(12).fillColor('#000000');
            order.comments.forEach(comment => {
                doc.text(`${new Date(comment.date).toLocaleDateString()}: ${comment.message}`, 40, y);
                y += 15;
            });
        }

        // Footer (fixed at bottom)
        doc.moveTo(40, 700).lineTo(560, 700).stroke('#34495e');
        doc.fontSize(10)
            .fillColor('#7f8c8d')
            .text(
                'MacBease Connections Private Limited | Contact: support@macbease.com | Phone: +91-123-456-7890',
                40, 710,
                { align: 'center' }
            );

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: `Failed to generate PDF: ${error.message}` });
        }
    }
});
module.exports = router;