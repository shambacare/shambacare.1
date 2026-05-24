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
        
        console.log('✅ Message saved with ID:', chatMessage.id);
        
        res.json({
            success: true,
            message: 'Message sent successfully',
            chatMessage: {
                id: chatMessage.id,
                message: chatMessage.message,
                is_from_admin: false,
                created_at: chatMessage.created_at
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
        const messages = await ChatMessage.findAll({
            where: { farmer_id: farmerId },
            order: [['created_at', 'ASC']]
        });
        
        res.json({ success: true, messages });
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
        // Get all distinct farmer IDs who have messages
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
                attributes: ['id', 'name', 'email', 'phone']
            });
            
            if (!farmer) continue;
            
            // Get last message
            const lastMessage = await ChatMessage.findOne({
                where: { farmer_id: farmerId },
                order: [['created_at', 'DESC']]
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
            order: [['created_at', 'ASC']]
        });
        
        console.log(`Found ${messages.length} messages`);
        
        // Mark messages from farmer as read
        await ChatMessage.update(
            { is_read: true, read_at: new Date() },
            { where: { farmer_id: farmerId, is_from_admin: false, is_read: false } }
        );
        
        res.json({ success: true, messages });
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
        const farmer = await User.findByPk(farmer_id);
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
        
        console.log(`✅ Reply saved with ID: ${reply.id}`);
        
        res.json({
            success: true,
            message: 'Reply sent successfully',
            reply: {
                id: reply.id,
                message: reply.message,
                is_admin: true,
                created_at: reply.created_at
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