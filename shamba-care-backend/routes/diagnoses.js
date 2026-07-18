const express = require('express');
const { Diagnosis, User, Crop, Farm } = require('../models');
const { verifyToken } = require('../middleware/auth');
const { sendEmail } = require('../utils/email'); // now uses Brevo
const router = express.Router();

// ==================== GET USER'S DIAGNOSES ====================
router.get('/my', verifyToken, async (req, res) => {
    try {
        const diagnoses = await Diagnosis.findAll({
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']],
            // Removed include: Crop because diagnosis has crop_name, not crop_id
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
            include: [
                { model: User, as: 'farmer', attributes: ['id', 'name', 'email'] }
                // No Crop association – diagnosis stores crop_name as a string
            ]
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

// ==================== AI DIAGNOSIS (with email report) ====================
router.post('/analyze', verifyToken, async (req, res) => {
    // Accept both 'confidence' and 'confidence_score' for compatibility
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

    // Use confidence_score if provided, else fallback to confidence
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

        // Get user details for email
        const user = await User.findByPk(req.user.id);

        // Send email report to farmer via Brevo
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
                            <p><strong>📊 Confidence:</strong> ${finalConfidence}%</p>
                            <p><strong>💰 Estimated Cost:</strong> KSh ${estimated_cost || 'N/A'}</p>
                        </div>
                        <div style="margin: 15px 0;">
                            <h3>🔬 Symptoms:</h3>
                            <p>${symptoms || 'Not specified'}</p>
                        </div>
                        <div style="background: #dcfce7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <h3 style="color: #166534;">🌱 Organic Solution</h3>
                            <p>${organic_solution || 'Consult local agrovet'}</p>
                        </div>
                        <div style="background: #dbeafe; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <h3 style="color: #1e40af;">⚗️ Chemical Solution</h3>
                            <p>${chemical_solution || 'Consult local agrovet'}</p>
                        </div>
                        <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 15px 0;">
                            <h3 style="color: #92400e;">🛡️ Prevention Tips</h3>
                            <p>${prevention_tips || 'Practice crop rotation and good field hygiene'}</p>
                        </div>
                        <a href="https://shambacare-1.vercel.app/diagnosis.html?id=${diagnosis.id}" style="background: #4ade80; color: #1e3a5f; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Full Report</a>
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

// ==================== UPDATE DIAGNOSIS STATUS (with email notification) ====================
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
            } else {
                statusMessage = `Your diagnosis status has been updated to ${status}.`;
            }

            await sendEmail({
                to: diagnosis.farmer.email,
                subject: `📋 Diagnosis Status Update - ${diagnosis.disease_name || 'Crop Issue'}`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px;">
                        <div style="background: #1e3a5f; padding: 20px; text-align: center;">
                            <h2 style="color: #4ade80;">ShambaCare</h2>
                        </div>
                        <div style="padding: 20px;">
                            <h2>Diagnosis Status Updated</h2>
                            <p>Hello ${diagnosis.farmer.name},</p>
                            <p>${statusMessage}</p>
                            <p><strong>Crop:</strong> ${diagnosis.crop_name}</p>
                            <p><strong>Disease:</strong> ${diagnosis.disease_name || 'Pending'}</p>
                            <p><strong>Status:</strong> ${status}</p>
                            <a href="https://shambacare-1.vercel.app/diagnosis.html?id=${diagnosis.id}" style="background: #4ade80; color: #1e3a5f; padding: 10px 20px; text-decoration: none; border-radius: 5px;">View Details</a>
                            <hr>
                            <p style="color: #6b7280; font-size: 12px;">ShambaCare - Smart Farming Assistant</p>
                        </div>
                    </div>
                `
            });
        }

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
