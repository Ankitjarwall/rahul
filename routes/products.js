const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET all products (limited fields for main page)
router.get('/', async (req, res) => {
    try {
        const products = await Product.find()
            .select('productImage productName mrp rate');
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET specific product (full details)
router.get('/:productId', async (req, res) => {
    try {
        const product = await Product.findOne({ productId: req.params.productId });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ADD product
router.post('/', async (req, res) => {
    try {
        const count = await Product.countDocuments();
        const productId = String(count + 1);
        const product = new Product({ ...req.body, productId });
        await product.save();
        res.status(201).json({ success: 'Product added successfully', productId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE product
router.put('/:productId', async (req, res) => {
    try {
        const product = await Product.findOneAndUpdate(
            { productId: req.params.productId },
            req.body,
            { new: true }
        );
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: 'Product updated successfully', product });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE product
router.delete('/:productId', async (req, res) => {
    try {
        const product = await Product.findOneAndDelete({ productId: req.params.productId });
        if (!product) return res.status(404).json({ error: 'Product not found' });
        res.json({ success: 'Product deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// SEARCH products
router.post('/search', async (req, res) => {
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'No search query provided' });
        const products = await Product.find({ $text: { $search: query } })
            .select('productImage productName mrp rate');
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;