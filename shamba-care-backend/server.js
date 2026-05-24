const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { sequelize, connectDB } = require('./config/database');
const { User, Farm, Crop, Diagnosis, Disease } = require('./models');
const { verifyToken, isAdmin } = require('./middleware/auth');

const app = express();
app.set('trust proxy', 1);  // trust ngrok as proxy (fixes rate-limiter warning)

const PORT = process.env.PORT || 5000;

// ==================== MIDDLEWARE ====================
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== CORS CONFIGURATION ====================
// Base allowed origins
let allowedOrigins = [
    'http://localhost:5500',
    'http://127.0.0.1:5500',
    'https://shambacare.github.io',        // your GitHub Pages frontend
    'http://localhost:5001'                // local AI service (if needed)
];

// Also add any origins from FRONTEND_URL environment variable (comma-separated)
if (process.env.FRONTEND_URL) {
    const envOrigins = process.env.FRONTEND_URL.split(',');
    allowedOrigins.push(...envOrigins);
}

// Remove duplicates
const uniqueOrigins = [...new Set(allowedOrigins)];

// CORS middleware with logging
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps, curl, Postman)
        if (!origin) return callback(null, true);
        
        if (uniqueOrigins.includes(origin)) {
            console.log(`✅ CORS allowed: ${origin}`);
            callback(null, true);
        } else {
            console.warn(`❌ CORS blocked: ${origin}`);
            console.warn(`   Allowed origins: ${uniqueOrigins.join(', ')}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Explicitly handle preflight OPTIONS requests
app.options('*', cors());

// ==================== RATE LIMITING ====================
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        success: true, 
        message: 'ShambaCare API is running', 
        timestamp: new Date(),
        environment: process.env.NODE_ENV,
        endpoints: {
            auth: '/api/auth',
            farms: '/api/farms',
            crops: '/api/crops',
            diagnoses: '/api/diagnoses',
            subscriptions: '/api/subscriptions'
        }
    });
});

// ==================== PUBLIC ROUTES ====================
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const adminRoutes = require('./routes/admin');
app.use('/api/admin', adminRoutes);

const subscriptionRoutes = require('./routes/subscriptions');
app.use('/api/subscriptions', subscriptionRoutes);

// Public disease library routes
app.get('/api/diseases', async (req, res) => {
    try {
        const diseases = await Disease.findAll({
            attributes: ['id', 'name', 'crop_type', 'description', 'symptoms', 'organic_solution', 'chemical_solution', 'prevention_tips', 'severity']
        });
        res.json({ success: true, diseases });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.get('/api/diseases/:crop', async (req, res) => {
    try {
        const diseases = await Disease.findAll({
            where: { crop_type: req.params.crop },
            attributes: ['id', 'name', 'description', 'symptoms', 'organic_solution', 'chemical_solution', 'prevention_tips']
        });
        res.json({ success: true, diseases });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== PROTECTED ROUTES ====================
const farmRoutes = require('./routes/farms');
app.use('/api/farms', verifyToken, farmRoutes);

const communicationsRoutes = require('./routes/communications');
app.use('/api/communications', verifyToken, communicationsRoutes);

const farmGuideRoutes = require('./routes/farm-guide');
app.use('/api/farm-guide', verifyToken, farmGuideRoutes);

const cropRoutes = require('./routes/crops');
app.use('/api/crops', verifyToken, cropRoutes);

const diagnosisRoutes = require('./routes/diagnoses');
app.use('/api/diagnoses', verifyToken, diagnosisRoutes);

const smsRoutes = require('./routes/sms');
app.use('/api/sms', verifyToken, smsRoutes);

// User profile routes
app.get('/api/users/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password'] }
        });
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.put('/api/users/profile', verifyToken, async (req, res) => {
    try {
        const { name, phone, county } = req.body;
        const user = await User.findByPk(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        await user.update({ name, phone, county });
        const { password, ...userWithoutPassword } = user.toJSON();
        res.json({ success: true, user: userWithoutPassword });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Dashboard stats for farmers
app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
    try {
        const farms = await Farm.findAll({ where: { user_id: req.user.id } });
        const crops = await Crop.findAll({ where: { user_id: req.user.id } });
        const diagnoses = await Diagnosis.findAll({ 
            where: { user_id: req.user.id },
            limit: 5,
            order: [['created_at', 'DESC']]
        });
        
        res.json({
            success: true,
            stats: {
                totalFarms: farms.length,
                totalCrops: crops.length,
                totalDiagnoses: diagnoses.length,
                avgHealth: crops.reduce((sum, c) => sum + (c.health_score || 85), 0) / crops.length || 85
            },
            recentDiagnoses: diagnoses
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== ERROR HANDLING ====================
app.use((req, res) => {
    res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error'
    });
});

// ==================== START SERVER ====================
const startServer = async () => {
    try {
        await connectDB();
        await sequelize.sync({ alter: false });
        console.log('✅ Database models synchronized');
        
        app.listen(PORT, () => {
            console.log(`🚀 ShambaCare Backend running on port ${PORT}`);
            console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 API URL: http://localhost:${PORT}`);
            console.log(`📡 CORS allowed origins:`, uniqueOrigins);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

module.exports = app;