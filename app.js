const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/api');

dotenv.config();

const app = express();
app.use(express.json());

// Root route
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Response from backend' });
});

// MongoDB connection function
const connectToMongo = async () => {
    if (mongoose.connection.readyState === 0) { // Not connected
        await mongoose.connect(process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log('MongoDB connected');
    }
};

// Middleware to ensure MongoDB connection for each request
app.use(async (req, res, next) => {
    try {
        await connectToMongo();
        next();
    } catch (err) {
        console.error('MongoDB connection error:', err);
        res.status(500).json({ error: 'Database connection failed' });
    }
});

app.use('/api', apiRoutes);

module.exports = app;