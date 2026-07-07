 const express = require('express');
const { Crop, Farm } = require('../models');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// Get all crops for user's farms
router.get('/', verifyToken, async (req, res) => {
    try {
        const farms = await Farm.findAll({
            where: { user_id: req.user.id },
            attributes: ['id']
        });
        
        const farmIds = farms.map(f => f.id);
        
        const crops = await Crop.findAll({
            where: { farm_id: farmIds },
            include: [{ model: Farm, as: 'farm' }],
            order: [['created_at', 'DESC']]
        });
        
        res.json({ success: true, crops });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get crops for a specific farm
router.get('/farm/:farmId', verifyToken, async (req, res) => {
    try {
        const farm = await Farm.findOne({
            where: { id: req.params.farmId, user_id: req.user.id }
        });
        
        if (!farm) {
            return res.status(404).json({ success: false, message: 'Farm not found' });
        }
        
        const crops = await Crop.findAll({
            where: { farm_id: req.params.farmId },
            order: [['created_at', 'DESC']]
        });
        
        res.json({ success: true, crops });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create new crop
router.post('/', verifyToken, async (req, res) => {
    const { farm_id, name, variety, planting_date, stage, health_score, status, notes } = req.body;
    
    if (!farm_id || !name) {
        return res.status(400).json({ success: false, message: 'Farm ID and crop name are required' });
    }
    
    try {
        // Verify farm belongs to user
        const farm = await Farm.findOne({
            where: { id: farm_id, user_id: req.user.id }
        });
        
        if (!farm) {
            return res.status(404).json({ success: false, message: 'Farm not found' });
        }
        
        const crop = await Crop.create({
            farm_id,
            name,
            variety,
            planting_date,
            stage: stage || 'Vegetative',
            health_score: health_score || 85,
            status: status || 'Good',
            notes
        });
        
        res.status(201).json({ success: true, crop });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update crop
router.put('/:id', verifyToken, async (req, res) => {
    try {
        const crop = await Crop.findByPk(req.params.id, {
            include: [{ model: Farm, as: 'farm' }]
        });
        
        if (!crop) {
            return res.status(404).json({ success: false, message: 'Crop not found' });
        }
        
        if (crop.farm.user_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        await crop.update(req.body);
        res.json({ success: true, crop });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete crop
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const crop = await Crop.findByPk(req.params.id, {
            include: [{ model: Farm, as: 'farm' }]
        });
        
        if (!crop) {
            return res.status(404).json({ success: false, message: 'Crop not found' });
        }
        
        if (crop.farm.user_id !== req.user.id) {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        
        await crop.destroy();
        res.json({ success: true, message: 'Crop deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;
