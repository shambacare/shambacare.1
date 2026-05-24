const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { User } = require('../models');
const { Op } = require('sequelize');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'shambacare_secret_key';

// Email transporter
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
            name, email, phone, county,
            password_hash: password
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
                role: user.role
            }
        });
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
        if (!user.is_active) return res.status(401).json({ success: false, message: 'Account is deactivated. Contact admin.' });
        if (role && user.role !== role) return res.status(401).json({ success: false, message: `No ${role} account found with this email` });
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
                role: user.role
            }
        });
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
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });
    try {
        const user = await User.findOne({ where: { email } });
        if (!user) {
            return res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
        }
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 3600000); // 1 hour
        await user.update({ reset_token: resetToken, reset_expires: resetExpires });
        const resetUrl = `${process.env.FRONTEND_URL?.split(',')[0] || 'http://localhost:5500'}/reset-password.html?token=${resetToken}`;
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
        res.json({ success: true, message: 'If the email exists, a reset link has been sent.' });
    } catch (error) {
        console.error(error);
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
        const user = await User.findOne({
            where: {
                reset_token: token,
                reset_expires: { [Op.gt]: new Date() }
            }
        });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid or expired reset token' });
        }
        user.password_hash = newPassword; // will be hashed by beforeSave
        user.reset_token = null;
        user.reset_expires = null;
        await user.save();
        res.json({ success: true, message: 'Password has been reset. You can now log in.' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== GOOGLE SIGN-IN ====================
router.post('/google', async (req, res) => {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ success: false, message: 'ID token required' });
    try {
        const { OAuth2Client } = require('google-auth-library');
        const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
        const ticket = await client.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID
        });
        const payload = ticket.getPayload();
        const { email, name, picture, sub: googleId } = payload;
        if (!email) return res.status(400).json({ success: false, message: 'Email not provided by Google' });
        let user = await User.findOne({ where: { email } });
        if (!user) {
            user = await User.create({
                name: name || email.split('@')[0],
                email,
                phone: '0000000000',
                county: 'Unknown',
                password_hash: crypto.randomBytes(20).toString('hex'),
                email_verified: true
            });
        }
        const token = generateToken(user.id);
        await user.update({ last_login: new Date() });
        res.json({
            success: true,
            message: 'Google login successful',
            token,
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
        res.status(401).json({ success: false, message: 'Invalid Google token' });
    }
});

// ==================== PHONE OTP LOGIN ====================
const otpStore = new Map();

router.post('/phone/request-otp', async (req, res) => {
    const { phoneNumber } = req.body;
    if (!phoneNumber) return res.status(400).json({ success: false, message: 'Phone number required' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    otpStore.set(phoneNumber, { otp, expires });
    console.log(`📱 OTP for ${phoneNumber}: ${otp}`);
    // TODO: integrate Africa's Talking SMS here
    res.json({ success: true, message: 'OTP sent successfully' });
});

router.post('/phone/verify-otp', async (req, res) => {
    const { phoneNumber, otp } = req.body;
    if (!phoneNumber || !otp) {
        return res.status(400).json({ success: false, message: 'Phone number and OTP required' });
    }
    const record = otpStore.get(phoneNumber);
    if (!record || record.otp !== otp || record.expires < Date.now()) {
        return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }
    otpStore.delete(phoneNumber);
    let user = await User.findOne({ where: { phone: phoneNumber } });
    if (!user) {
        user = await User.create({
            name: `Farmer_${phoneNumber.slice(-4)}`,
            email: `${phoneNumber}@temp.shambacare.com`,
            phone: phoneNumber,
            county: 'Unknown',
            password_hash: crypto.randomBytes(20).toString('hex'),
            phone_verified: true
        });
    }
    const token = generateToken(user.id);
    await user.update({ last_login: new Date() });
    res.json({
        success: true,
        message: 'Phone login successful',
        token,
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            county: user.county,
            role: user.role
        }
    });
});

module.exports = router;