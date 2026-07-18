// routes/auth.js – password reset with code
const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User } = require('../models');
const { sendEmail } = require('../utils/email');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'shambacare_super_secret_key_2024';

// ==================== SIGNUP (unchanged) ====================
router.post('/signup', async (req, res) => {
  // ... keep your existing signup logic
});

// ==================== LOGIN (unchanged) ====================
router.post('/login', async (req, res) => {
  // ... keep your existing login logic
});

// ==================== FORGOT PASSWORD – send code ====================
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

// ==================== VERIFY CODE AND RESET PASSWORD ====================
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

    // Hash new password (the model hook will handle this if you set password_hash directly)
    const bcrypt = require('bcryptjs');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await user.update({
      password_hash: hashedPassword,
      reset_token: null,
      reset_expires: null
    });

    res.json({ success: true, message: 'Password has been reset successfully. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ==================== GOOGLE SIGN-IN (unchanged) ====================
router.post('/google', async (req, res) => {
  // ... keep your existing Google login logic
});

module.exports = router;
