process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config({ override: true });

// Format phone number for display
const formatPhoneNumber = (phoneNumber) => {
    let cleaned = phoneNumber.toString().trim();
    
    if (cleaned.startsWith('+')) {
        return cleaned;
    }
    
    cleaned = cleaned.replace(/[^0-9]/g, '');
    
    if (cleaned.startsWith('0') && cleaned.length === 10) {
        return '+254' + cleaned.substring(1);
    }
    else if (cleaned.startsWith('254') && cleaned.length === 12) {
        return '+' + cleaned;
    }
    else if (cleaned.length === 9 && cleaned.startsWith('7')) {
        return '+254' + cleaned;
    }
    else {
        return '+254' + cleaned.replace(/^254/, '');
    }
};

// SIMULATED SMS - Logs to console instead of actually sending
const sendSMS = async (phoneNumber, message) => {
    try {
        const formattedNumber = formatPhoneNumber(phoneNumber);
        
        console.log('\n' + '='.repeat(60));
        console.log('📱 [SIMULATED SMS]');
        console.log('='.repeat(60));
        console.log(`📞 To: ${formattedNumber}`);
        console.log(`📝 Message: ${message}`);
        console.log(`✅ Status: Would be sent successfully`);
        console.log('='.repeat(60) + '\n');
        
        return { 
            success: true, 
            simulated: true, 
            message: `[SIMULATED] SMS would be sent to ${formattedNumber}`,
            phoneNumber: formattedNumber,
            messageContent: message
        };
    } catch (error) {
        console.error('❌ SMS simulation error:', error.message);
        return { success: false, error: error.message };
    }
};

// Send bulk SMS to multiple recipients (simulated)
const sendBulkSMS = async (phoneNumbers, message) => {
    try {
        console.log('\n' + '='.repeat(60));
        console.log(`📱 [SIMULATED BULK SMS] To ${phoneNumbers.length} recipients`);
        console.log('='.repeat(60));
        
        const results = [];
        for (const phone of phoneNumbers) {
            const formattedNumber = formatPhoneNumber(phone);
            results.push({ phone: formattedNumber, success: true });
            console.log(`   📞 ${formattedNumber}`);
        }
        console.log(`📝 Message: ${message.substring(0, 100)}...`);
        console.log(`✅ Status: Would be sent to ${phoneNumbers.length} farmers`);
        console.log('='.repeat(60) + '\n');
        
        return { 
            success: true, 
            simulated: true, 
            count: phoneNumbers.length,
            results
        };
    } catch (error) {
        console.error('❌ Bulk SMS simulation error:', error.message);
        return { success: false, error: error.message };
    }
};

// Send weather alert to farmers (simulated)
const sendWeatherAlert = async (county, weatherData) => {
    console.log('\n' + '='.repeat(60));
    console.log(`🌤️ [SIMULATED WEATHER ALERT]`);
    console.log('='.repeat(60));
    console.log(`📍 County: ${county}`);
    console.log(`📋 Subject: ${weatherData.subject}`);
    console.log(`📝 Message: ${weatherData.message}`);
    console.log(`✅ Status: Alert would be sent to farmers in ${county}`);
    console.log('='.repeat(60) + '\n');
    
    return { 
        success: true, 
        simulated: true, 
        county,
        subject: weatherData.subject,
        message: weatherData.message
    };
};

// Send disease outbreak alert (simulated)
const sendDiseaseAlert = async (crop, disease, region, message) => {
    console.log('\n' + '='.repeat(60));
    console.log(`🦠 [SIMULATED DISEASE ALERT]`);
    console.log('='.repeat(60));
    console.log(`🌽 Crop: ${crop}`);
    console.log(`🦟 Disease: ${disease}`);
    console.log(`📍 Region: ${region}`);
    console.log(`📝 Message: ${message}`);
    console.log(`✅ Status: Alert would be sent to farmers`);
    console.log('='.repeat(60) + '\n');
    
    return { 
        success: true, 
        simulated: true, 
        crop, 
        disease, 
        region, 
        message 
    };
};

// Send farming tip (simulated)
const sendFarmingTip = async (phoneNumber, tip) => {
    const formattedNumber = formatPhoneNumber(phoneNumber);
    
    console.log('\n' + '='.repeat(60));
    console.log(`💡 [SIMULATED FARMING TIP]`);
    console.log('='.repeat(60));
    console.log(`📞 To: ${formattedNumber}`);
    console.log(`💡 Tip: ${tip}`);
    console.log(`✅ Status: Would be sent to farmer`);
    console.log('='.repeat(60) + '\n');
    
    return { 
        success: true, 
        simulated: true, 
        phoneNumber: formattedNumber,
        tip
    };
};

// Send subscription reminder (simulated)
const sendSubscriptionReminder = async (phoneNumber, plan, daysLeft) => {
    const formattedNumber = formatPhoneNumber(phoneNumber);
    
    console.log('\n' + '='.repeat(60));
    console.log(`⏰ [SIMULATED SUBSCRIPTION REMINDER]`);
    console.log('='.repeat(60));
    console.log(`📞 To: ${formattedNumber}`);
    console.log(`📋 Plan: ${plan}`);
    console.log(`⏳ Days Left: ${daysLeft}`);
    console.log(`✅ Status: Reminder would be sent`);
    console.log('='.repeat(60) + '\n');
    
    return { 
        success: true, 
        simulated: true, 
        phoneNumber: formattedNumber,
        plan,
        daysLeft
    };
};

// Test SMS function (simulated)
const testSMS = async (phoneNumber) => {
    const formattedNumber = formatPhoneNumber(phoneNumber);
    const message = '🧪 ShambaCare Test Message: Your SMS integration is working in SIMULATED mode! To send real SMS, please configure your Africa\'s Talking API key.';
    
    console.log('\n' + '='.repeat(60));
    console.log(`🧪 [SIMULATED TEST SMS]`);
    console.log('='.repeat(60));
    console.log(`📞 To: ${formattedNumber}`);
    console.log(`📝 Message: ${message}`);
    console.log(`✅ Status: Test SMS would be sent`);
    console.log('='.repeat(60) + '\n');
    
    return { 
        success: true, 
        simulated: true, 
        message: `[SIMULATED] Test SMS would be sent to ${formattedNumber}`,
        note: "To send real SMS, configure your Africa's Talking API key in .env file"
    };
};

module.exports = {
    sendSMS,
    sendBulkSMS,
    sendWeatherAlert,
    sendDiseaseAlert,
    sendFarmingTip,
    sendSubscriptionReminder,
    testSMS,
    formatPhoneNumber
};