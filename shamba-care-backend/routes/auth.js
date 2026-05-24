const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'shambacare_super_secret_key_2024';

// Email transporter for password reset
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
        const user = await User.create({ name, email, phone, county, password_hash: password });
        const token = generateToken(user.id);
        await user.update({ last_login: new Date() });
        res.status(201).json({ success: true, message: 'Account created successfully', token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, county: user.county, role: user.role } });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== LOGIN ====================
router.post('/login', async (req, res) => {
    const { email, password, role } = req.body;
    if (!email || !password) {
        return res.status(400).json({ success: false, message: 'Email and password required' });
    }
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        if (!user.is_active) return res.status(401).json({ success: false, message: 'Account is deactivated' });
        if (role && user.role !== role) return res.status(401).json({ success: false, message: 'No ' + role + ' account found' });
        const isMatch = await user.comparePassword(password);
        if (!isMatch) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        const token = generateToken(user.id);
        await user.update({ last_login: new Date() });
        res.json({ success: true, message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone, county: user.county, role: user.role } });
    } catch (error) {
        console.error(error);
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
            return res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
        }
        
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000);
        
        // Use direct SQL update (bypassing model issues)
        const { sequelize } = require('../config/database');
        await sequelize.query(
            `UPDATE "users" SET reset_token = :token, reset_expires = :expires WHERE email = :email`,
            {
                replacements: { token: resetToken, expires: resetExpires, email: email },
                type: sequelize.QueryTypes.UPDATE
            }
        );
        
        console.log(`✅ Token saved for: ${user.email}`);
        console.log(`📝 Reset token: ${resetToken}`);
        console.log(`⏰ Expires at: ${resetExpires}`);
        
        const resetUrl = `http://localhost:5500/reset-password.html?token=${resetToken}`;
        console.log(`🔐 Reset link: ${resetUrl}`);
        
        // Try to send email
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
            console.log('⚠️ Email not configured, but reset link is available above');
        }
        
        res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ==================== RESET PASSWORD ====================
router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    console.log('🔐 Reset attempt with token:', token);
    
    if (!token || !newPassword) {
        return res.status(400).json({ success: false, message: 'Token and new password required' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }
    
    try {
        const { sequelize } = require('../config/database');
        const bcrypt = require('bcryptjs');
        
        // First, find the user with this token
        const [user] = await sequelize.query(
            `SELECT id, email, reset_expires FROM "users" WHERE reset_token = :token`,
            { replacements: { token: token }, type: sequelize.QueryTypes.SELECT }
        );
        
        if (!user) {
            console.log('❌ No user found with token');
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
        }
        
        console.log('✅ User found:', user.email);
        console.log('Token expires:', user.reset_expires);
        console.log('Current time:', new Date());
        
        // Check if token expired
        if (new Date(user.reset_expires) < new Date()) {
            console.log('❌ Token expired');
            return res.status(400).json({ success: false, message: 'Reset token has expired. Please request a new one.' });
        }
        
        // Hash the new password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        
        // Update password and clear reset fields
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
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});

// ==================== GOOGLE SIGN-IN (ENHANCED) ====================
router.post('/google', async (req, res) => {
    const { idToken } = req.body;
    
    console.log('📱 Google login attempt received');
    
    if (!idToken) {
        console.log('❌ No ID token provided');
        return res.status(400).json({ success: false, message: 'ID token required' });
    }
    
    // Log token preview for debugging (first 50 chars)
    console.log('🔑 Token preview:', idToken.substring(0, 50) + '...');
    console.log('📏 Token length:', idToken.length);
    
    try {
        // Check if token is a valid JWT (should have 3 parts separated by dots)
        const parts = idToken.split('.');
        if (parts.length !== 3) {
            console.log('❌ Invalid token format - not a JWT. Parts:', parts.length);
            return res.status(400).json({ success: false, message: 'Invalid token format' });
        }
        
        // Import and verify with Google
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        
        console.log('🔍 Verifying token with Google...');
        console.log('📋 Using Client ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING');
        
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });
        
        const payload = ticket.getPayload();
        const { email, name, picture, email_verified } = payload;
        
        console.log('✅ Token verified successfully for:', email);
        console.log('📧 Email verified:', email_verified);
        
        if (!email) {
            console.log('❌ No email in payload');
            return res.status(400).json({ success: false, message: 'Email not provided by Google' });
        }
        
        // Find or create user
        let user = await User.findOne({ where: { email } });
        
        if (!user) {
            console.log('👤 Creating new user for:', email);
            user = await User.create({
                name: name || email.split('@')[0],
                email: email,
                phone: '0000000000',
                county: 'Unknown',
                password_hash: crypto.randomBytes(20).toString('hex'),
                email_verified: email_verified || true,
                profile_image: picture || null
            });
            console.log('✅ New user created with ID:', user.id);
        } else {
            console.log('👤 Existing user found:', user.id);
        }
        
        // Generate our app token
        const token = generateToken(user.id);
        await user.update({ last_login: new Date() });
        
        console.log('🎉 Google login successful for:', email);
        
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
                profile_image: user.profile_image
            }
        });
        
    } catch (error) {
        console.error('❌ Google auth error:', error.message);
        console.error('Error details:', error);
        
        // Provide more specific error messages
        if (error.message.includes('Invalid token signature')) {
            res.status(401).json({ success: false, message: 'Invalid token signature. Please try logging in again.' });
        } else if (error.message.includes('audience')) {
            res.status(401).json({ 
                success: false, 
                message: 'Token audience mismatch. Please check Google Client ID configuration.' 
            });
        } else if (error.message.includes('expired')) {
            res.status(401).json({ success: false, message: 'Token has expired. Please try logging in again.' });
        } else if (error.message.includes('No client id')) {
            res.status(500).json({ success: false, message: 'Server configuration error: Google Client ID not set.' });
        } else {
            res.status(401).json({ success: false, message: 'Invalid Google token: ' + error.message });
        }
    }
});

// ==================== TEST ROUTE ====================
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'Auth routes are working!' });
});

// ==================== DEBUG ROUTES ====================
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
            has_reset_token: !!user.reset_token,
            reset_token: user.reset_token,
            reset_expires: user.reset_expires
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Debug Google config
router.get('/debug-google', (req, res) => {
    res.json({
        hasClientId: !!process.env.GOOGLE_CLIENT_ID,
        clientIdPreview: process.env.GOOGLE_CLIENT_ID ? process.env.GOOGLE_CLIENT_ID.substring(0, 30) + '...' : 'NOT SET',
        environment: process.env.NODE_ENV || 'development'
    });
});

// Direct SQL debug route
router.post('/debug-direct-update', async (req, res) => {
    const { email } = req.body;
    try {
        const { sequelize } = require('../config/database');
        const resetToken = 'test-token-' + Date.now();
        const resetExpires = new Date(Date.now() + 3600000);
        
        await sequelize.query(
            `UPDATE "users" SET reset_token = :token, reset_expires = :expires WHERE email = :email`,
            {
                replacements: { token: resetToken, expires: resetExpires, email: email },
                type: sequelize.QueryTypes.UPDATE
            }
        );
        
        const [result] = await sequelize.query(
            `SELECT reset_token, reset_expires FROM "users" WHERE email = :email`,
            { replacements: { email: email }, type: sequelize.QueryTypes.SELECT }
        );
        
        res.json({ 
            success: true, 
            message: 'Direct SQL update attempted',
            token: resetToken,
            result: result 
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;