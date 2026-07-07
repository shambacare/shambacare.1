const jwt = require('jsonwebtoken');
const { User } = require('../models');

const JWT_SECRET = process.env.JWT_SECRET || 'shamba-care_secret_key';

// Verify JWT token
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Access denied. No token provided.' 
        });
    }
    
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        const user = await User.findByPk(decoded.userId, {
            attributes: ['id', 'name', 'email', 'phone', 'role', 'county', 'is_active']
        });
        
        if (!user || !user.is_active) {
            return res.status(401).json({ 
                success: false, 
                message: 'User not found or inactive.' 
            });
        }
        
        req.user = user;
        req.userId = user.id;
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Invalid or expired token.' 
        });
    }
};

// Check if user is admin
const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ 
            success: false, 
            message: 'Access denied. Admin only.' 
        });
    }
    next();
};

module.exports = { verifyToken, isAdmin };