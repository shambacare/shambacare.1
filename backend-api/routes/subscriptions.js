const express = require('express');
const { Subscription, User } = require('../models');
const { verifyToken, isAdmin } = require('../middleware/auth');
const router = express.Router();

// ==================== PUBLIC ROUTES ====================

// Get all subscription plans (no token required)
router.get('/plans', (req, res) => {
    const plans = [
        { 
            name: 'Basic', 
            price: 500, 
            features: [
                '5 diagnoses per month',
                'Basic weather alerts',
                'Email support',
                'Crop recommendations'
            ],
            icon: '🌾',
            popular: false
        },
        { 
            name: 'Pro', 
            price: 1200, 
            features: [
                'Unlimited diagnoses',
                'Priority weather alerts',
                'WhatsApp support',
                'Crop tracking',
                'Disease library access',
                'Export reports'
            ],
            icon: '🚜',
            popular: true
        },
        { 
            name: 'Enterprise', 
            price: 2500, 
            features: [
                'Everything in Pro',
                'Dedicated support line',
                'Farm visit scheduling',
                'Custom insights',
                'Multi-farm management',
                'API access'
            ],
            icon: '🏆',
            popular: false
        }
    ];
    res.json({ success: true, plans });
});

// ==================== PROTECTED ROUTES (Farmer + Admin) ====================

