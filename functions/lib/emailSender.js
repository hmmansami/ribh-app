/**
 * EMAIL SENDER - Optimized for Deliverability
 * Uses Resend API (free 3000/month)
 * 
 * TO AVOID SPAM:
 * 1. Verify domain at https://resend.com/domains
 * 2. Add SPF record: v=spf1 include:amazonses.com ~all
 * 3. Add DKIM record from Resend dashboard
 * 4. Add DMARC record: v=DMARC1; p=none;
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || 'Ribh <noreply@ribh.click>';

/**
 * Send an AI-generated offer email - optimized for inbox delivery
 */
async function sendOfferEmail(to, offer, context = {}) {
    console.log('📧 Email sender starting...');
    console.log(`   API Key: ${RESEND_API_KEY ? RESEND_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
    console.log(`   From: ${EMAIL_FROM}`);
    console.log(`   To: ${to}`);

    if (!RESEND_API_KEY) {
        console.log('⚠️ Resend API key not configured');
        return { success: false, error: 'RESEND_API_KEY not configured' };
    }

    if (!to) {
        console.log('⚠️ No email address provided');
        return { success: false, error: 'No email address provided' };
    }

    const { storeName = 'متجرك', checkoutUrl = '#', customerName = '' } = context;
    const htmlContent = buildEmailHTML(offer, storeName, checkoutUrl, customerName);
    const textContent = buildTextEmail(offer, storeName, checkoutUrl, customerName);

    try {
        console.log('📤 Sending to Resend API...');

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: EMAIL_FROM,
                to: to,
                subject: offer.headline || 'لديك عرض خاص ينتظرك! 🎁',
                html: htmlContent,
                text: textContent, // Plain text version helps avoid spam
                headers: {
                    'X-Entity-Ref-ID': `ribh-${Date.now()}`, // Unique ID
                    'List-Unsubscribe': '<mailto:unsubscribe@ribh.click>'
                }
            })
        });

        const result = await response.json();
        console.log('📥 Resend response:', JSON.stringify(result));

        if (result.id) {
            console.log(`✅ Email sent! ID: ${result.id}`);
            return { success: true, id: result.id };
        } else {
            console.log(`❌ Email failed:`, result);
            return { success: false, error: result.message || 'Unknown error', details: result };
        }
    } catch (error) {
        console.error('❌ Email error:', error.message);
        return { success: false, error: error.message };
    }
}

// Plain text version (required for good deliverability)
function buildTextEmail(offer, storeName, checkoutUrl, customerName) {
    const greeting = customerName ? `مرحباً ${customerName}!` : 'مرحباً!';
    return `
${storeName}

${greeting}

${offer.headline || 'لديك عرض خاص!'}

${offer.body || 'لدينا عرض رائع ينتظرك'}

${offer.offer ? `العرض: ${offer.offer}` : ''}
${offer.urgency ? `⏰ ${offer.urgency}` : ''}

للاستفادة من العرض: ${checkoutUrl}

---
© ${new Date().getFullYear()} ${storeName}
للإلغاء الاشتراك راسلنا على unsubscribe@ribh.click
    `.trim();
}

// HTML version - clean and professional
function buildEmailHTML(offer, storeName, checkoutUrl, customerName) {
    const greeting = customerName ? `مرحباً ${customerName}! 👋` : 'مرحباً! 👋';

    const bonusesHtml = offer.bonuses?.length
        ? offer.bonuses.map(b => `<li style="margin: 8px 0; padding-right: 10px;">✅ ${b}</li>`).join('')
        : '';

    return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <title>${offer.headline || 'عرض خاص'}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5; direction: rtl;">
    
    <!-- Preheader text (shows in email preview) -->
    <div style="display: none; max-height: 0; overflow: hidden;">
        ${offer.body || 'لديك عرض خاص ينتظرك!'} - ${storeName}
    </div>
    
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                
                <!-- Main container -->
                <table role="presentation" style="max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 32px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                                ${storeName} 💚
                            </h1>
                        </td>
                    </tr>
                    
                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 32px;">
                            
                            <!-- Greeting -->
                            <p style="margin: 0 0 24px; color: #374151; font-size: 18px; font-weight: 600;">
                                ${greeting}
                            </p>
                            
                            <!-- Main headline -->
                            <h2 style="margin: 0 0 16px; color: #111827; font-size: 22px; font-weight: 700; line-height: 1.4;">
                                ${offer.headline || 'لديك عرض خاص! 🎁'}
                            </h2>
                            
                            <!-- Body text -->
                            <p style="margin: 0 0 28px; color: #6B7280; font-size: 16px; line-height: 1.8;">
                                ${offer.body || 'لاحظنا أنك تركت بعض المنتجات في سلتك. نحن هنا لمساعدتك!'}
                            </p>
                            
                            ${offer.offer ? `
                            <!-- Offer box -->
                            <table role="presentation" style="width: 100%; margin: 24px 0;">
                                <tr>
                                    <td style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 12px; padding: 24px; text-align: center;">
                                        <div style="color: #ffffff; font-size: 28px; font-weight: 800; margin-bottom: 8px;">
                                            ${offer.offer}
                                        </div>
                                        ${offer.discount ? `<div style="color: rgba(255,255,255,0.9); font-size: 14px;">خصم ${offer.discount}%</div>` : ''}
                                    </td>
                                </tr>
                            </table>
                            ` : ''}
                            
                            ${offer.urgency ? `
                            <!-- Urgency -->
                            <table role="presentation" style="width: 100%; margin: 20px 0;">
                                <tr>
                                    <td style="background: #FEF3C7; border-radius: 8px; padding: 14px; text-align: center;">
                                        <span style="color: #92400E; font-size: 14px; font-weight: 600;">
                                            ⏰ ${offer.urgency}
                                        </span>
                                    </td>
                                </tr>
                            </table>
                            ` : ''}
                            
                            ${bonusesHtml ? `
                            <!-- Bonuses -->
                            <table role="presentation" style="width: 100%; margin: 20px 0;">
                                <tr>
                                    <td style="background: #F0FDF4; border-radius: 12px; padding: 20px;">
                                        <div style="color: #10B981; font-weight: 700; margin-bottom: 12px;">🎁 هدايا إضافية:</div>
                                        <ul style="list-style: none; padding: 0; margin: 0; color: #374151;">${bonusesHtml}</ul>
                                    </td>
                                </tr>
                            </table>
                            ` : ''}
                            
                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; margin: 32px 0;">
                                <tr>
                                    <td style="text-align: center;">
                                        <a href="${checkoutUrl}" style="display: inline-block; background: #111827; color: #ffffff; padding: 18px 48px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 16px;">
                                            أكمل طلبك الآن 🚀
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background: #F9FAFB; padding: 24px 32px; text-align: center; border-top: 1px solid #E5E7EB;">
                            <p style="margin: 0 0 8px; color: #9CA3AF; font-size: 12px;">
                                تم إرسال هذا البريد بواسطة ${storeName}
                            </p>
                            <p style="margin: 0; color: #9CA3AF; font-size: 12px;">
                                © ${new Date().getFullYear()} جميع الحقوق محفوظة
                            </p>
                            <p style="margin: 12px 0 0; color: #9CA3AF; font-size: 11px;">
                                <a href="mailto:unsubscribe@ribh.click" style="color: #6B7280;">إلغاء الاشتراك</a>
                            </p>
                        </td>
                    </tr>
                    
                </table>
                
            </td>
        </tr>
    </table>
    
</body>
</html>
    `;
}

module.exports = {
    sendOfferEmail,
    buildEmailHTML,
    buildTextEmail
};
