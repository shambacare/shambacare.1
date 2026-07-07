const express = require('express');
const { sendSMS, sendBulkSMS, sendWeatherAlert, sendDiseaseAlert, sendFarmingTip, sendSubscriptionReminder } = require('../services/smsService');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { User, Alert } = require('../models');
const router = express.Router();


// Send single SMS (Admin only)
router.post('/send', verifyToken, isAdmin, async (req, res) => {
    const { phoneNumber, message } = req.body;
    
    if (!phoneNumber || !message) {
        return res.status(400).json({ success: false, message: 'Phone number and message are required' });
    }
    
    try {
        const result = await sendSMS(phoneNumber, message);
        
        // Save alert to database
        await Alert.create({
            type: 'tip',
            subject: 'Direct SMS',
            message: message,
            target_region: 'individual',
            sent_by: req.user.id,
            is_broadcast: false
        });
        
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to send SMS' });
    }
});

// Send bulk SMS to all farmers (Admin only)
router.post('/send-bulk', verifyToken, isAdmin, async (req, res) => {
    const { message, region } = req.body;
    
    if (!message) {
        return res.status(400).json({ success: false, message: 'Message is required' });
    }
    
    try {
        const whereClause = { role: 'farmer', is_active: true };
        if (region && region !== 'all') {
            whereClause.county = region;
        }
        
        const farmers = await User.findAll({
            where: whereClause,
            attributes: ['phone']
        });
        
        if (farmers.length === 0) {
            return res.status(404).json({ success: false, message: 'No farmers found' });
        }
        
        const phoneNumbers = farmers.map(f => f.phone);
        const result = await sendBulkSMS(phoneNumbers, message);
        
        // Save alert to database
        await Alert.create({
            type: 'tip',
            subject: 'Bulk Broadcast',
            message: message,
            target_region: region || 'all',
            sent_by: req.user.id,
            is_broadcast: true
        });
        
        res.json({ 
            success: true, 
            message: `SMS sent to ${farmers.length} farmers`,
            count: farmers.length,
            result 
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to send bulk SMS' });
    }
});

// Send weather alert (Admin only)
router.post('/weather-alert', verifyToken, isAdmin, async (req, res) => {
    const { county, subject, message } = req.body;
    
    if (!county || !subject || !message) {
        return res.status(400).json({ success: false, message: 'County, subject, and message are required' });
    }
    
    try {
        const result = await sendWeatherAlert(county, { subject, message });
        
        // Save alert to database
        await Alert.create({
            type: 'weather',
            subject: subject,
            message: message,
            target_region: county,
            sent_by: req.user.id,
            is_broadcast: true
        });
        
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to send weather alert' });
    }
});

// Send disease outbreak alert (Admin only)
router.post('/disease-alert', verifyToken, isAdmin, async (req, res) => {
    const { crop, disease, region, message } = req.body;
    
    if (!crop || !disease || !message) {
        return res.status(400).json({ success: false, message: 'Crop, disease, and message are required' });
    }
    
    try {
        const result = await sendDiseaseAlert(crop, disease, region || 'all', message);
        
        // Save alert to database
        await Alert.create({
            type: 'disease',
            subject: `${disease} Outbreak Alert`,
            message: `${crop} crops: ${message}`,
            target_region: region || 'all',
            sent_by: req.user.id,
            is_broadcast: true
        });
        
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to send disease alert' });
    }
});

// Send farming tip to specific farmer (Admin only)
router.post('/farming-tip', verifyToken, isAdmin, async (req, res) => {
    const { phoneNumber, tip } = req.body;
    
    if (!phoneNumber || !tip) {
        return res.status(400).json({ success: false, message: 'Phone number and tip are required' });
    }
    
    try {
        const result = await sendFarmingTip(phoneNumber, tip);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to send farming tip' });
    }
});

// Test SMS (for debugging)
router.post('/test', verifyToken, isAdmin, async (req, res) => {
    const { phoneNumber } = req.body;
    
    if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    
    try {
        const result = await sendSMS(phoneNumber, 'This is a test message from ShambaCare. Your SMS integration is working!');
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Test SMS failed' });
    }
});

module.exports = router;