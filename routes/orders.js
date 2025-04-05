const express = require('express');
const router = express.Router();
const Order = require('../models/Order');
const PDFDocument = require('pdfkit');
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
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ error: 'Order not found' });

        const isPreview = req.query.preview === 'true';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            isPreview ? 'inline' : `attachment; filename=invoice-${order.orderId}.pdf`
        );

        const doc = new PDFDocument({
            size: 'A4',
            margin: 40,
            info: {
                Title: `Invoice #${order.orderId}`,
                Author: 'Durga Sai Enterprises',
                Subject: 'Invoice',
                Keywords: 'invoice, order, payment'
            }
        });

        // Register font that supports the ₹ symbol
        const fontPath = path.join(process.cwd(), 'assets', 'fonts', 'DejaVuSans.ttf');
        doc.registerFont('DejaVuSans', fontPath);

        // Handle PDF errors
        doc.on('error', (error) => {
            if (!res.headersSent) {
                res.status(500).json({ error: `Failed to generate PDF: ${error.message}` });
            }
        });

        doc.pipe(res);

        const logoPath = path.join(process.cwd(), 'assets', 'logo.png');
        const currentDate = new Date().toLocaleDateString('en-GB', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        }).replace(/\//g, '.');

        renderHeader(doc, logoPath, order, currentDate);
        const billingDetailsY = renderBillingDetails(doc, order);
        const tableEndY = renderProductTable(doc, order, billingDetailsY + 20);
        const totalSectionY = renderTotalSection(doc, order, tableEndY + 20);
        renderFooter(doc, logoPath);

        doc.end();
    } catch (error) {
        console.error('PDF Generation Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: `Failed to generate PDF: ${error.message}` });
        }
    }
});

function renderHeader(doc, logoPath, order, currentDate) {
    let y = 60;

    if (fs.existsSync(logoPath)) {
        try {
            doc.image(logoPath, 40, y, { width: 80 });
        } catch (error) {
            console.error('Error loading header logo:', error);
        }
    }

    doc.font('Helvetica-Bold')
        .fontSize(20)
        .text('Durga Sai Enterprises', 130, y);

    doc.font('Helvetica')
        .fontSize(10)
        .text('durgasaienterprises@email.com', 130, y + 25)
        .text('+91 98765 43213', 130, y + 40);

    doc.font('Helvetica-Bold')
        .fontSize(40)
        .fillColor('#cccccc')
        .text('Invoice', 400, y, { align: 'right' });

    doc.fontSize(12)
        .fillColor('#333333')
        .text(`#${order.orderId}`, 400, y + 45, { align: 'right' });

    doc.fontSize(10)
        .text('INVOICE DATE', 400, y + 65, { align: 'right' })
        .font('Helvetica-Bold')
        .fontSize(12)
        .text(currentDate, 400, y + 80, { align: 'right' });

    return y + 100;
}

function renderBillingDetails(doc, order) {
    const y = 160;

    doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#333333')
        .text('BILLED TO', 40, y);

    doc.font('Helvetica-Bold')
        .fontSize(12)
        .text(order.user.shopName, 40, y + 15);

    doc.font('Helvetica')
        .fontSize(10)
        .text(order.user.address, 40, y + 30)
        .text(`${order.user.town}, ${order.user.state} - ${order.user.pincode}`, 40, y + 45);

    if (order.user.contact && order.user.contact.length > 0) {
        doc.text(`+91 ${order.user.contact[0].contact_1}`, 40, y + 60);
    }

    const totalAmount = calculateTotalAmount(order);
    doc.font('DejaVuSans')
        .fontSize(14)
        .fillColor('#FF0066')
        .text(`₹${totalAmount.toFixed(2)} dues`, 400, y + 60, { align: 'right' });

    return y + 80;
}

