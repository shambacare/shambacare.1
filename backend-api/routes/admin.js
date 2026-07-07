const express = require('express');
const { User, Farm, Crop, Diagnosis, Disease, Subscription } = require('../models');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { sequelize } = require('../config/database');
const router = express.Router();

// ==================== PUBLIC ENDPOINTS (No token required) ====================

// Create admin user (requires master key) - NO TOKEN NEEDED
router.post('/create-admin', async (req, res) => {
    const { name, email, phone, county, password, masterKey } = req.body;
    
    const MASTER_KEY = process.env.MASTER_KEY || 'ShambaCare_Master_Key_2024_Secure!';
    
    if (masterKey !== MASTER_KEY) {
        return res.status(403).json({ success: false, message: 'Invalid master key' });
    }
    
    if (!name || !email || !password) {
        return res.status(400).json({ success: false, message: 'Name, email, and password required' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    try {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        
        const user = await User.create({
            name,
            email,
            phone: phone || '+254700000000',
            county: county || 'Nairobi',
            password_hash: password,
            role: 'admin',
            email_verified: true,
            is_active: true
        });
        
        res.status(201).json({
            success: true,
            message: 'Admin user created successfully',
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                county: user.county,
                role: user.role
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ==================== PROTECTED ENDPOINTS (Token required + Admin only) ====================

// Apply authentication middleware for all routes below this line
router.use(verifyToken);
router.use(isAdmin);

// Get dashboard statistics
router.get('/dashboard/stats', async (req, res) => {
    try {
        const totalFarmers = await User.count({ where: { role: 'farmer' } });
        const totalAdmins = await User.count({ where: { role: 'admin' } });
        const totalFarms = await Farm.count();
        const totalCrops = await Crop.count();
        const totalDiagnoses = await Diagnosis.count();
        const pendingDiagnoses = await Diagnosis.count({ where: { status: 'Pending' } });
        const reviewedDiagnoses = await Diagnosis.count({ where: { status: 'Reviewed' } });
        const resolvedDiagnoses = await Diagnosis.count({ where: { status: 'Resolved' } });
        
        const recentActivity = await Diagnosis.findAll({
            limit: 10,
            order: [['created_at', 'DESC']],
            include: [{ 
                model: User, 
                as: 'farmer',
                attributes: ['name', 'email']
            }]
        });
        
        res.json({
            success: true,
            stats: {
                totalFarmers,
                totalAdmins,
                totalFarms,
                totalCrops,
                totalDiagnoses,
                pendingDiagnoses,
                reviewedDiagnoses,
                resolvedDiagnoses
            },
            recentActivity
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all users
router.get('/users', async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: { exclude: ['password_hash'] },
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get a single user by ID
router.get('/users/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id, {
            attributes: { exclude: ['password_hash'] },
            include: [
                { model: Farm, as: 'farms' },
                { model: Diagnosis, as: 'diagnoses' }
            ]
        });
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        res.json({ success: true, user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update user
router.put('/users/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        const { name, email, phone, county, role, is_active } = req.body;
        await user.update({ name, email, phone, county, role, is_active });
        
        res.json({ success: true, message: 'User updated successfully', user });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
    try {
        const user = await User.findByPk(req.params.id);
        
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        await user.destroy();
        res.json({ success: true, message: 'User deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all diagnoses
router.get('/diagnoses/all', async (req, res) => {
    try {
        const diagnoses = await Diagnosis.findAll({
            order: [['created_at', 'DESC']],
            include: [{ 
                model: User, 
                as: 'farmer',
                attributes: ['id', 'name', 'email', 'phone']
            }]
        });
        res.json({ success: true, diagnoses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all farms
router.get('/farms/all', async (req, res) => {
    try {
        const farms = await Farm.findAll({
            include: [{ 
                model: User, 
                as: 'owner',
                attributes: ['id', 'name', 'email']
            }]
        });
        res.json({ success: true, farms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all crops
router.get('/crops/all', async (req, res) => {
    try {
        const crops = await Crop.findAll({
            include: [
                { 
                    model: Farm, 
                    as: 'farm',
                    include: [{ model: User, as: 'owner', attributes: ['name', 'email'] }]
                }
            ]
        });
        res.json({ success: true, crops });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get disease library
router.get('/diseases', async (req, res) => {
    try {
        const diseases = await Disease.findAll({
            order: [['name', 'ASC']]
        });
        res.json({ success: true, diseases });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create/Update disease
router.post('/diseases', async (req, res) => {
    try {
        const disease = await Disease.create({
            ...req.body,
            created_by: req.user.id
        });
        res.status(201).json({ success: true, disease });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete disease
router.delete('/diseases/:id', async (req, res) => {
    try {
        const disease = await Disease.findByPk(req.params.id);
        if (!disease) {
            return res.status(404).json({ success: false, message: 'Disease not found' });
        }
        await disease.destroy();
        res.json({ success: true, message: 'Disease deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;