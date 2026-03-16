const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// GET all products (limited fields for main page)
router.get('/', async (req, res) => {
    console.log("Get All Products Request");
    try {
        const products = await Product.find()
            .select('productId productImage productName mrp rate');
        console.log(`Found ${products.length} products`);
        res.json(products);
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// SEARCH products (must be before /:productId route)
router.post('/search', async (req, res) => {
    console.log("Search Products Request - Query:", req.body.query);
    try {
        const { query } = req.body;
        if (!query) return res.status(400).json({ error: 'No search query provided' });
        const products = await Product.find({ $text: { $search: query } })
            .select('productId productImage productName mrp rate');
        console.log(`Search found ${products.length} products for query: "${query}"`);
        res.json(products);
    } catch (error) {
        console.error('Error searching products:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET specific product (full details)
router.get('/:productId', async (req, res) => {
    console.log("Get Product Request - ProductId:", req.params.productId);
    try {
        const product = await Product.findOne({ productId: req.params.productId });
        if (!product) {
            console.log("Product not found:", req.params.productId);
            return res.status(404).json({ error: 'Product not found' });
        }
        console.log("Product found:", product.productId);
        res.json(product);
    } catch (error) {
        console.error('Error fetching product:', error);
        res.status(500).json({ error: error.message });
    }
});

// ADD product
router.post('/', async (req, res) => {
    console.log("Add Product Request:", JSON.stringify(req.body, null, 2));
    try {
        if (!req.body.productName) {
            return res.status(400).json({ error: 'productName is required' });
        }

        const count = await Product.countDocuments();
        const namePart = (req.body.productName || 'Unnamed').replace(/\s+/g, '').toLowerCase();
        const productId = `${namePart}-${count + 1}`;

        const product = new Product({ ...req.body, productId });
        await product.save();

        console.log("Product created successfully:", productId);
        res.status(201).json({ success: 'Product added successfully', productId });
    } catch (error) {
        console.error('Error adding product:', error);
        res.status(500).json({ error: error.message });
    }
});

// UPDATE product
router.put('/:productId', async (req, res) => {
    console.log("Update Product Request - ProductId:", req.params.productId);
    console.log("Update Data:", JSON.stringify(req.body, null, 2));
    try {
        const product = await Product.findOneAndUpdate(
            { productId: req.params.productId },
            req.body,
            { new: true }
        );
        if (!product) {
            console.log("Product not found for update:", req.params.productId);
            return res.status(404).json({ error: 'Product not found' });
        }
        console.log("Product updated successfully:", req.params.productId);
        res.json({ success: 'Product updated successfully', product });
    } catch (error) {
        console.error('Error updating product:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE product
router.delete('/:productId', async (req, res) => {
    console.log("Delete Product Request - ProductId:", req.params.productId);
    try {
        const product = await Product.findOneAndDelete({ productId: req.params.productId });
        if (!product) {
            console.log("Product not found for deletion:", req.params.productId);
            return res.status(404).json({ error: 'Product not found' });
        }
        console.log("Product deleted successfully:", req.params.productId);
        res.json({ success: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;