// Get current user's active subscription
router.get('/me', verifyToken, async (req, res) => {
    try {
        let subscription = await Subscription.findOne({
            where: { user_id: req.user.id, status: 'Active' }
        });
        
        // If no active subscription exists, create a default Basic subscription
        if (!subscription) {
            subscription = await Subscription.create({
                user_id: req.user.id,
                plan: 'Basic',
                price_kes: 500,
                started_at: new Date().toISOString().split('T')[0],
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                status: 'Active',
                payment_method: 'Mpesa',
                auto_renew: true
            });
        }
        
        res.json({ success: true, subscription });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// Initiate M-Pesa payment for subscription
router.post('/initiate-payment', verifyToken, async (req, res) => {
    const { plan, phoneNumber } = req.body;
    
    const plans = { Basic: 500, Pro: 1200, Enterprise: 2500 };
    
    if (!plan || !plans[plan]) {
        return res.status(400).json({ success: false, message: 'Invalid plan selected' });
    }
    
    if (!phoneNumber) {
        return res.status(400).json({ success: false, message: 'Phone number is required' });
    }
    
    const amount = plans[plan];
    
    try {
        // Format phone number for M-Pesa
        let formattedPhone = phoneNumber.replace(/[^0-9]/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '254' + formattedPhone.substring(1);
        }
        if (!formattedPhone.startsWith('254')) {
            formattedPhone = '254' + formattedPhone;
        }
        
        // Generate a unique transaction ID
        const transactionId = `SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Deactivate all existing active subscriptions for this user
        await Subscription.update(
            { status: 'Expired', auto_renew: false },
            { where: { user_id: req.user.id, status: 'Active' } }
        );
        
        // Create new subscription
        const subscription = await Subscription.create({
            user_id: req.user.id,
            plan,
            price_kes: amount,
            started_at: new Date().toISOString().split('T')[0],
            expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            status: 'Pending',
            payment_method: 'Mpesa',
            transaction_id: transactionId,
            auto_renew: true
        });
        
        console.log(`[M-Pesa] Initiating payment for ${formattedPhone}, Amount: KES ${amount}, Transaction ID: ${transactionId}`);
        
        // Simulate automatic payment confirmation after 5 seconds
        setTimeout(async () => {
            await subscription.update({ 
                status: 'Active'
            });
            console.log(`✅ Subscription upgraded to ${plan} for user ${req.user.id}`);
        }, 5000);
        
        res.json({
            success: true,
            message: 'Payment initiated. Please check your phone for M-Pesa prompt. Subscription will upgrade within 5 seconds.',
            transaction_id: transactionId,
            checkout_request_id: `REQ-${Date.now()}`,
            subscription_id: subscription.id,
            amount: amount,
            plan: plan
        });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Payment initiation failed' });
    }
});

// M-Pesa callback (webhook) - called by Safaricom after payment
router.post('/mpesa-callback', async (req, res) => {
    console.log('M-Pesa Callback received:', req.body);
    
    const { Body } = req.body;
    if (Body && Body.stkCallback) {
        const { ResultCode, ResultDesc, CheckoutRequestID, TransactionID } = Body.stkCallback;
        
        if (ResultCode === 0) {
            // Payment successful
            const subscription = await Subscription.findOne({
                where: { transaction_id: CheckoutRequestID }
            });
            
            if (subscription) {
                await subscription.update({
                    status: 'Active',
                    transaction_id: TransactionID
                });
                console.log(`✅ Payment successful for user ${subscription.user_id}`);
            }
        } else {
            console.log(`❌ Payment failed: ${ResultDesc}`);
            const subscription = await Subscription.findOne({
                where: { transaction_id: CheckoutRequestID }
            });
            if (subscription) {
                await subscription.update({ status: 'Cancelled' });
            }
        }
    }
    
    res.json({ ResultCode: 0, ResultDesc: 'Success' });
});

// Cancel subscription
router.post('/cancel', verifyToken, async (req, res) => {
    try {
        const subscription = await Subscription.findOne({
            where: { user_id: req.user.id, status: 'Active' }
        });
        
        if (!subscription) {
            return res.status(404).json({ success: false, message: 'No active subscription found' });
        }
        
        await subscription.update({ status: 'Cancelled', auto_renew: false });
        res.json({ success: true, message: 'Subscription cancelled successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== ADMIN ONLY ROUTES ====================

// Get all subscriptions (Admin only)
router.get('/all', verifyToken, isAdmin, async (req, res) => {
    try {
        const subscriptions = await Subscription.findAll({
            include: [{ model: User, as: 'subscriber', attributes: ['id', 'name', 'email', 'phone', 'county'] }],
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, subscriptions });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update subscription (Admin only)
router.put('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const subscription = await Subscription.findByPk(req.params.id);
        
        if (!subscription) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }
        
        const { plan, status, auto_renew, price_kes } = req.body;
        const updates = {};
        if (plan) updates.plan = plan;
        if (status) updates.status = status;
        if (auto_renew !== undefined) updates.auto_renew = auto_renew;
        if (price_kes) updates.price_kes = price_kes;
        
        await subscription.update(updates);
        
        res.json({ success: true, subscription });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete subscription (Admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const subscription = await Subscription.findByPk(req.params.id);
        
        if (!subscription) {
            return res.status(404).json({ success: false, message: 'Subscription not found' });
        }
        
        await subscription.destroy();
        res.json({ success: true, message: 'Subscription deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get subscription statistics (Admin only)
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
    try {
        const totalSubscriptions = await Subscription.count();
        const activeSubscriptions = await Subscription.count({ where: { status: 'Active' } });
        const expiredSubscriptions = await Subscription.count({ where: { status: 'Expired' } });
        const cancelledSubscriptions = await Subscription.count({ where: { status: 'Cancelled' } });
        const pendingSubscriptions = await Subscription.count({ where: { status: 'Pending' } });
        
        const totalRevenue = await Subscription.sum('price_kes', { where: { status: 'Active' } });
        
        const planBreakdown = {
            Basic: await Subscription.count({ where: { plan: 'Basic', status: 'Active' } }),
            Pro: await Subscription.count({ where: { plan: 'Pro', status: 'Active' } }),
            Enterprise: await Subscription.count({ where: { plan: 'Enterprise', status: 'Active' } })
        };
        
        // Get recent subscriptions
        const recentSubscriptions = await Subscription.findAll({
            limit: 5,
            order: [['created_at', 'DESC']],
            include: [{ model: User, as: 'subscriber', attributes: ['name', 'email'] }]
        });
        
        res.json({
            success: true,
            stats: {
                totalSubscriptions,
                activeSubscriptions,
                expiredSubscriptions,
                cancelledSubscriptions,
                pendingSubscriptions,
                totalRevenue: totalRevenue || 0,
                planBreakdown
            },
            recentSubscriptions
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;