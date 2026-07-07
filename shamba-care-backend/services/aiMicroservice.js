const axios = require('axios');
const FormData = require('form-data');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:5001/predict';
const CONFIDENCE_THRESHOLD = 60; // percent – below this, fall back to rule‑based system

const diagnoseWithMicroservice = async (imageBuffer, cropType) => {
    try {
        const formData = new FormData();
        formData.append('image', imageBuffer, {
            filename: 'leaf.jpg',
            contentType: 'image/jpeg'
        });
        formData.append('crop_type', cropType);

        console.log('🤖 Sending image to AI microservice...');

        const response = await axios.post(AI_SERVICE_URL, formData, {
            headers: { ...formData.getHeaders() },
            timeout: 30000
        });

        if (response.data && response.data.success) {
            const confidence = response.data.confidence;
            if (confidence >= CONFIDENCE_THRESHOLD) {
                console.log(`✅ AI diagnosis accepted: ${response.data.disease} (${confidence}%)`);
                return {
                    success: true,
                    disease: response.data.disease,
                    confidence: confidence,
                    organic_solution: response.data.organic_solution,
                    chemical_solution: response.data.chemical_solution,
                    symptoms: response.data.symptoms,
                    estimated_cost: response.data.estimated_cost,
                    prevention_tips: response.data.prevention_tips,
                    source: response.data.source
                };
            } else {
                console.log(`⚠️ AI confidence too low (${confidence}% < ${CONFIDENCE_THRESHOLD}%), falling back`);
                return null;
            }
        }
        return null;
    } catch (error) {
        console.error('❌ AI Microservice error:', error.message);
        return null;
    }
};

module.exports = { diagnoseWithMicroservice };