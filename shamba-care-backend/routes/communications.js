const express = require('express');
const { User, ChatMessage } = require('../models');
const { verifyToken, isAdmin } = require('../middleware/auth');
const router = express.Router();

// ==================== FARMER ENDPOINTS ====================

// Farmer sends a message
router.post('/send', verifyToken, async (req, res) => {
    const { message } = req.body;
    const farmerId = req.user.id;

    console.log('📨 Farmer sending message:', { farmerId, message });

    if (!message || message.trim() === '') {
        return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    try {
        const chatMessage = await ChatMessage.create({
            farmer_id: farmerId,
            message: message.trim(),
            is_from_admin: false,
            is_read: false
        });

        // Reload with raw: true to bypass any model transformations
        const fresh = await ChatMessage.findByPk(chatMessage.id, { raw: true });

        res.json({
            success: true,
            message: 'Message sent successfully',
            chatMessage: {
                id: fresh.id,
                farmer_id: fresh.farmer_id,
                admin_id: fresh.admin_id,
                message: fresh.message,
                is_from_admin: fresh.is_from_admin,
                is_read: fresh.is_read,
                created_at: fresh.created_at ? new Date(fresh.created_at).toISOString() : null
            }
        });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: 'Failed to send message: ' + error.message });
    }
});

// Get farmer's own messages
router.get('/my-messages', verifyToken, async (req, res) => {
    const farmerId = req.user.id;

    try {
        // Use raw: true to get plain objects with database values
        const messages = await ChatMessage.findAll({
            where: { farmer_id: farmerId },
            order: [['created_at', 'ASC']],
            raw: true
        });

        // Format each message manually
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            farmer_id: msg.farmer_id,
            admin_id: msg.admin_id,
            message: msg.message,
            is_from_admin: msg.is_from_admin,
            is_read: msg.is_read,
            created_at: msg.created_at ? new Date(msg.created_at).toISOString() : null
        }));

        res.json({ success: true, messages: formattedMessages });
    } catch (error) {
        console.error('Error fetching messages:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// ==================== ADMIN ENDPOINTS ====================

// Get all conversations with farmers (admin inbox)
router.get('/admin/inbox', verifyToken, isAdmin, async (req, res) => {
    console.log('📋 Admin fetching inbox...');

    try {
        // Get distinct farmer IDs
        const farmersWithMessages = await ChatMessage.findAll({
            attributes: ['farmer_id'],
            group: ['farmer_id'],
            raw: true
        });

        console.log('Farmers with messages:', farmersWithMessages);

        const inbox = [];

        for (const item of farmersWithMessages) {
            const farmerId = item.farmer_id;
            const farmer = await User.findByPk(farmerId, {
                attributes: ['id', 'name', 'email', 'phone'],
                raw: true
            });

            if (!farmer) continue;

            // Get last message (raw)
            const lastMessage = await ChatMessage.findOne({
                where: { farmer_id: farmerId },
                order: [['created_at', 'DESC']],
                raw: true
            });

            // Count unread messages
            const unreadCount = await ChatMessage.count({
                where: {
                    farmer_id: farmerId,
                    is_from_admin: false,
                    is_read: false
                }
            });

            inbox.push({
                id: farmer.id,
                name: farmer.name,
                email: farmer.email,
                phone: farmer.phone,
                unread_count: unreadCount,
                last_message: lastMessage ? lastMessage.message : 'No messages',
                last_message_time: lastMessage ? lastMessage.created_at : farmer.created_at
            });
        }

        // Sort by last message time (most recent first)
        inbox.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));

        console.log(`📋 Returning ${inbox.length} conversations`);
        res.json({ success: true, farmers: inbox });
    } catch (error) {
        console.error('Error loading inbox:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get conversation with specific farmer
router.get('/admin/conversation/:farmerId', verifyToken, isAdmin, async (req, res) => {
    const { farmerId } = req.params;

    console.log(`💬 Fetching conversation with farmer ${farmerId}`);

    try {
        const messages = await ChatMessage.findAll({
            where: { farmer_id: farmerId },
            order: [['created_at', 'ASC']],
            raw: true
        });

        console.log(`Found ${messages.length} messages`);

        // Mark messages from farmer as read
        await ChatMessage.update(
            { is_read: true, read_at: new Date() },
            { where: { farmer_id: farmerId, is_from_admin: false, is_read: false } }
        );

        // Format messages
        const formattedMessages = messages.map(msg => ({
            id: msg.id,
            farmer_id: msg.farmer_id,
            admin_id: msg.admin_id,
            message: msg.message,
            is_from_admin: msg.is_from_admin,
            is_read: msg.is_read,
            created_at: msg.created_at ? new Date(msg.created_at).toISOString() : null
        }));

        res.json({ success: true, messages: formattedMessages });
    } catch (error) {
        console.error('Error loading conversation:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Admin replies to farmer
router.post('/admin/reply', verifyToken, isAdmin, async (req, res) => {
    const { farmer_id, message } = req.body;
    const adminId = req.user.id;

    console.log(`💬 Admin replying to farmer ${farmer_id}:`, message);

    if (!farmer_id || !message || message.trim() === '') {
        return res.status(400).json({ success: false, message: 'Farmer ID and message required' });
    }

    try {
        const farmer = await User.findByPk(farmer_id, { raw: true });
        if (!farmer) {
            return res.status(404).json({ success: false, message: 'Farmer not found' });
        }

        const reply = await ChatMessage.create({
            farmer_id: farmer_id,
            admin_id: adminId,
            message: message.trim(),
            is_from_admin: true,
            is_read: false
        });

        // Reload raw
        const freshReply = await ChatMessage.findByPk(reply.id, { raw: true });

        res.json({
            success: true,
            message: 'Reply sent successfully',
            reply: {
                id: freshReply.id,
                farmer_id: freshReply.farmer_id,
                admin_id: freshReply.admin_id,
                message: freshReply.message,
                is_from_admin: freshReply.is_from_admin,
                is_read: freshReply.is_read,
                created_at: freshReply.created_at ? new Date(freshReply.created_at).toISOString() : null
            }
        });
    } catch (error) {
        console.error('Error sending reply:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Mark conversation as read
router.put('/admin/mark-read/:farmerId', verifyToken, isAdmin, async (req, res) => {
    const { farmerId } = req.params;

    try {
        await ChatMessage.update(
            { is_read: true, read_at: new Date() },
            { where: { farmer_id: farmerId, is_from_admin: false, is_read: false } }
        );

        res.json({ success: true, message: 'Conversation marked as read' });
    } catch (error) {
        console.error('Error marking conversation as read:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;
