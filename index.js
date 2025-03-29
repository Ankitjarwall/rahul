const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

const ORDER = require('./models/ORDER');
const USER = require('./models/USER');
const PRODUCT = require('./models/PRODUCT');

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error(err));

// Helper function to generate ORDER_ID
const GENERATE_ORDER_ID = async () => {
    const NOW = new Date();
    const DAY = ("0" + NOW.getDate()).slice(-2);
    const MONTH = ("0" + (NOW.getMonth() + 1)).slice(-2);
    const YEAR = NOW.getFullYear();
    const DATE_PREFIX = `${DAY}${MONTH}${YEAR}`;

    const ORDER_COUNT = await ORDER.countDocuments({ ORDER_ID: new RegExp(`^${DATE_PREFIX}`) });
    const UNIQUE_NUMBER = ORDER_COUNT + 1;
    return `${DATE_PREFIX}OR${UNIQUE_NUMBER}`;
};

// Helper function to generate USER_ID
const GENERATE_USER_ID = async (USER_DATA) => {
    const STATE = (USER_DATA.STATE || "NA").toUpperCase().slice(0, 2);
    const PINCODE = USER_DATA.PINCODE || USER_DATA.TOWN || "000000";
    const USERNAME = (USER_DATA.USERNAME || USER_DATA.SHOP_NAME || "Unknown").replace(/\s+/g, "");

    const USER_COUNT = await USER.countDocuments({ USER_ID: new RegExp(`^${STATE}${PINCODE}${USERNAME}`) });
    const UNIQUE_NUMBER = ("0" + (USER_COUNT + 1)).slice(-2);
    return `${STATE}${PINCODE}${USERNAME}${UNIQUE_NUMBER}`;
};

// Helper function to generate PRODUCT_ID
const GENERATE_PRODUCT_ID = async () => {
    const LAST_PRODUCT = await PRODUCT.findOne().sort({ PRODUCT_ID: -1 });
    const LAST_ID = LAST_PRODUCT ? parseInt(LAST_PRODUCT.PRODUCT_ID) || 0 : 0;
    return (LAST_ID + 1).toString();
};

// Routes
app.get('/api', async (req, res) => {
    const ACTION = req.query.ACTION;
    const DATA = req.query.DATA ? JSON.parse(req.query.DATA) : {};

    if (!ACTION) return res.json({ ERROR: "No action provided" });

    try {
        switch (ACTION) {
            case "getOrders": return res.json(await ORDER.find());
            case "addOrder": {
                const ORDER_ID = await GENERATE_ORDER_ID();
                const NEW_ORDER = new ORDER({ ORDER_ID, ...DATA });
                await NEW_ORDER.save();
                return res.json({ SUCCESS: "Order added successfully", ORDER_ID });
            }
            case "updateOrder": {
                if (!DATA.ORDER_ID) return res.json({ ERROR: "orderId missing" });
                await ORDER.updateOne({ ORDER_ID: DATA.ORDER_ID }, { $set: DATA });
                return res.json({ SUCCESS: "Order updated successfully" });
            }
            case "getUsers": return res.json(await USER.find());
            case "addUsers": {
                const USER_ID = await GENERATE_USER_ID(DATA);
                const NEW_USER = new USER({ USER_ID, ...DATA });
                await NEW_USER.save();
                return res.json({ SUCCESS: "User added successfully", USER_ID });
            }
            case "updateUsers": {
                if (!DATA.USER_ID) return res.json({ ERROR: "userId missing" });
                await USER.updateOne({ USER_ID: DATA.USER_ID }, { $set: DATA });
                return res.json({ SUCCESS: "User updated successfully" });
            }
            case "getProducts": return res.json(await PRODUCT.find());
            case "addProduct": {
                const PRODUCT_ID = await GENERATE_PRODUCT_ID();
                const NEW_PRODUCT = new PRODUCT({ PRODUCT_ID, ...DATA });
                await NEW_PRODUCT.save();
                return res.json({ SUCCESS: "Product added successfully", PRODUCT_ID });
            }
            case "updateProduct": {
                if (!DATA.PRODUCT_ID) return res.json({ ERROR: "productId missing" });
                await PRODUCT.updateOne({ PRODUCT_ID: DATA.PRODUCT_ID }, { $set: DATA });
                return res.json({ SUCCESS: "Product updated successfully" });
            }
            case "searchOrders": {
                if (!DATA.QUERY) return res.json({ ERROR: "No search query provided" });
                const RESULTS = await ORDER.find({ $text: { $search: DATA.QUERY } });
                return res.json(RESULTS);
            }
            case "searchUsers": {
                if (!DATA.QUERY) return res.json({ ERROR: "No search query provided" });
                const RESULTS = await USER.find({ $text: { $search: DATA.QUERY } });
                return res.json(RESULTS);
            }
            case "searchProducts": {
                if (!DATA.QUERY) return res.json({ ERROR: "No search query provided" });
                const RESULTS = await PRODUCT.find({ $text: { $search: DATA.QUERY } });
                return res.json(RESULTS);
            }
            default: return res.json({ ERROR: "Invalid action" });
        }
    } catch (ERROR) {
        res.json({ ERROR: ERROR.message });
    }
});

app.post('/api', async (req, res) => {
    const { ACTION, DATA } = req.body;
    req.query.ACTION = ACTION;
    req.query.DATA = JSON.stringify(DATA);
    return app._router.handle(req, res); // Reuse GET logic for POST
});

module.exports = app;