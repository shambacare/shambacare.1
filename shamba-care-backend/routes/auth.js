const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'shambacare_super_secret_key_2024';

// Determine frontend URL for reset links (use environment variable, fallback to localhost)
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

// Email transporter (will fail on Render free tier due to port blocking, but kept for local use)
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

const generateToken = (userId) => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
};

// ==================== SIGNUP ====================
router.post('/signup', async (req, res) => {
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
        const user = await User.create({ 
            name, 
            email, 
            phone, 
            county, 
            password_hash: password,
            role: 'farmer'
        });
        const token = generateToken(user.id);
        await user.update({ last_login: new Date() });
        res.status(201).json({ 
            success: true, 
            message: 'Account created successfully', 
            token, 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                phone: user.phone, 
                county: user.county, 
                role: user.role,
                allowFarmerPortal: user.role === 'admin'
            } 
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        if (!user.is_active) return res.status(401).json({ success: false, message: 'Account is deactivated' });
        
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        
        const token = generateToken(user.id);
        await user.update({ last_login: new Date() });
        
        res.json({ 
            success: true, 
            message: 'Login successful', 
            token, 
            user: { 
                id: user.id, 
                name: user.name, 
                email: user.email, 
                phone: user.phone, 
                county: user.county, 
                role: user.role,
                allowFarmerPortal: user.role === 'admin'
            } 
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== LOGOUT ====================
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// ==================== FORGOT PASSWORD ====================
router.post('/forgot-password', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required' });
    }
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            // Return same message for security (don't reveal if email exists)
            return res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
        }
        
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000);
        
        const { sequelize } = require('../config/database');
        await sequelize.query(
            `UPDATE "users" SET reset_token = :token, reset_expires = :expires WHERE email = :email`,
            {
                replacements: { token: resetToken, expires: resetExpires, email: email },
                type: sequelize.QueryTypes.UPDATE
            }
        );
        
        // Build reset URL dynamically using FRONTEND_URL
        const resetUrl = `${FRONTEND_URL}/reset-password.html?token=${resetToken}`;
        console.log(`🔐 Reset link: ${resetUrl}`);
        
        // Attempt to send email
        try {
            await transporter.sendMail({
                from: `"ShambaCare" <${process.env.EMAIL_USER}>`,
                to: user.email,
                subject: 'Reset your ShambaCare password',
                html: `<p>Hello ${user.name},</p>
                       <p>You requested a password reset. Click the link below to set a new password:</p>
                       <a href="${resetUrl}">${resetUrl}</a>
                       <p>This link expires in 1 hour.</p>
                       <p>If you didn't request this, please ignore this email.</p>
                       <p>ShambaCare Team</p>`
            });
            console.log('✅ Reset email sent successfully');
        } catch (emailError) {
            console.log('⚠️ Email not configured or failed to send. Reset link:', resetUrl);
        }
        
        res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== RESET PASSWORD ====================
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Token and new password required' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    try {
        const { sequelize } = require('../config/database');
        const bcrypt = require('bcryptjs');
        
        const [user] = await sequelize.query(
            `SELECT id, email, reset_expires FROM "users" WHERE reset_token = :token`,
            { replacements: { token: token }, type: sequelize.QueryTypes.SELECT }
        );
        
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
        }
        
        if (new Date(user.reset_expires) < new Date()) {
            return res.status(400).json({ success: false, message: 'Reset token has expired. Please request a new one.' });
        }
        
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        await sequelize.query(
            `UPDATE "users" SET password_hash = :password, reset_token = NULL, reset_expires = NULL WHERE id = :id`,
            {
                replacements: { password: hashedPassword, id: user.id },
                type: sequelize.QueryTypes.UPDATE
            }
        );
        
        console.log('✅ Password reset successful for:', user.email);
        res.json({ success: true, message: 'Password has been reset. You can now log in.' });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== GOOGLE SIGN-IN (using frontend ID token) ====================
router.post('/google', async (req, res) => {
    const { idToken } = req.body;
    
    if (!idToken) {
        return res.status(400).json({ success: false, message: 'ID token required' });
    }
    
    try {
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        const { email, name, picture, email_verified } = payload;
        
        let user = await User.findOne({ where: { email } });
        
        if (!user) {
            user = await User.create({
                name: name || email.split('@')[0],
                email: email,
                phone: '0000000000',
                county: 'Unknown',
                password_hash: crypto.randomBytes(20).toString('hex'),
                email_verified: email_verified || true,
                profile_image: picture || null,
                role: 'farmer'
            });
        }
        
        const token = generateToken(user.id);
        await user.update({ last_login: new Date() });
        
        res.json({
            success: true,
            message: 'Google login successful',
            token: token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                county: user.county,
                role: user.role,
                profile_image: user.profile_image,
                allowFarmerPortal: user.role === 'admin'
            }
        });
        
    } catch (error) {
        console.error('Google auth error:', error.message);
        res.status(401).json({ success: false, message: 'Invalid Google token: ' + error.message });
    }
});

// ==================== CHECK ACCESS FOR FARMER PORTAL ====================
// This route expects a valid token to be verified by middleware (verifyToken)
router.get('/access-info', async (req, res) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authenticated' });
    }
    const canAccessFarmerPortal = (req.user.role === 'admin' || req.user.role === 'farmer');
    res.json({
        success: true,
        role: req.user.role,
        canAccessFarmerPortal: canAccessFarmerPortal,
        message: canAccessFarmerPortal ? 'You can access the farmer portal' : 'Access denied'
    });
});

// ==================== TEST ROUTE ====================
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Auth routes are working!' });
});

// ==================== DEBUG ROUTES (optional, remove in production) ====================
router.get('/debug-user/:email', async (req, res) => {
    try {
        const email = req.params.email;
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.json({ exists: false, message: 'User not found' });
        }
        res.json({
            exists: true,
            email: user.email,
            name: user.name,
            role: user.role,
            has_reset_token: !!user.reset_token
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/debug-google', (req, res) => {
    res.json({
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        clientIdPreview: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 30) + '...' : 'NOT SET',
        frontendUrl: FRONTEND_URL,
        environment: process.env.NODE_ENV || 'development'
    });
});

module.exports = router;