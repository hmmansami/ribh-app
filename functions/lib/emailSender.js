/**
 * EMAIL SENDER - Sends AI-generated offers via email
 * Uses Resend API (free 3000/month)
 * 
 * IMPORTANT: For Resend to work:
 * 1. Get API key from https://resend.com/api-keys with FULL ACCESS
 * 2. Verify your domain at https://resend.com/domains
 * 3. Use verified domain in EMAIL_FROM (e.g., ribh@ribh.click)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'onboarding@resend.dev'; // Default to Resend test email

/**
 * Send an AI-generated offer email
 */
async function sendOfferEmail(to, offer, context = {}) {
    console.log('📧 Email sender starting...');
    console.log(`   API Key: ${RESEND_API_KEY ? RESEND_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
    console.log(`   From: ${EMAIL_FROM}`);
    console.log(`   To: ${to}`);

    if (!RESEND_API_KEY) {
        console.log('⚠️ Resend API key not configured, skipping email');
        return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    if (!to) {
        console.log('⚠️ No email address provided');
        return { success: false, error: 'No email address provided' };
    }

    const { storeName = 'متجر رِبح', checkoutUrl = '#' } = context;
    const htmlContent = buildEmailHTML(offer, storeName, checkoutUrl);

    try {
        console.log('📤 Sending request to Resend API...');

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                to: to,
                subject: offer.headline || 'رسالة من رِبح',
                html: htmlContent
            })
        });

        const result = await response.json();
        console.log('📥 Resend API response:', JSON.stringify(result));

        if (result.id) {
            console.log(`✅ Email sent successfully! ID: ${result.id}`);
            return { success: true, id: result.id };
        } else {
            console.log(`❌ Email failed:`, result);

            // Provide helpful error messages
            if (result.statusCode === 403) {
                console.log('💡 TIP: Check if your API key has FULL ACCESS permissions');
            }
            if (result.message?.includes('domain')) {
                console.log('💡 TIP: You need to verify your domain at https://resend.com/domains');
            }
            if (result.message?.includes('from')) {
                console.log('💡 TIP: Use onboarding@resend.dev for testing OR verify ribh.click domain');
            }

            return { success: false, error: result.message || 'Unknown error', details: result };
        }
    } catch (error) {
        console.error('❌ Email error:', error.message);
        return { success: false, error: error.message };
    }
}

function buildEmailHTML(offer, storeName, checkoutUrl) {
    const bonusesHtml = offer.bonuses?.length
        ? offer.bonuses.map(b => `<li style="margin: 5px 0;">✅ ${b}</li>`).join('')
        : '';

    return `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: -apple-system, Arial, sans-serif; background: #f5f5f5; padding: 20px; margin: 0; }
            .container { max-width: 500px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }
            .logo { text-align: center; font-size: 28px; color: #10B981; margin-bottom: 30px; font-weight: bold; }
            h1 { color: #1D1D1F; font-size: 24px; text-align: center; margin-bottom: 20px; }
            .body-text { color: #6B7280; font-size: 16px; line-height: 1.8; text-align: center; margin-bottom: 25px; }
            .offer-box { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 25px; border-radius: 16px; text-align: center; margin: 25px 0; }
            .offer-value { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
            .urgency { background: #FEF3C7; color: #92400E; padding: 12px; border-radius: 8px; text-align: center; font-size: 14px; margin: 20px 0; }
            .bonuses { background: #F0FDF4; padding: 20px; border-radius: 12px; margin: 20px 0; }
            .bonuses ul { list-style: none; padding: 0; margin: 0; }
            .btn { display: block; background: #1D1D1F; color: white; padding: 18px 30px; text-decoration: none; border-radius: 12px; font-weight: bold; text-align: center; font-size: 16px; }
            .footer { text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 30px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="logo">${storeName} 💚</div>
            
            <h1>${offer.headline || 'عرض خاص لك!'}</h1>
            
            <p class="body-text">${offer.body || 'لدينا عرض رائع ينتظرك'}</p>
            
            ${offer.offer ? `
            <div class="offer-box">
                <div class="offer-value">${offer.offer}</div>
                ${offer.discount ? `<div>خصم ${offer.discount}%</div>` : ''}
            </div>
            ` : ''}
            
            ${offer.urgency ? `
            <div class="urgency">
                ⏰ ${offer.urgency}
            </div>
            ` : ''}
            
            ${bonusesHtml ? `
            <div class="bonuses">
                <strong style="color: #10B981;">🎁 المكافآت:</strong>
                <ul>${bonusesHtml}</ul>
            </div>
            ` : ''}
            
            <a href="${checkoutUrl}" class="btn" style="color: white;">اطلب الآن 🚀</a>
            
            <div class="footer">
                تم إرسال هذا البريد بواسطة رِبح<br>
                © ${new Date().getFullYear()} جميع الحقوق محفوظة
            </div>
        </div>
    </body>
    </html>
    `;
}

module.exports = {
    sendOfferEmail,
    buildEmailHTML
};
