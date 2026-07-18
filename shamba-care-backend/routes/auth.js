// routes/auth.js – Complete authentication with code-based password reset and Google login for existing users only
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { User } = require('../models');
const { sendEmail } = require('../utils/email');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'shambacare_super_secret_key_2024';

// ==================== HELPERS ====================
function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });
}

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
    // Pass plaintext password – the model hook will hash it
    const user = await User.create({
      name,
      email,
      phone,
      county,
      password_hash: password,
      role: 'farmer',
      email_verified: false,
      is_active: true
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
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    if (!user.is_active) {
      return res.status(401).json({ success: false, message: 'Account is deactivated' });
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
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

// ==================== FORGOT PASSWORD – SEND CODE ====================
router.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email is required' });
  }
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      // Always return success to avoid email enumeration
      return res.json({ success: true, message: 'If the email exists, a reset code has been sent.' });
    }

    // Generate a 6-digit numeric code
    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    // Store code in reset_token (reuse the existing column)
    await user.update({
      reset_token: resetCode,
      reset_expires: resetExpires
    });

    // Send email with code
    await sendEmail({
      to: user.email,
      subject: 'ShambaCare Password Reset Code',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #1e3a5f;">Password Reset</h2>
          <p>Hello ${user.name},</p>
          <p>You requested to reset your password. Use the code below to set a new password:</p>
          <div style="background: #f0fdf4; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 8px; font-weight: bold; border-radius: 8px; margin: 20px 0;">
            ${resetCode}
          </div>
          <p>This code expires in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
          <p>ShambaCare Team</p>
        </div>
      `
    });

    res.json({ success: true, message: 'If the email exists, a reset code has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== VERIFY CODE ====================
router.post('/verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, message: 'Email and code required' });
  }
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or code' });
    }
    if (user.reset_token !== code) {
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }
    if (new Date(user.reset_expires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Code has expired. Please request a new one.' });
    }
    // Code is valid
    res.json({ success: true, message: 'Code verified' });
  } catch (error) {
    console.error('Verify code error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== RESET PASSWORD (FIXED – no double hashing) ====================
router.post('/reset-password', async (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) {
    return res.status(400).json({ success: false, message: 'Email, code, and new password required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
  }

  try {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or code' });
    }

    // Check if code matches and is not expired
    if (user.reset_token !== code) {
      return res.status(400).json({ success: false, message: 'Invalid code' });
    }
    if (new Date(user.reset_expires) < new Date()) {
      return res.status(400).json({ success: false, message: 'Code has expired. Please request a new one.' });
    }

    // ✅ Pass plaintext password – the model hook will hash it once
    await user.update({
      password_hash: newPassword,
      reset_token: null,
      reset_expires: null
    });

    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== GOOGLE SIGN-IN (Existing users only) ====================
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

    // ✅ Check if user exists – do NOT create new user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'No account found for this email. Please sign up first.'
      });
    }

    // User exists – proceed with login
    const token = generateToken(user.id);
    await user.update({ last_login: new Date() });

    const allowFarmerPortal = user.role === 'admin';

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
        allowFarmerPortal: allowFarmerPortal
      }
    });
  } catch (error) {
    console.error('Google auth error:', error.message);
    res.status(401).json({ success: false, message: 'Invalid Google token: ' + error.message });
  }
});

// ==================== DEBUG ROUTES (optional) ====================
router.get('/test', (req, res) => {
  res.json({ success: true, message: 'Auth routes are working!' });
});

// Debug user by email
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

module.exports = router;
