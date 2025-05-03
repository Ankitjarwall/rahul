const express = require('express');
const router = express.Router();

// Single utility route
router.post('/', (req, res) => {
    const { task, input_1, input_2, input } = req.body;

    if (!task) {
        return res.status(400).json({ error: "Task is required" });
    }

    try {
        switch (task.toLowerCase()) {
            case 'add':
                if (input_1 === undefined || input_2 === undefined) {
                    return res.status(400).json({ error: "Two inputs are required for addition" });
                }
                const sum = convertToNumber(input_1) + convertToNumber(input_2);
                return res.json({ result: sum });

            case 'multiply':
                if (input_1 === undefined || input_2 === undefined) {
                    return res.status(400).json({ error: "Two inputs are required for multiplication" });
                }
                const product = convertToNumber(input_1) * convertToNumber(input_2);
                return res.json({ result: Number(product.toFixed(2)) });

            case 'convert':
                if (input === undefined || input === null) {
                    return res.status(400).json({ error: "A value is required for conversion" });
                }
                const convertedValue = convertToNumber(input);
                return res.json({ convertedValue });

            default:
                return res.status(400).json({ error: "Invalid task. Use 'add', 'multiply', or 'convert'" });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

function convertToNumber(value) {
    const num = parseFloat(value);
    if (isNaN(num)) {
        throw new Error("Invalid number input");
    }
    return num;
}

module.exports = router;