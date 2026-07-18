const express = require('express');
const { Diagnosis, User, Crop, Farm } = require('../models');
const { verifyToken } = require('../middleware/auth');
const router = express.Router();

// ==================== GET USER'S DIAGNOSES ====================
router.get('/my', verifyToken, async (req, res) => {
  try {
    const diagnoses = await Diagnosis.findAll({
      where: { user_id: req.user.id },
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, diagnoses });
  } catch (error) {
    console.error('Error fetching diagnoses:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== GET SINGLE DIAGNOSIS ====================
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const diagnosis = await Diagnosis.findByPk(req.params.id, {
      include: [{ model: User, as: 'farmer', attributes: ['id', 'name', 'email'] }]
    });
    if (!diagnosis) {
      return res.status(404).json({ success: false, message: 'Diagnosis not found' });
    }
    res.json({ success: true, diagnosis });
  } catch (error) {
    console.error('Error fetching diagnosis:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== AI DIAGNOSIS (no email) ====================
router.post('/analyze', verifyToken, async (req, res) => {
  const {
    crop_name,
    disease_name,
    confidence,
    confidence_score,
    organic_solution,
    chemical_solution,
    symptoms,
    prevention_tips,
    estimated_cost,
    image_url
  } = req.body;

  const finalConfidence = confidence_score || confidence;

  try {
    const diagnosis = await Diagnosis.create({
      user_id: req.user.id,
      crop_name,
      disease_name,
      confidence_score: finalConfidence,
      organic_solution,
      chemical_solution,
      symptoms,
      prevention_tips,
      estimated_cost,
      image_url,
      status: 'Pending'
    });

    // Email removed – no more diagnosis report email
    res.status(201).json({ success: true, diagnosis });
  } catch (error) {
    console.error('Diagnosis error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== UPDATE DIAGNOSIS STATUS (no email) ====================
router.put('/:id/status', verifyToken, async (req, res) => {
  const { status } = req.body;
  try {
    const diagnosis = await Diagnosis.findByPk(req.params.id);
    if (!diagnosis) {
      return res.status(404).json({ success: false, message: 'Diagnosis not found' });
    }
    await diagnosis.update({ status });
    // Email removed – no more status update email
    res.json({ success: true, diagnosis });
  } catch (error) {
    console.error('Status update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ==================== DELETE DIAGNOSIS ====================
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const diagnosis = await Diagnosis.findByPk(req.params.id);
    if (!diagnosis) {
      return res.status(404).json({ success: false, message: 'Diagnosis not found' });
    }
    await diagnosis.destroy();
    res.json({ success: true, message: 'Diagnosis deleted' });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
