// utils/email.js
const Brevo = require('@getbrevo/brevo');

let brevoApiInstance = null;

if (process.env.BREVO_API_KEY) {
    try {
        const defaultClient = Brevo.ApiClient.instance;
        const apiKey = defaultClient.authentications['apiKey'];
        apiKey.apiKey = process.env.BREVO_API_KEY;
        brevoApiInstance = new Brevo.TransactionalEmailsApi();
        console.log('✅ Brevo email utility initialized');
    } catch (error) {
        console.error('❌ Failed to initialize Brevo:', error.message);
    }
} else {
    console.warn('⚠️ BREVO_API_KEY not set. Email sending will fail.');
}

/**
 * Send email via Brevo API
 * @param {Object} params
 * @param {string} params.to - Recipient email address
 * @param {string} params.subject - Email subject
 * @param {string} params.html - HTML content of the email
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendEmail({ to, subject, html }) {
    if (!process.env.BREVO_API_KEY || !brevoApiInstance) {
        console.error('❌ BREVO_API_KEY not set or Brevo not initialized.');
        return { success: false, error: 'No API key' };
    }
    if (!to || !subject || !html) {
        return { success: false, error: 'Missing required fields' };
    }
    try {
        const sendSmtpEmail = new Brevo.SendSmtpEmail();
        sendSmtpEmail.subject = subject;
        sendSmtpEmail.htmlContent = html;
        sendSmtpEmail.sender = {
            name: 'ShambaCare',
            email: process.env.FROM_EMAIL || 'shambacare2026@gmail.com'
        };
        sendSmtpEmail.to = [{ email: to }];
        await brevoApiInstance.sendTransacEmail(sendSmtpEmail);
        console.log(`✅ Email sent to ${to}`);
        return { success: true };
    } catch (error) {
        console.error(`❌ Failed to send to ${to}:`, error.message);
        return { success: false, error: error.message };
    }
}

module.exports = { sendEmail };
