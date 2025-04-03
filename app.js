const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const apiRoutes = require('./routes/api');
const cors = require('cors');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB Connection Error:", err));

// Routes
app.use('/users', userRoutes); s
app.use('/orders', orderRoutes);
app.use('/products', productRoutes);

// Root Route
app.get('/', (req, res) => {
    res.send("Welcome to the API");
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
