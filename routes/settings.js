const express = require('express');
const router = express.Router();
const Joi = require('joi');
const Settings = require('../models/Settings');

// Validation schema for company details
const companySchema = Joi.object({
    name: Joi.string().optional(),
    contactUs: Joi.string().allow('', null).optional(),
    email: Joi.string().email().allow('', null).optional(),
    regNumber: Joi.string().allow('', null).optional(),
    address: Joi.string().allow('', null).optional(),
    city: Joi.string().allow('', null).optional(),
    state: Joi.string().allow('', null).optional(),
    pincode: Joi.string().allow('', null).optional()
});

// Validation schema for PIN (4 digits)
const pinSchema = Joi.object({
    pin: Joi.string().length(4).pattern(/^\d{4}$/).required()
        .messages({
            'string.length': 'PIN must be exactly 4 digits',
            'string.pattern.base': 'PIN must contain only numbers'
        })
});

// Validation schema for PIN update (4 digits)
const updatePinSchema = Joi.object({
    currentPin: Joi.string().length(4).pattern(/^\d{4}$/).required(),
    newPin: Joi.string().length(4).pattern(/^\d{4}$/).required()
});

// Helper function to get or create settings
const getOrCreateSettings = async () => {
    let settings = await Settings.findOne();
    if (!settings) {
        settings = new Settings();
        await settings.save();
        console.log('Created default settings');
    }
    return settings;
};

// ============================================
// COMPANY ENDPOINTS
// ============================================

// GET company details
router.get('/company', async (req, res) => {
    console.log('Get Company Details Request');
    try {
        const settings = await getOrCreateSettings();

        res.json({
            success: true,
            data: settings.company
        });
    } catch (error) {
        console.error('Error fetching company details:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST/UPDATE company details
router.post('/company', async (req, res) => {
    console.log('Update Company Details Request:', JSON.stringify(req.body, null, 2));
    try {
        const { error, value } = companySchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const settings = await getOrCreateSettings();

        // Update only provided fields
        Object.keys(value).forEach(key => {
            if (value[key] !== undefined) {
                settings.company[key] = value[key];
            }
        });

        await settings.save();

        res.json({
            success: true,
            message: 'Company details updated successfully',
            data: settings.company
        });
    } catch (error) {
        console.error('Error updating company details:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// PIN ENDPOINTS
// ============================================

// POST verify PIN
router.post('/verify-pin', async (req, res) => {
    console.log('Verify PIN Request');
    try {
        const { error, value } = pinSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const settings = await getOrCreateSettings();

        if (settings.appPin === value.pin) {
            res.json({
                success: true,
                message: 'PIN verified successfully'
            });
        } else {
            res.status(401).json({
                success: false,
                error: 'Invalid PIN'
            });
        }
    } catch (error) {
        console.error('Error verifying PIN:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST update PIN (requires current PIN)
router.post('/update-pin', async (req, res) => {
    console.log('Update PIN Request');
    try {
        const { error, value } = updatePinSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
        if (error) {
            const errors = error.details.map(err => err.message);
            return res.status(400).json({ error: 'Validation failed', details: errors });
        }

        const settings = await getOrCreateSettings();

        // Verify current PIN
        if (settings.appPin !== value.currentPin) {
            return res.status(401).json({
                success: false,
                error: 'Current PIN is incorrect'
            });
        }

        // Update PIN
        settings.appPin = value.newPin;
        await settings.save();

        res.json({
            success: true,
            message: 'PIN updated successfully'
        });
    } catch (error) {
        console.error('Error updating PIN:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
