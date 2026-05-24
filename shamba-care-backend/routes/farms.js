 const express = require('express');
const { Farm, Crop } = require('../models');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Get all farms for logged in user
router.get('/', verifyToken, async (req, res) => {
    try {
        const farms = await Farm.findAll({
            where: { user_id: req.user.id },
            include: [{ model: Crop, as: 'crops' }],
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, farms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get single farm by ID
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const farm = await Farm.findOne({
            where: { id: req.params.id, user_id: req.user.id },
            include: [{ model: Crop, as: 'crops' }]
        });
        
        if (!farm) {
            return res.status(404).json({ success: false, message: 'Farm not found' });
        }
        
        res.json({ success: true, farm });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create new farm
router.post('/', verifyToken, async (req, res) => {
    const { name, location, size_acres, main_crop, health_score } = req.body;
    
    if (!name || !location || !size_acres) {
        return res.status(400).json({ success: false, message: 'Name, location, and size are required' });
    }
    
    try {
        const farm = await Farm.create({
            user_id: req.user.id,
            name,
            location,
            size_acres,
            main_crop,
            health_score: health_score || 85
        });
        
        res.status(201).json({ success: true, farm });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update farm
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const farm = await Farm.findOne({
            where: { id: req.params.id, user_id: req.user.id }
        });
        
        if (!farm) {
            return res.status(404).json({ success: false, message: 'Farm not found' });
        }
        
        await farm.update(req.body);
        res.json({ success: true, farm });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete farm
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const farm = await Farm.findOne({
            where: { id: req.params.id, user_id: req.user.id }
        });
        
        if (!farm) {
            return res.status(404).json({ success: false, message: 'Farm not found' });
        }
        
        await farm.destroy();
        res.json({ success: true, message: 'Farm deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
