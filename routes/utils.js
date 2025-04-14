const express = require('express');
const router = express.Router();


// Single utility route
router.post('/', (req, res) => {
    const { task, inputs, input } = req.body;

    if (!task) {
        return res.status(400).json({ error: "Task is required" });
    }

    try {
        switch (task.toLowerCase()) {
            case 'add':
                if (!Array.isArray(inputs) || inputs.length < 2) {
                    return res.status(400).json({ error: "At least two values are required for addition" });
                }
                const sum = inputs.reduce((acc, val) => acc + convertToNumber(val), 0);
                return res.json({ result: sum });

            case 'multiply':
                if (!Array.isArray(inputs) || inputs.length < 2) {
                    return res.status(400).json({ error: "At least two values are required for multiplication" });
                }
                const product = inputs.reduce((acc, val) => acc * convertToNumber(val), 1);
                return res.json({ result: product });

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