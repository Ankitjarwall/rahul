const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const PDFDocument = require('pdfkit');
const SVGtoPDF = require('svg-to-pdfkit');
const fs = require('fs');
const path = require('path');

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
        // Check logo file
        const logoPath = path.join(__dirname, '../assets/logo.svg');
        if (!fs.existsSync(logoPath)) {
            throw new Error(`Logo file not found at ${logoPath}`);
        }

        // Fetch order from MongoDB
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Read logo as base64 (for embedding in HTML)
        const logoBase64 = fs.readFileSync(logoPath, 'base64');
        const logoDataUri = `data:image/svg+xml;base64,${logoBase64}`;

        // HTML Template with CSS
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        margin: 40px;
                        color: #2c3e50;
                    }
                    .container {
                        max-width: 800px;
                        margin: 0 auto;
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 20px;
                    }
                    .header img {
                        width: 100px;
                        height: auto;
                    }
                    .header h1 {
                        font-size: 24px;
                        margin: 10px 0 5px;
                    }
                    .header p {
                        font-size: 12px;
                        color: #7f8c8d;
                        margin: 0;
                    }
                    .invoice-title {
                        font-size: 18px;
                        color: #34495e;
                        margin-bottom: 20px;
                    }
                    .section {
                        margin-bottom: 20px;
                    }
                    .section h2 {
                        font-size: 16px;
                        border-bottom: 2px solid #34495e;
                        padding-bottom: 5px;
                        margin-bottom: 10px;
                    }
                    .section p {
                        font-size: 12px;
                        margin: 5px 0;
                    }
                    table {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 20px;
                    }
                    th, td {
                        padding: 8px;
                        text-align: left;
                        font-size: 12px;
                    }
                    th {
                        background-color: #34495e;
                        color: white;
                    }
                    tr:nth-child(even) {
                        background-color: #f5f6fa;
                    }
                    .footer {
                        position: fixed;
                        bottom: 20px;
                        width: 100%;
                        text-align: center;
                        font-size: 10px;
                        color: #7f8c8d;
                        border-top: 1px solid #34495e;
                        padding-top: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <!-- Header -->
                    <div class="header">
                        <img src="${logoDataUri}" alt="MacBease Logo" />
                        <h1>MacBease Connections Private Limited</h1>
                        <p>Be connected with each other</p>
                    </div>

                    <!-- Invoice Title -->
                    <div class="invoice-title">
                        Invoice #${order.orderId}
                    </div>

                    <!-- Order Details -->
                    <div class="section">
                        <h2>Order Details</h2>
                        <p>Order Date: ${new Date(order.createdAt).toLocaleDateString()}</p>
                        <p>Status: ${order.isfreeProducts ? 'With Free Products' : 'Standard'}</p>
                        <p>Total Amount: ₹${order.billing.totalAmount.toFixed(2)}</p>
                    </div>

                    <!-- Customer Details -->
                    <div class="section">
                        <h2>Customer Details</h2>
                        <p>Name: ${order.user.name}</p>
                        <p>Shop Name: ${order.user.shopName}</p>
                        <p>Address: ${order.user.address}, ${order.user.town}, ${order.user.state} - ${order.user.pincode}</p>
                        <p>Contact: ${order.user.contact.map(c => c.contact_1).join(', ')}</p>
                        <p>Past Dues: ₹${order.user.userDues.toFixed(2)}</p>
                    </div>

                    <!-- Product Details -->
                    <div class="section">
                        <h2>Products</h2>
                        <table>
                            <thead>
                                <tr>
                                    <th>Product Name</th>
                                    <th>Weight</th>
                                    <th>Unit</th>
                                    <th>Rate</th>
                                    <th>Qty</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${order.productDetails.map(product => `
                                    <tr>
                                        <td>${product.name}</td>
                                        <td>${product.weight}</td>
                                        <td>${product.unit}</td>
                                        <td>₹${product.rate}</td>
                                        <td>${product.quantity}</td>
                                        <td>₹${product.totalAmount}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>

                    <!-- Free Products (if applicable) -->
                    ${order.isfreeProducts && order.freeProducts.length > 0 ? `
                        <div class="section">
                            <h2>Free Products</h2>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Product Name</th>
                                        <th>Weight</th>
                                        <th>Unit</th>
                                        <th>Qty</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.freeProducts.map(product => `
                                        <tr>
                                            <td>${product.name}</td>
                                            <td>${product.weight}</td>
                                            <td>${product.unit}</td>
                                            <td>${product.quantity}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    ` : ''}

                    <!-- Billing Summary -->
                    <div class="section">
                        <h2>Billing Summary</h2>
                        <p>Order Amount: ₹${order.billing.orderAmount.toFixed(2)}</p>
                        <p>Delivery Charges: ₹${order.billing.deliveryCharges.toFixed(2)}</p>
                        <p>Past Dues: ₹${order.billing.pastOrderDue.toFixed(2)}</p>
                        <p>Payment Method: ${order.billing.paymentMethod}</p>
                        <p>Final Amount: ₹${order.billing.finalAmount.toFixed(2)}</p>
                    </div>

                    <!-- Comments -->
                    ${order.comments.length > 0 ? `
                        <div class="section">
                            <h2>Notes</h2>
                            ${order.comments.map(comment => `
                                <p>${new Date(comment.date).toLocaleDateString()}: ${comment.message}</p>
                            `).join('')}
                        </div>
                    ` : ''}

                    <!-- Footer -->
                    <div class="footer">
                        MacBease Connections Private Limited | Contact: support@macbease.com | Phone: +91-123-456-7890
                    </div>
                </div>
            </body>
            </html>
        `;

        // PDF options
        const options = {
            format: 'A4',
            border: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        };

        // Set response headers
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=invoice-${order.orderId}.pdf`);

        // Generate PDF from HTML
        pdf.create(htmlContent, options).toStream((err, stream) => {
            if (err) {
                console.error('PDF Creation Error:', err);
                if (!res.headersSent) {
                    return res.status(500).json({ error: 'Failed to generate PDF' });
                }
                return;
            }
            stream.pipe(res);
            stream.on('end', () => res.end());
            stream.on('error', (streamErr) => {
                console.error('Stream Error:', streamErr);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'PDF streaming failed' });
                }
            });
        });

    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: `Failed to generate PDF: ${error.message}` });
        }
    }
});

module.exports = router;