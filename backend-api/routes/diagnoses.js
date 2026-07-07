const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Diagnosis } = require('../models');
const { verifyToken, isAdmin } = require('../middleware/auth');
const { fallbackDiagnosis, getDiseaseInfo } = require('../services/aiDiagnosis');
const { diagnoseWithMicroservice } = require('../services/aiMicroservice');
const router = express.Router();

// Configure multer for image upload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/diagnoses/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Only image files are allowed'));
    }
});

// Analyze leaf image using AI microservice
router.post('/analyze', verifyToken, upload.single('image'), async (req, res) => {
    try {
        const { crop_name } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Image is required' });
        }
        
        if (!crop_name) {
            return res.status(400).json({ success: false, message: 'Crop name is required' });
        }
        
        const imagePath = req.file.path;
        const imageUrl = `/uploads/diagnoses/${req.file.filename}`;
        const imageBuffer = fs.readFileSync(imagePath);
        
        console.log(`📸 Analyzing image for ${crop_name} crop...`);
        
        // Try AI microservice first
        let aiResult = await diagnoseWithMicroservice(imageBuffer, crop_name);
        
        if (!aiResult || !aiResult.success) {
            console.log('⚠️ AI microservice failed, using fallback diagnosis');
            aiResult = fallbackDiagnosis(crop_name);
        }
        
        // Get detailed disease info from database
        const diseaseInfo = await getDiseaseInfo(aiResult.disease);
        
        // Ensure confidence is an integer (DB expects integer, not float)
        const confidenceInt = aiResult.confidence ? Math.round(aiResult.confidence) : null;
        
        // Save diagnosis to database
        const diagnosis = await Diagnosis.create({
            user_id: req.user.id,
            crop_name,
            disease_name: aiResult.disease,
            confidence_score: confidenceInt,
            image_url: imageUrl,
            recommended_solution: aiResult.solution || aiResult.organic_solution,
            symptoms: diseaseInfo?.symptoms || aiResult.symptoms,
            status: 'Pending'
        });
        
        console.log(`✅ Diagnosis saved with ID: ${diagnosis.id}`);
        
        res.json({
            success: true,
            diagnosis_id: diagnosis.id,
            diagnosis: {
                disease: aiResult.disease,
                confidence: aiResult.confidence,
                solution: aiResult.solution || aiResult.organic_solution,
                organic_solution: aiResult.organic_solution || aiResult.solution,
                chemical_solution: aiResult.chemical_solution,
                estimated_cost: aiResult.estimated_cost || 500,
                symptoms: diseaseInfo?.symptoms || aiResult.symptoms,
                severity: diseaseInfo?.severity || 'Medium',
                prevention_tips: diseaseInfo?.prevention_tips || aiResult.prevention_tips,
                source: aiResult.source || 'ShambaCare Database'
            }
        });
    } catch (error) {
        console.error('❌ Analysis failed:', error);
        res.status(500).json({ success: false, message: 'Analysis failed: ' + error.message });
    }
});

// Get user's diagnosis history
router.get('/my', verifyToken, async (req, res) => {
    try {
        const diagnoses = await Diagnosis.findAll({
            where: { user_id: req.user.id },
            order: [['created_at', 'DESC']]
        });
        
        res.json({ success: true, diagnoses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get all diagnoses (Admin only)
router.get('/all', verifyToken, isAdmin, async (req, res) => {
    try {
        const diagnoses = await Diagnosis.findAll({
            include: [{ association: 'farmer', attributes: ['name', 'email', 'phone'] }],
            order: [['created_at', 'DESC']]
        });
        res.json({ success: true, diagnoses });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update diagnosis status (Admin only)
router.put('/:id/status', verifyToken, isAdmin, async (req, res) => {
    const { status, admin_notes } = req.body;
    
    if (!status || !['Pending', 'Reviewed', 'Resolved'].includes(status)) {
        return res.status(400).json({ success: false, message: 'Invalid status' });
    }
    
    try {
        const diagnosis = await Diagnosis.findByPk(req.params.id);
        
        if (!diagnosis) {
            return res.status(404).json({ success: false, message: 'Diagnosis not found' });
        }
        
        await diagnosis.update({ status, admin_notes });
        res.json({ success: true, message: 'Diagnosis status updated' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete diagnosis (Admin only)
router.delete('/:id', verifyToken, isAdmin, async (req, res) => {
    try {
        const diagnosis = await Diagnosis.findByPk(req.params.id);
        
        if (!diagnosis) {
            return res.status(404).json({ success: false, message: 'Diagnosis not found' });
        }
        
        await diagnosis.destroy();
        res.json({ success: true, message: 'Diagnosis deleted' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;