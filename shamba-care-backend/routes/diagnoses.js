const express = require('express');
const { Diagnosis, User, Crop, Farm } = require('../models');
const { verifyToken } = require('../middleware/auth');
const { sendEmail } = require('../utils/email');
const router = express.Router();

// Get user's diagnoses
router.get('/my', verifyToken, async (req, res) => {
    try {
        const diagnoses = await Diagnosis.findAll({
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']],
            include: [{ model: Crop, as: 'crop' }]
        });
        res.json({ success: true, diagnoses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get single diagnosis
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const diagnosis = await Diagnosis.findByPk(req.params.id, {
            include: [{ model: User, as: 'farmer' }, { model: Crop, as: 'crop' }]
        });
        if (!diagnosis) {
            return res.status(404).json({ success: false, message: 'Diagnosis not found' });
        }
        res.json({ success: true, diagnosis });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// AI Diagnosis (with email report)
router.post('/analyze', verifyToken, async (req, res) => {
    const { crop_name, disease_name, confidence_score, organic_solution, chemical_solution, symptoms, prevention_tips, estimated_cost, image_url } = req.body;
    
    try {
        const diagnosis = await Diagnosis.create({
            user_id: req.user.id,
            crop_name,
            disease_name,
            confidence_score,
            organic_solution,
            chemical_solution,
            symptoms,
            prevention_tips,
            estimated_cost,
            image_url,
            status: 'Pending'
        });
        
        // Get user details for email
        const user = await User.findByPk(req.user.id);
        
        // Send email report to farmer
        await sendEmail({
            to: user.email,
            subject: `🌿 Your Crop Diagnosis Report - ${disease_name}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background: #1e3a5f; padding: 20px; text-align: center;">
                        <h2 style="color: #4ade80; margin: 0;">ShambaCare Diagnosis Report</h2>
                    </div>
                    <div style="background: #f9fafb; padding: 20px;">
                        <h2 style="color: #1e293b;">Hello ${user.name},</h2>
                        <p>Your crop diagnosis is complete. Here are the results:</p>
                        <div style="background: #e5e7eb; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <p><strong>🌾 Crop:</strong> ${crop_name}</p>
                            <p><strong>🦠 Disease:</strong> ${disease_name}</p>
                            <p><strong>📊 Confidence:</strong> ${confidence_score}%</p>
                            <p><strong>💰 Estimated Cost:</strong> KSh ${estimated_cost}</p>
                        </div>
                        <div style="margin: 15px 0;">
                            <h3>🔬 Symptoms:</h3>
                            <p>${symptoms}</p>
                        </div>
                        <div style="background: #dcfce7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <h3 style="color: #166534;">🌱 Organic Solution</h3>
                            <p>${organic_solution}</p>
                        </div>
                        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <h3 style="color: #1e40af;">⚗️ Chemical Solution</h3>
                            <p>${chemical_solution}</p>
                        </div>
                        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <h3 style="color: #92400e;">🛡️ Prevention Tips</h3>
                            <p>${prevention_tips}</p>
                        </div>
                        <a href="http://localhost:5500/diagnosis.html?id=${diagnosis.id}" style="background: #4ade80; color: #1e3a5f; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Full Report</a>
                        <hr>
                        <p style="color: #6b7280; font-size: 12px;">ShambaCare - Smart Farming Assistant</p>
                    </div>
                </div>
            `
        });
        
        res.status(201).json({ success: true, diagnosis });
    } catch (error) {
        console.error('Diagnosis error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Update diagnosis status (with email notification)
router.put('/:id/status', verifyToken, async (req, res) => {
    const { status } = req.body;
    try {
        const diagnosis = await Diagnosis.findByPk(req.params.id, {
            include: [{ model: User, as: 'farmer' }]
        });
        if (!diagnosis) {
            return res.status(404).json({ success: false, message: 'Diagnosis not found' });
        }
        
        await diagnosis.update({ status });
        
        // Send email when status changes
        if (diagnosis.farmer && diagnosis.farmer.email) {
            let statusMessage = '';
            if (status === 'Reviewed') {
                statusMessage = 'Your diagnosis has been reviewed by an expert.';
            } else if (status === 'Resolved') {
                statusMessage = 'Great news! Your crop issue has been resolved.';
            }
            
            await sendEmail({
                to: diagnosis.farmer.email,
                subject: `📋 Diagnosis Status Update - ${diagnosis.disease_name}`,
                html: `
                    <div style="font-family: Arial, sans-serif;">
                        <h2>Diagnosis Status Updated</h2>
                        <p>Hello ${diagnosis.farmer.name},</p>
                        <p>${statusMessage}</p>
                        <p><strong>Crop:</strong> ${diagnosis.crop_name}</p>
                        <p><strong>Disease:</strong> ${diagnosis.disease_name}</p>
                        <p><strong>Status:</strong> ${status}</p>
                        <a href="http://localhost:5500/diagnosis.html?id=${diagnosis.id}">View Details</a>
                    </div>
                `
            });
        }
        
        res.json({ success: true, diagnosis });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// Delete diagnosis
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const diagnosis = await Diagnosis.findByPk(req.params.id);
        if (!diagnosis) {
            return res.status(404).json({ success: false, message: 'Diagnosis not found' });
        }
        await diagnosis.destroy();
        res.json({ success: true, message: 'Diagnosis deleted' });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = router;