/**
 * Test welcome email
 * Usage: RESEND_API_KEY=re_xxx node test-welcome-email.js test@example.com
 */
require('dotenv').config();
const { sendWelcomeEmail } = require('./lib/emailSender');

const testEmail = process.argv[2] || 'test@example.com';

async function test() {
    console.log('📧 Testing welcome email...');
    console.log(`   RESEND_API_KEY: ${process.env.RESEND_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   EMAIL_FROM: ${process.env.EMAIL_FROM || 'Not set'}`);
    console.log(`   To: ${testEmail}`);
    console.log('');
    
    const result = await sendWelcomeEmail({
        to: testEmail,
        merchantName: 'أحمد',
        storeName: 'متجر التجربة'
    });
    
    console.log('Result:', result);
}

test().catch(console.error);
