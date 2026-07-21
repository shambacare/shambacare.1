const express = require('express');
const { User, Farm, Crop, Diagnosis, Disease, Subscription } = require('../models');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { sequelize } = require('../config/database');
const { sendEmail } = require('../utils/email');
const router = express.Router();

// ==================== PUBLIC ENDPOINTS ====================
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
        // Send welcome email
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
                    <a href="https://shambacare-1.vercel.app/login.html" style="background: #4ade80; color: #1e3a5f; padding: 10px; text-decoration: none;">Login Here</a>
                    <p>Keep your farmers safe and crops healthy!</p>
                </div>
            `
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

// ==================== PROTECTED ENDPOINTS (Token + Admin) ====================
router.use(verifyToken);
router.use(isAdmin);

// ==================== DASHBOARD STATISTICS ====================
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

        const [recentActivity] = await sequelize.query(`
            SELECT d.*, u.name as farmer_name, u.email as farmer_email
            FROM diagnoses d
            LEFT JOIN users u ON d.user_id = u.id
            ORDER BY d.created_at DESC
            LIMIT 10
        `);

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
        console.error('❌ Dashboard stats error:', error.stack);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== USERS ====================
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

// ==================== DIAGNOSES ====================
// FIXED: Use raw SQL to get diagnoses with farmer details reliably
router.get('/diagnoses/all', async (req, res) => {
    try {
        const [diagnoses] = await sequelize.query(`
            SELECT 
                d.id,
                d.user_id,
                d.image_url,
                d.crop_name,
                d.disease_name,
                d.confidence_score,
                d.status,
                d.created_at,
                d.organic_solution,
                d.chemical_solution,
                d.symptoms,
                d.prevention_tips,
                d.estimated_cost,
                u.name as farmer_name,
                u.email as farmer_email,
                u.phone as farmer_phone
            FROM diagnoses d
            LEFT JOIN users u ON d.user_id = u.id
            ORDER BY d.created_at DESC
        `);

        // Format to match frontend expected structure
        const formatted = diagnoses.map(d => ({
            id: d.id,
            user_id: d.user_id,
            image_url: d.image_url,
            crop_name: d.crop_name,
            disease_name: d.disease_name,
            confidence_score: d.confidence_score,
            status: d.status,
            created_at: d.created_at,
            organic_solution: d.organic_solution,
            chemical_solution: d.chemical_solution,
            symptoms: d.symptoms,
            prevention_tips: d.prevention_tips,
            estimated_cost: d.estimated_cost,
            farmer: {
                id: d.user_id,
                name: d.farmer_name || 'Unknown',
                email: d.farmer_email || '',
                phone: d.farmer_phone || ''
            }
        }));

        res.json({ success: true, diagnoses: formatted });
    } catch (error) {
        console.error('❌ Error fetching diagnoses:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== FARMS ====================
router.get('/farms/all', async (req, res) => {
    try {
        const farms = await Farm.findAll({
            include: [{ model: User, as: 'owner', attributes: ['id', 'name', 'email'] }]
        });
        res.json({ success: true, farms });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== CROPS ====================
router.get('/crops/all', async (req, res) => {
    try {
        const crops = await Crop.findAll({
            include: [
                { model: Farm, as: 'farm', include: [{ model: User, as: 'owner', attributes: ['name', 'email'] }] }
            ]
        });
        res.json({ success: true, crops });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== DISEASE LIBRARY ====================
router.get('/diseases', async (req, res) => {
    try {
        const diseases = await Disease.findAll({ order: [['name', 'ASC']] });
        res.json({ success: true, diseases });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/diseases', async (req, res) => {
    try {
        const disease = await Disease.create({ ...req.body, created_by: req.user.id });
        res.status(201).json({ success: true, disease });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

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

// ==================== ADD FARMER ====================
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
        // Send welcome email
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
                        <a href="https://shambacare-1.vercel.app/login.html" style="background: #4ade80; color: #1e3a5f; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Click Here to Login</a>
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

// ==================== SEND BROADCAST ALERT ====================
router.post('/send-alert', async (req, res) => {
    const { subject, message, type, region } = req.body;
    if (!subject || !message) {
        return res.status(400).json({ success: false, message: 'Subject and message required' });
    }
    try {
        const whereClause = { role: 'farmer' };
        if (region && region !== 'all') {
            whereClause.county = region;
        }
        console.log('🔍 Alert query whereClause:', JSON.stringify(whereClause));

        const farmers = await User.findAll({
            where: whereClause,
            attributes: ['id', 'email', 'name', 'county', 'is_active']
        });

        console.log(`📊 Found ${farmers.length} farmers matching query`);

        if (farmers.length === 0) {
            return res.json({
                success: false,
                message: 'No farmers found matching the criteria.',
                debug: {
                    whereClause,
                    regionReceived: region,
                    totalFarmers: await User.count({ where: { role: 'farmer' } }),
                    activeFarmers: await User.count({ where: { role: 'farmer', is_active: true } }),
                    sampleFarmers: await User.findAll({
                        where: { role: 'farmer' },
                        limit: 3,
                        attributes: ['id', 'email', 'county', 'is_active']
                    })
                }
            });
        }

        const activeFarmers = farmers.filter(f => f.is_active !== false);
        if (activeFarmers.length === 0) {
            return res.json({
                success: false,
                message: 'Found farmers but none are active (is_active = false).',
                debug: { totalFarmers: farmers.length, activeFarmers: 0 }
            });
        }

        let emailCount = 0, failedCount = 0;
        for (const farmer of activeFarmers) {
            const result = await sendEmail({
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
            if (result.success) emailCount++;
            else failedCount++;
        }

        res.json({
            success: true,
            message: `Alert sent to ${emailCount} farmers (${failedCount} failed)`,
            emailCount,
            failedCount,
            totalFarmers: activeFarmers.length
        });
    } catch (error) {
        console.error('Alert error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== DEBUG ROUTE ====================
router.get('/debug-farmers', async (req, res) => {
    try {
        const totalFarmers = await User.count({ where: { role: 'farmer' } });
        const activeFarmers = await User.count({ where: { role: 'farmer', is_active: true } });
        const allFarmers = await User.findAll({
            where: { role: 'farmer' },
            attributes: ['id', 'name', 'email', 'county', 'role', 'is_active']
        });
        res.json({ success: true, totalFarmers, activeFarmers, farmersList: allFarmers });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==================== CHATS (mock) ====================
router.get('/chats', async (req, res) => {
    res.json({ success: true, chats: [] });
});

// ==================== ADMIN REPLY TO CHAT (NO EMAIL) ====================
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
        // (Optional) Save the reply to a database table if you have one.
        // For now, just respond with success – no email is sent.
        res.json({ success: true, message: 'Reply recorded successfully' });
    } catch (error) {
        console.error('Reply chat error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
