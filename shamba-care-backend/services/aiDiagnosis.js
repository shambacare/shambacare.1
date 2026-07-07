const { Disease } = require('../models');
const { Op } = require('sequelize');

const fallbackDiagnosis = (cropType) => {
    const normalizedCrop = cropType?.toLowerCase().trim() || '';

    const diseases = {
        'maize': { name: 'Fall Armyworm', confidence: 88, organic: 'Apply neem oil spray (5ml/L water). Handpick larvae early morning.', chemical: 'Emamectin benzoate (1ml/L water)', symptoms: 'Holes in leaves, visible caterpillars, frass on leaves', cost: 500 },
        'corn': { name: 'Fall Armyworm', confidence: 88, organic: 'Apply neem oil spray (5ml/L water). Handpick larvae early morning.', chemical: 'Emamectin benzoate (1ml/L water)', symptoms: 'Holes in leaves, visible caterpillars, frass on leaves', cost: 500 },
        'coffee': { name: 'Coffee Leaf Rust', confidence: 85, organic: 'Prune affected leaves, improve air circulation. Apply sulfur spray.', chemical: 'Copper oxychloride (2g/L water)', symptoms: 'Orange-yellow powdery spots on leaves', cost: 800 },
        'potato': { name: 'Late Blight', confidence: 82, organic: 'Remove infected leaves, ensure good drainage. Apply copper spray.', chemical: 'Mancozeb (2g/L water) or chlorothalonil', symptoms: 'Dark, water-soaked lesions on leaves, white fungal growth under wet conditions', cost: 600 },
        'potatoes': { name: 'Late Blight', confidence: 82, organic: 'Remove infected leaves, ensure good drainage. Apply copper spray.', chemical: 'Mancozeb (2g/L water) or chlorothalonil', symptoms: 'Dark, water-soaked lesions on leaves, white fungal growth under wet conditions', cost: 600 },
        'tomato': { name: 'Early Blight', confidence: 83, organic: 'Remove affected leaves, mulch around plants. Apply compost tea.', chemical: 'Chlorothalonil or mancozeb', symptoms: 'Dark spots with concentric rings on lower leaves', cost: 550 },
        'tomatoes': { name: 'Early Blight', confidence: 83, organic: 'Remove affected leaves, mulch around plants. Apply compost tea.', chemical: 'Chlorothalonil or mancozeb', symptoms: 'Dark spots with concentric rings on lower leaves', cost: 550 },
        'beans': { name: 'Bean Rust', confidence: 84, organic: 'Prune affected leaves, improve air circulation', chemical: 'Copper-based fungicide', symptoms: 'Reddish-brown pustules on leaves', cost: 450 },
        'vegetables': { name: 'Aphids', confidence: 87, organic: 'Spray with neem oil or insecticidal soap. Introduce ladybugs.', chemical: 'Imidacloprid (follow label)', symptoms: 'Curled leaves, sticky residue, visible insects', cost: 300 }
    };

    const result = diseases[normalizedCrop] || diseases['maize'];
    return {
        success: true,
        disease: result.name,
        confidence: result.confidence,
        solution: result.organic,
        organic_solution: result.organic,
        chemical_solution: result.chemical,
        symptoms: result.symptoms,
        prevention_tips: '🌱 Prevention Tips:\n• Practice crop rotation every 2-3 years\n• Use certified disease-free seeds\n• Maintain proper spacing for air circulation\n• Monitor crops regularly for early detection\n• Remove crop residues after harvest\n• Use resistant varieties when available',
        estimated_cost: result.cost,
        source: 'ShambaCare Database'
    };
};

const getDiseaseInfo = async (diseaseName) => {
    try {
        const disease = await Disease.findOne({
            where: { name: { [Op.iLike]: `%${diseaseName}%` } }
        });
        if (disease) {
            return {
                name: disease.name,
                severity: disease.severity,
                symptoms: disease.symptoms,
                organic_solution: disease.organic_solution,
                chemical_solution: disease.chemical_solution,
                prevention_tips: disease.prevention_tips,
                estimated_cost: disease.estimated_cost_kes
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching disease info:', error);
        return null;
    }
};

module.exports = { fallbackDiagnosis, getDiseaseInfo };