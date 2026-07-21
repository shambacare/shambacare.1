const express = require('express');
const { User, ChatMessage } = require('../models');
const { verifyToken, isAdmin } = require('../middleware/auth');
const router = express.Router();

// ==================== FARMER ENDPOINTS ====================

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

        // Reload with raw: true
        const fresh = await ChatMessage.findByPk(chatMessage.id, { raw: true });
        console.log('🔥 Fresh message from DB:', fresh); // <- DEBUG

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

router.get('/my-messages', verifyToken, async (req, res) => {
    const farmerId = req.user.id;

    try {
        const messages = await ChatMessage.findAll({
            where: { farmer_id: farmerId },
            order: [['created_at', 'ASC']],
            raw: true
        });

        console.log('🔥 Raw messages from DB:', messages); // <- DEBUG

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

router.get('/admin/inbox', verifyToken, isAdmin, async (req, res) => {
    console.log('📋 Admin fetching inbox...');

    try {
        const farmersWithMessages = await ChatMessage.findAll({
            attributes: ['farmer_id'],
            group: ['farmer_id'],
            raw: true
        });

        const inbox = [];

        for (const item of farmersWithMessages) {
            const farmerId = item.farmer_id;
            const farmer = await User.findByPk(farmerId, {
                attributes: ['id', 'name', 'email', 'phone'],
                raw: true
            });

            if (!farmer) continue;

            const lastMessage = await ChatMessage.findOne({
                where: { farmer_id: farmerId },
                order: [['created_at', 'DESC']],
                raw: true
            });

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

        inbox.sort((a, b) => new Date(b.last_message_time) - new Date(a.last_message_time));

        res.json({ success: true, farmers: inbox });
    } catch (error) {
        console.error('Error loading inbox:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

router.get('/admin/conversation/:farmerId', verifyToken, isAdmin, async (req, res) => {
    const { farmerId } = req.params;

    try {
        const messages = await ChatMessage.findAll({
            where: { farmer_id: farmerId },
            order: [['created_at', 'ASC']],
            raw: true
        });

        await ChatMessage.update(
            { is_read: true, read_at: new Date() },
            { where: { farmer_id: farmerId, is_from_admin: false, is_read: false } }
        );

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

router.post('/admin/reply', verifyToken, isAdmin, async (req, res) => {
    const { farmer_id, message } = req.body;
    const adminId = req.user.id;

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
