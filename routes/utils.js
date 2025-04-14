const express = require('express');
const router = express.Router();

// Function to convert a string to a number
const convertToNumber = (value) => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        const number = parseFloat(value.replace(/,/g, ''));
        return isNaN(number) ? 0 : number;
    }
    return 0;
};

// Single utility route
router.post('/', (req, res) => {
    const { task, inputs } = req.body;

    if (!task || !inputs) {
        return res.status(400).json({ error: "Task and inputs are required" });
    }

    try {
        switch (task.toLowerCase()) {
            case 'add':
                if (!Array.isArray(inputs) || inputs.length < 2) {
                    return res.status(400).json({ error: "At least two values are required for addition" });
                }
                const sum = inputs.reduce((acc, val) => acc + convertToNumber(val), 0);
                res.json({ result: sum });
                break;

            case 'multiply':
                if (!Array.isArray(inputs) || inputs.length < 2) {
                    return res.status(400).json({ error: "At least two values are required for multiplication" });
                }
                const product = inputs.reduce((acc, val) => acc * convertToNumber(val), 1);
                res.json({ result: product });
                break;

            case 'convert':
                if (input === undefined || input === null) {
                    return res.status(400).json({ error: "A value is required for conversion" });
                }
                const convertedValue = convertToNumber(input);
                return res.json({ convertedValue });

            default:
                res.status(400).json({ error: "Invalid task. Use 'add', 'multiply', or 'convert'" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;