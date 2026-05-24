const express = require('express');
const { Subscription, User } = require('../models');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const { Op } = require('sequelize');
const router = express.Router();

// Get all subscription plans (public)
router.get('/plans', async (req, res) => {
    const plans = [
        { name: 'Basic', price: 0, features: ['5 diagnoses/month', 'Basic crop tracking', 'Weather alerts'], duration_days: 365 },
        { name: 'Pro', price: 500, features: ['Unlimited diagnoses', 'Advanced analytics', 'Priority support'], duration_days: 30 },
        { name: 'Enterprise', price: 'Custom', features: ['Everything in Pro', 'API access', 'Dedicated support'], duration_days: 365 }
    ];
    res.json({ success: true, plans });
});

// Get current user's subscription
router.get('/me', verifyToken, async (req, res) => {
    try {
        const subscription = await Subscription.findOne({
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, subscription });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Subscribe to a plan
router.post('/subscribe', verifyToken, async (req, res) => {
    const { plan } = req.body;
    const userId = req.user.id;
    
    if (!plan || !['Basic', 'Pro', 'Enterprise'].includes(plan)) {
        return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }
    
    try {
        const user = await User.findByPk(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        // Calculate expiry date
        let expiryDays = plan === 'Pro' ? 30 : 365;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiryDays);
        
        // Create or update subscription
        const [subscription, created] = await Subscription.upsert({
            user_id: userId,
            plan: plan,
            status: 'active',
            started_at: new Date(),
            expires_at: expiresAt
        });
        
        // Send confirmation email
        await sendEmail({
            to: user.email,
            subject: `✅ Welcome to ShambaCare ${plan} Plan!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #1e3a5f; padding: 20px; text-align: center;">
                        <h2 style="color: #4ade80; margin: 0;">ShambaCare</h2>
                    </div>
                    <div style="background: #f9fafb; padding: 20px;">
                        <h2 style="color: #1e293b;">Hello ${user.name}!</h2>
                        <p>Thank you for subscribing to the <strong style="color: #4ade80;">${plan}</strong> plan.</p>
                        <div style="background: #e5e7eb; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <p><strong>Start Date:</strong> ${new Date().toLocaleDateString()}</p>
                            <p><strong>Expiry Date:</strong> ${expiresAt.toLocaleDateString()}</p>
                            <p><strong>Status:</strong> Active ✅</p>
                        </div>
                        <h3>What you get:</h3>
                        <ul>
                            ${plan === 'Pro' ? '<li>✓ Unlimited AI diagnoses</li><li>✓ Priority support</li><li>✓ Advanced farm analytics</li>' : '<li>✓ 5 diagnoses/month</li><li>✓ Basic crop tracking</li><li>✓ Weather alerts</li>'}
                        </ul>
                        <p>Need help? Contact us at support@shambacare.com</p>
                        <hr>
                        <p style="color: #6b7280; font-size: 12px;">Happy farming! 🌱</p>
                    </div>
                </div>
            `
        });
        
        res.json({ 
            success: true, 
            message: `Successfully subscribed to ${plan} plan!`,
            subscription
        });
    } catch (error) {
        console.error('Subscription error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Renew subscription
router.post('/renew/:id', verifyToken, async (req, res) => {
    try {
        const subscription = await Subscription.findByPk(req.params.id);
        if (!subscription) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }
        
        const user = await User.findByPk(subscription.user_id);
        
        let expiryDays = subscription.plan === 'Pro' ? 30 : 365;
        const newExpiry = new Date();
        newExpiry.setDate(newExpiry.getDate() + expiryDays);
        
        await subscription.update({
            status: 'active',
            expires_at: newExpiry,
            renewed_at: new Date()
        });
        
        // Send renewal confirmation email
        await sendEmail({
            to: user.email,
            subject: `🔄 Your ShambaCare ${subscription.plan} Plan Has Been Renewed!`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                    <div style="background: #1e3a5f; padding: 20px; text-align: center;">
                        <h2 style="color: #4ade80;">Subscription Renewed</h2>
                    </div>
                    <div style="padding: 20px;">
                        <h2>Hello ${user.name},</h2>
                        <p>Your ${subscription.plan} plan has been successfully renewed.</p>
                        <p><strong>New Expiry Date:</strong> ${newExpiry.toLocaleDateString()}</p>
                        <p>Thank you for being a valued ShambaCare farmer!</p>
                        <a href="http://localhost:5500/dashboard.html" style="background: #4ade80; color: #1e3a5f; padding: 10px 20px; text-decoration: none;">Go to Dashboard</a>
                    </div>
                </div>
            `
        });
        
        res.json({ success: true, message: 'Subscription renewed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Cancel subscription
router.post('/cancel/:id', verifyToken, async (req, res) => {
    try {
        const subscription = await Subscription.findByPk(req.params.id);
        if (!subscription) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }
        
        const user = await User.findByPk(subscription.user_id);
        
        await subscription.update({ status: 'cancelled' });
        
        // Send cancellation email
        await sendEmail({
            to: user.email,
            subject: `👋 ShambaCare ${subscription.plan} Plan Cancelled`,
            html: `
                <div style="font-family: Arial, sans-serif;">
                    <h2>Subscription Cancelled</h2>
                    <p>Hello ${user.name},</p>
                    <p>Your ${subscription.plan} plan has been cancelled.</p>
                    <p>You will continue to have access until ${new Date(subscription.expires_at).toLocaleDateString()}.</p>
                    <p>We're sad to see you go! You can resubscribe anytime.</p>
                    <a href="http://localhost:5500/subscribe.html">Resubscribe</a>
                </div>
            `
        });
        
        res.json({ success: true, message: 'Subscription cancelled' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Check expiring subscriptions (cron job)
router.get('/check-expiring', verifyToken, isAdmin, async (req, res) => {
    try {
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        
        const expiringSubs = await Subscription.findAll({
            where: {
                status: 'active',
                expires_at: { [Op.lte]: sevenDaysFromNow }
            },
            include: [{ model: User, as: 'subscriber' }]
        });
        
        let remindersSent = 0;
        for (const sub of expiringSubs) {
            await sendEmail({
                to: sub.subscriber.email,
                subject: `⚠️ Your ShambaCare Subscription Expires Soon!`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px;">
                        <div style="background: #fef3c7; padding: 20px; text-align: center;">
                            <h2 style="color: #92400e;">⚠️ Subscription Expiring Soon</h2>
                        </div>
                        <div style="padding: 20px;">
                            <p>Hello ${sub.subscriber.name},</p>
                            <p>Your ${sub.plan} plan will expire on <strong>${new Date(sub.expires_at).toLocaleDateString()}</strong>.</p>
                            <p>To avoid interruption, please renew your subscription.</p>
                            <div style="margin: 20px 0; text-align: center;">
                                <a href="http://localhost:5500/subscribe.html" style="background: #3b82f6; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Renew Now</a>
                            </div>
                            <p>If you have any questions, contact our support team.</p>
                            <hr>
                            <p style="font-size: 12px;">ShambaCare - Your farming assistant</p>
                        </div>
                    </div>
                `
            });
            remindersSent++;
        }
        
        res.json({ success: true, remindersSent, totalExpiring: expiringSubs.length });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get all subscriptions (admin only)
router.get('/all', verifyToken, isAdmin, async (req, res) => {
    try {
        const subscriptions = await Subscription.findAll({
            include: [{ model: User, as: 'subscriber', attributes: ['id', 'name', 'email'] }],
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, subscriptions });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;