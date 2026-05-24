const express = require('express');
const { User, Farm, Crop, Diagnosis, Disease, Subscription } = require('../models');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { sequelize } = require('../config/database');
const { sendEmail } = require('../utils/email');
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
        
        // Send welcome email to new admin
        try {
            await sendEmail({
                to: email,
                subject: 'Welcome to ShambaCare Admin Panel! 🌾',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px;">
                        <h2 style="color: #1e3a5f;">Welcome ${name}!</h2>
                        <p>You have been granted Admin access to ShambaCare.</p>
                        <p><strong>Login Credentials:</strong></p>
                        <ul>
                            <li>Email: ${email}</li>
                            <li>Password: [the password you set]</li>
                        </ul>
                        <a href="http://localhost:5500/login.html" style="background: #4ade80; color: #1e3a5f; padding: 10px; text-decoration: none;">Login Here</a>
                        <p>Keep your farmers safe and crops healthy!</p>
                    </div>
                `
            });
        } catch (emailError) {
            console.log('Welcome email not sent:', emailError.message);
        }
        
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

// ==================== ADD NEW FARMER (by Admin) ====================
router.post('/add-farmer', async (req, res) => {
    const { name, email, phone, county, password } = req.body;
    
    if (!name || !email || !phone || !county || !password) {
        return res.status(400).json({ success: false, message: 'All fields are required' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    try {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered' });
        }
        
        const farmer = await User.create({
            name,
            email,
            phone,
            county,
            password_hash: password,
            role: 'farmer',
            email_verified: true,
            is_active: true
        });
        
        // Send welcome email to new farmer
        try {
            await sendEmail({
                to: email,
                subject: 'Welcome to ShambaCare! 🌾',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px;">
                        <div style="background: #1e3a5f; padding: 20px; text-align: center;">
                            <h2 style="color: #4ade80;">ShambaCare</h2>
                        </div>
                        <div style="padding: 20px;">
                            <h2>Hello ${name}!</h2>
                            <p>Welcome to ShambaCare - your smart farming assistant!</p>
                            <p>An admin has created an account for you.</p>
                            <h3>Your Login Details:</h3>
                            <ul>
                                <li><strong>Email:</strong> ${email}</li>
                                <li><strong>Password:</strong> ${password}</li>
                            </ul>
                            <a href="http://localhost:5500/login.html" style="background: #4ade80; color: #1e3a5f; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Click Here to Login</a>
                            <hr>
                            <p>Once logged in, you can:</p>
                            <ul>
                                <li>📸 Take photos of your crops for AI diagnosis</li>
                                <li>📊 Track your farm's health</li>
                                <li>🌦️ Receive weather alerts</li>
                                <li>💬 Get support from our team</li>
                            </ul>
                            <p>Happy farming! 🌱</p>
                            <p>- ShambaCare Team</p>
                        </div>
                    </div>
                `
            });
            console.log(`✅ Welcome email sent to ${email}`);
        } catch (emailError) {
            console.log('Welcome email not sent:', emailError.message);
        }
        
        res.status(201).json({
            success: true,
            message: 'Farmer added successfully',
            user: {
                id: farmer.id,
                name: farmer.name,
                email: farmer.email,
                phone: farmer.phone,
                county: farmer.county,
                role: farmer.role
            }
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ==================== SEND BROADCAST ALERT (Email) ====================
router.post('/send-alert', async (req, res) => {
    const { subject, message, type, region } = req.body;
    
    if (!subject || !message) {
        return res.status(400).json({ success: false, message: 'Subject and message required' });
    }
    
    try {
        // Get farmers in the selected region
        const whereClause = { role: 'farmer' };
        if (region && region !== 'all') {
            whereClause.county = region;
        }
        
        const farmers = await User.findAll({ where: whereClause });
        
        if (farmers.length === 0) {
            return res.json({ success: true, message: 'No farmers found in this region' });
        }
        
        // Send EMAILS to all farmers
        let emailCount = 0;
        let failedCount = 0;
        
        for (const farmer of farmers) {
            const emailSent = await sendEmail({
                to: farmer.email,
                subject: `🌾 ShambaCare Alert: ${subject}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <div style="background: #1e3a5f; padding: 20px; text-align: center;">
                            <h2 style="color: #4ade80; margin: 0;">ShambaCare Alert</h2>
                        </div>
                        <div style="background: #f9fafb; padding: 20px;">
                            <h3 style="color: #1e293b;">${subject}</h3>
                            <p style="color: #334155; font-size: 16px; line-height: 1.5;">${message}</p>
                            <hr style="border-color: #e5e7eb;">
                            <p style="color: #6b7280; font-size: 12px;">Alert Type: ${type || 'General'}</p>
                            <p style="color: #6b7280; font-size: 12px;">Region: ${region === 'all' ? 'All Counties' : region}</p>
                        </div>
                        <div style="background: #1e3a5f; padding: 10px; text-align: center;">
                            <p style="color: #94a3b8; font-size: 12px;">ShambaCare - Smart Farming Assistant</p>
                        </div>
                    </div>
                `
            });
            if (emailSent.success) {
                emailCount++;
            } else {
                failedCount++;
            }
        }
        
        res.json({ 
            success: true, 
            message: `Alert sent to ${emailCount} farmers via email (${failedCount} failed)`,
            emailCount: emailCount,
            failedCount: failedCount,
            totalFarmers: farmers.length
        });
        
    } catch (error) {
        console.error('Alert error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all chats for admin
router.get('/chats', async (req, res) => {
    try {
        // This would typically fetch from a database
        // For now, return mock data
        res.json({ success: true, chats: [] });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin reply to farmer chat (sends email)
router.post('/reply-chat', async (req, res) => {
    const { farmer_id, message, subject } = req.body;
    
    if (!farmer_id || !message) {
        return res.status(400).json({ success: false, message: 'Farmer ID and message required' });
    }
    
    try {
        const farmer = await User.findByPk(farmer_id);
        if (!farmer) {
            return res.status(404).json({ success: false, message: 'Farmer not found' });
        }
        
        await sendEmail({
            to: farmer.email,
            subject: subject || 'New Reply from ShambaCare Support',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                    <div style="background: #1e3a5f; padding: 20px; text-align: center;">
                        <h2 style="color: #4ade80;">ShambaCare Support</h2>
                    </div>
                    <div style="padding: 20px;">
                        <p>Hello ${farmer.name},</p>
                        <p>You have a new reply from our support team:</p>
                        <div style="background: #f0fdf4; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <p style="margin: 0;">"${message}"</p>
                        </div>
                        <a href="http://localhost:5500/chat.html" style="background: #4ade80; color: #1e3a5f; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Conversation</a>
                        <hr>
                        <p style="font-size: 12px;">ShambaCare - Smart Farming Assistant</p>
                    </div>
                </div>
            `
        });
        
        res.json({ success: true, message: 'Reply sent via email' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;