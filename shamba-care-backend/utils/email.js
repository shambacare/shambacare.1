// utils/email.js
const axios = require('axios');

/**
 * Send email via Brevo API (direct HTTP request)
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML content of the email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendEmail({ to, subject, html }) {
    if (!process.env.BREVO_API_KEY) {
        console.error('❌ BREVO_API_KEY not set.');
        return { success: false, error: 'No API key' };
    }
    if (!to || !subject || !html) {
        return { success: false, error: 'Missing required fields' };
    }

    try {
        const response = await axios.post(
            'https://api.brevo.com/v3/smtp/email',
            {
                sender: {
                    name: 'ShambaCare',
                    email: process.env.FROM_EMAIL || 'shambacare2026@gmail.com'
                },
                to: [{ email: to }],
                subject: subject,
                htmlContent: html
            },
            {
                headers: {
                    'api-key': process.env.BREVO_API_KEY,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`✅ Email sent to ${to}`);
        return { success: true };
    } catch (error) {
        const errorMsg = error.response?.data?.message || error.message;
        console.error(`❌ Failed to send to ${to}:`, errorMsg);
        return { success: false, error: errorMsg };
    }
}

module.exports = { sendEmail };
