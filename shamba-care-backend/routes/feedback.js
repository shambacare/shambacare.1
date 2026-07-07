const express = require('express');
const { verifyToken } = require('../middleware/auth');
const { sequelize } = require('../config/database');
const router = express.Router();

// GET all feedback
router.get('/all', async (req, res) => {
  try {
    const [reviews] = await sequelize.query('SELECT id, name, email, location, rating, message, created_at FROM feedbacks ORDER BY created_at DESC');
    return res.json({ success: true, reviews });
  } catch (err) {
    console.error('❌ Feedback GET error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

// POST feedback
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, email, location, rating, message } = req.body;
    if (!name || !email || !location || !rating || !message) {
      return res.status(400).json({ success: false, message: 'Missing fields' });
    }
    const result = await sequelize.query(
      'INSERT INTO feedbacks (name, email, location, rating, message, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id',
      { bind: [name, email, location, rating, message], type: sequelize.QueryTypes.INSERT }
    );
    return res.status(201).json({ success: true, feedback: { id: result[0][0].id } });
  } catch (err) {
    console.error('❌ Feedback POST error:', err.message);
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;