function renderProductTable(doc, order, startY) {
    const y = startY;
    const tableWidth = 520;
    const columnWidths = {
        name: 220,
        mrp: 80,
        rate: 80,
        qty: 60,
        total: 100
    };

    doc.fillColor('#F6F6F6')
        .rect(40, y, tableWidth, 30)
        .fill();

    doc.fillColor('#333333')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Product Name', 50, y + 10)
        .text('MRP', 40 + columnWidths.name + 10, y + 10, { align: 'right' })
        .text('Rate', 40 + columnWidths.name + columnWidths.mrp + 10, y + 10, { align: 'right' })
        .text('Qty', 40 + columnWidths.name + columnWidths.mrp + columnWidths.rate + 10, y + 10, { align: 'right' })
        .text('Total', 40 + columnWidths.name + columnWidths.mrp + columnWidths.rate + columnWidths.qty + 10, y + 10, { align: 'right' });

    let currentY = y + 30;

    order.productDetails.forEach(product => {
        const rowHeight = 20;
        if (currentY + rowHeight > doc.page.height - 50) {
            doc.addPage();
            currentY = 40;
        }

        doc.font('Helvetica')
            .fontSize(9)
            .fillColor('#333333')
            .text(product.name, 50, currentY + 5, { width: columnWidths.name - 10, align: 'left' })
            .font('DejaVuSans')
            .text(`₹${(product.rate + 20).toFixed(2)}`, 40 + columnWidths.name + 10, currentY + 5, { align: 'right' })
            .text(`₹${product.rate.toFixed(2)}`, 40 + columnWidths.name + columnWidths.mrp + 10, currentY + 5, { align: 'right' })
            .text(product.quantity.toString(), 40 + columnWidths.name + columnWidths.mrp + columnWidths.rate + 10, currentY + 5, { align: 'right' })
            .text(`₹${product.totalAmount.toFixed(2)}`, 40 + columnWidths.name + columnWidths.mrp + columnWidths.rate + columnWidths.qty + 10, currentY + 5, { align: 'right' });

        currentY += rowHeight;
    });

    return currentY;
}

function renderTotalSection(doc, order, startY) {
    const y = startY;
    const totalAmount = calculateTotalAmount(order);

    doc.strokeColor('#EEEEEE')
        .lineWidth(1)
        .moveTo(350, y)
        .lineTo(560, y)
        .stroke();

    doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#333333')
        .text('Subtotal', 350, y + 15)
        .font('DejaVuSans')
        .text(`₹${totalAmount.toFixed(2)}`, 480, y + 15);

    doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#333333')
        .text('Tax (0%)', 350, y + 35)
        .font('DejaVuSans')
        .text('₹0.00', 480, y + 35);

    doc.strokeColor('#DDDDDD')
        .lineWidth(1)
        .moveTo(350, y + 55)
        .lineTo(560, y + 55)
        .stroke();

    doc.font('Helvetica')
        .fontSize(12)
        .fillColor('#333333')
        .text('Total', 350, y + 70)
        .font('DejaVuSans')
        .text(`₹${totalAmount.toFixed(2)}`, 480, y + 70);

    doc.font('Helvetica')
        .fontSize(12)
        .fillColor('#333333')
        .text('Amount due', 350, y + 90)
        .font('DejaVuSans')
        .fontSize(14)
        .text(`₹${totalAmount.toFixed(2)}`, 480, y + 90);

    return y + 110;
}

function renderFooter(doc, logoPath) {
    const y = 680;

    doc.font('Helvetica-Oblique')
        .fontSize(24)
        .fillColor('#333333')
        .text('Signature', 100, y);

    doc.font('Helvetica-Bold')
        .fontSize(11)
        .fillColor('#333333')
        .text('Thank you for the business!', 100, y + 40);

    doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#666666')
        .text('Please pay within 15 days of receiving this invoice.', 100, y + 55);

    const bankDetailsX = 450;
    doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#333333')
        .text('Bank details', 500, y, { align: 'right' });

    doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#666666')
        .text('ABCD BANK', 500, y + 15, { align: 'right' })
        .text('ABCD000XXXX', 500, y + 30, { align: 'right' })
        .text('ABCDUSBBXXX', 500, y + 45, { align: 'right' })
        .text('37474892300011', 500, y + 60, { align: 'right' });

    doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#333333')
        .text('IFS code', 420, y + 30, { align: 'right' })
        .text('Swift code', 420, y + 45, { align: 'right' })
        .text('Account #', 420, y + 60, { align: 'right' });

    doc.fillColor('#F6F6F6')
        .roundedRect(40, y + 90, 520, 40, 5)
        .fill();

    if (fs.existsSync(logoPath)) {
        try {
            doc.image(logoPath, 60, y + 100, { width: 20 });
        } catch (error) {
            console.error('Error loading footer logo:', error);
        }
    }

    doc.font('Helvetica-Bold')
        .fontSize(12)
        .fillColor('#FF0066')
        .text('Durga Sai, Ent.', 100, y + 105);

    doc.font('Helvetica')
        .fontSize(10)
        .fillColor('#666666')
        .text('+91 92345 67897', 250, y + 105);

    doc.text('durgasaienterprises@email.com', 400, y + 105);
}

function calculateTotalAmount(order) {
    if (order.billing && typeof order.billing.orderAmount === 'number') {
        return order.billing.orderAmount;
    }

    if (order.productDetails && Array.isArray(order.productDetails)) {
        return order.productDetails.reduce((total, product) => {
            return total + (product.totalAmount || 0);
        }, 0);
    }

    return 0;
}

module.exports = router;