/**
 * EMAIL SENDER - Sends AI-generated offers via email
 * Uses Resend API (free 3000/month)
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'ribh@ribh.click';

/**
 * Send an AI-generated offer email
 */
async function sendOfferEmail(to, offer, context = {}) {
    if (!RESEND_API_KEY) {
        console.log('⚠️ Resend API key not configured, skipping email');
        return false;
    }

    if (!to) {
        console.log('⚠️ No email address provided');
        return false;
    }

    const { storeName = 'متجر رِبح', checkoutUrl = '#' } = context;

    const htmlContent = buildEmailHTML(offer, storeName, checkoutUrl);

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                to: to,
                subject: offer.headline,
                html: htmlContent
            })
        });

        const result = await response.json();

        if (result.id) {
            console.log(`✅ Email sent to ${to}: ${offer.headline}`);
            return true;
        } else {
            console.log(`❌ Email failed:`, result);
            return false;
        }
    } catch (error) {
        console.error('❌ Email error:', error.message);
        return false;
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
            
            <h1>${offer.headline}</h1>
            
            <p class="body-text">${offer.body}</p>
            
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
