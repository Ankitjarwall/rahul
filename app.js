const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const utilsRoutes = require('./routes/utils');
const userHistoryRoutes = require('./routes/userHistory');
const productHistoryRoutes = require('./routes/productHistory'); // Added product history routes
const globalSearchRouter = require('./routes/globalSearch');

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB Connection Error:", err));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/utils', utilsRoutes);
app.use('/api/user-history', userHistoryRoutes);
app.use('/api/product-history', productHistoryRoutes); // Added product history routes
app.use('/api/search', globalSearchRouter);

// Root Route
app.get('/', (req, res) => {
    res.send("Welcome to the API");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
});

module.exports = app;