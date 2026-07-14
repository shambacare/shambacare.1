const express = require('express');
const router = express.Router();
const axios = require('axios');

// GET /api/weather/:county
router.get('/:county', async (req, res) => {
    try {
        const county = req.params.county;
        const apiKey = process.env.WEATHER_API_KEY;

        if (!apiKey) {
            console.error('❌ WEATHER_API_KEY is not set');
            return res.status(500).json({
                success: false,
                error: 'Weather API key not configured on server'
            });
        }

        const url = `https://api.openweathermap.org/data/2.5/weather?q=${county},KE&appid=${apiKey}&units=metric`;
        const response = await axios.get(url, { timeout: 10000 });

        res.json(response.data);
    } catch (error) {
        console.error('Weather API error:', error.message);
        if (error.response) {
            res.status(error.response.status).json({
                success: false,
                error: error.response.data.message || 'Weather API error'
            });
        } else if (error.code === 'ECONNABORTED') {
            res.status(504).json({
                success: false,
                error: 'Weather service timeout'
            });
        } else {
            res.status(500).json({
                success: false,
                error: 'Failed to fetch weather data'
            });
        }
    }
});

module.exports = router;