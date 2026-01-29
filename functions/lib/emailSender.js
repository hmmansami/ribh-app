/**
 * Email Sender - Amazon SES
 * Cheaper + scalable
 */

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ 
  region: process.env.AWS_REGION || 'eu-west-1'
});

const EMAIL_FROM = process.env.EMAIL_FROM || 'ribh@ribh.click';

async function sendEmail({ to, subject, html, text }) {
  const params = {
    Source: EMAIL_FROM,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        Html: { Data: html, Charset: 'UTF-8' },
        Text: { Data: text || subject, Charset: 'UTF-8' }
      }
    }
  };

  try {
    const result = await ses.send(new SendEmailCommand(params));
    console.log(`✅ Email sent to ${to}:`, result.MessageId);
    return { success: true, messageId: result.MessageId };
  } catch (error) {
    console.error(`❌ Email failed to ${to}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function sendWelcomeEmail({ to, merchantName, storeName, merchantId, dashboardUrl }) {
  const subject = 'مرحباً بك في رِبح! 🎉 - أكمل الإعداد';
  
  // Use provided URLs or defaults with merchant ID
  const baseUrl = process.env.APP_URL || 'https://ribh.click';
  const setupLink = `${baseUrl}/setup.html?merchant=${merchantId || 'new'}`;
  const dashLink = dashboardUrl || `${baseUrl}/index.html?merchant=${merchantId || 'new'}`;
  
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;">
    <h1 style="color: #10B981; margin: 0;">مرحباً ${merchantName || 'بك'}! 🎉</h1>
    <p style="font-size: 18px; color: #333;">تم تفعيل رِبح على متجرك <strong>${storeName || ''}</strong> بنجاح!</p>
    
    <div style="background: #F0FDF4; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #10B981; margin: 0 0 10px 0;">📱 الخطوة التالية: ربط واتساب</h2>
      <p style="margin: 0 0 15px 0; color: #666;">اربط واتساب لإرسال رسائل استرداد السلات تلقائياً</p>
      <a href="${setupLink}" 
         style="display: inline-block; background: #10B981; color: white; padding: 15px 30px; 
                border-radius: 8px; text-decoration: none; font-size: 18px;">
        أكمل الإعداد ← (دقيقة واحدة)
      </a>
    </div>
    
    <div style="background: #f8f9fa; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #666;">
        📊 <a href="${dashLink}" style="color: #10B981;">الدخول إلى لوحة التحكم مباشرة</a>
      </p>
    </div>
    
    <h2 style="color: #333;">✨ ماذا ستحصل عليه:</h2>
    <ul style="font-size: 16px; color: #666; line-height: 2;">
      <li>🛒 استرداد 30% من السلات المتروكة</li>
      <li>📱 رسائل واتساب ذكية تلقائية</li>
      <li>📈 تقارير وإحصائيات مفصلة</li>
      <li>💰 زيادة المبيعات بدون جهد إضافي</li>
    </ul>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #888; font-size: 14px;">
      تحتاج مساعدة؟ تواصل معنا: 
      <a href="https://wa.me/966579353338" style="color: #10B981;">واتساب</a>
    </p>
  </div>
</body>
</html>`;

  const text = `مرحباً ${merchantName}! تم تفعيل رِبح على متجرك ${storeName} بنجاح!

📊 لوحة التحكم الخاصة بك: ${dashLink}

✨ ما يمكنك فعله:
- استرداد السلات المتروكة تلقائياً
- ربط الواتساب لإرسال رسائل ذكية
- متابعة الإحصائيات والأرباح

للمساعدة: واتساب 966579353338`;
  
  return sendEmail({ to, subject, html, text });
}

/**
 * Send merchant welcome email on OAuth install
 */
async function sendMerchantWelcomeEmail(merchantEmail, storeName) {
  if (!merchantEmail) {
    console.log('⚠️ No email provided for merchant welcome');
    return { success: false, error: 'No email provided' };
  }

  const subject = 'مرحباً في رِبح! 🎉 تم تفعيل حسابك';
  const baseUrl = process.env.APP_URL || 'https://ribh.click';
  
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <div style="text-align: center; margin-bottom: 30px;">
      <h1 style="color: #10B981; margin: 0; font-size: 32px;">🎉 مرحباً في رِبح!</h1>
      <p style="font-size: 18px; color: #333; margin-top: 10px;">تم تفعيل حسابك بنجاح</p>
    </div>
    
    <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 12px; padding: 25px; color: white; margin-bottom: 25px;">
      <h2 style="margin: 0 0 10px 0; font-size: 20px;">🏪 متجرك: ${storeName || 'متجرك'}</h2>
      <p style="margin: 0; opacity: 0.9;">أصبح متصلاً بنظام رِبح لاسترداد السلات المتروكة</p>
    </div>
    
    <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">📋 الخطوات القادمة:</h2>
    
    <div style="background: #F0FDF4; border-radius: 8px; padding: 20px; margin-bottom: 15px; border-right: 4px solid #10B981;">
      <h3 style="color: #10B981; margin: 0 0 8px 0;">1️⃣ ربط واتساب (مهم!)</h3>
      <p style="margin: 0; color: #666; font-size: 14px;">اربط رقم واتساب متجرك لإرسال رسائل استرداد تلقائية للعملاء</p>
    </div>
    
    <div style="background: #FEF3C7; border-radius: 8px; padding: 20px; margin-bottom: 15px; border-right: 4px solid #F59E0B;">
      <h3 style="color: #D97706; margin: 0 0 8px 0;">2️⃣ تخصيص الرسائل</h3>
      <p style="margin: 0; color: #666; font-size: 14px;">عدّل قوالب الرسائل لتناسب أسلوب متجرك وعملائك</p>
    </div>
    
    <div style="background: #EBF5FF; border-radius: 8px; padding: 20px; margin-bottom: 25px; border-right: 4px solid #3B82F6;">
      <h3 style="color: #2563EB; margin: 0 0 8px 0;">3️⃣ راقب النتائج</h3>
      <p style="margin: 0; color: #666; font-size: 14px;">تابع إحصائيات السلات المستردة والأرباح من لوحة التحكم</p>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${baseUrl}" 
         style="display: inline-block; background: #10B981; color: white; padding: 15px 40px; 
                border-radius: 8px; text-decoration: none; font-size: 18px; font-weight: bold;">
        🚀 ابدأ الآن
      </a>
    </div>
    
    <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; text-align: center;">
      <h3 style="color: #333; margin: 0 0 10px 0;">💬 تحتاج مساعدة؟</h3>
      <p style="margin: 0; color: #666;">
        تواصل معنا عبر واتساب: 
        <a href="https://wa.me/966579353338" style="color: #10B981; font-weight: bold;">966579353338</a>
      </p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    
    <p style="color: #888; font-size: 12px; text-align: center; margin: 0;">
      © رِبح - نظام استرداد السلات المتروكة الذكي
    </p>
  </div>
</body>
</html>`;

  const text = `مرحباً في رِبح! 🎉

تم تفعيل حسابك بنجاح!

متجرك: ${storeName || 'متجرك'}

الخطوات القادمة:
1. ربط واتساب - اربط رقم متجرك لإرسال رسائل استرداد تلقائية
2. تخصيص الرسائل - عدّل القوالب لتناسب أسلوب متجرك
3. راقب النتائج - تابع الإحصائيات من لوحة التحكم

ابدأ الآن: ${baseUrl}

تحتاج مساعدة؟ واتساب: 966579353338`;

  return sendEmail({ to: merchantEmail, subject, html, text });
}

/**
 * Send offer email (cart recovery, win-back, etc.)
 * Used by sequenceEngine.js
 */
async function sendOfferEmail(to, offer, context = {}) {
  const { storeName = 'متجر رِبح', checkoutUrl = '#' } = context;
  
  const subject = offer.headline || '🛒 عرض خاص لك!';
  
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;">
    <h1 style="color: #10B981; margin: 0;">${offer.headline || 'عرض خاص!'}</h1>
    
    <p style="font-size: 18px; color: #333; margin-top: 20px;">
      ${offer.body || offer.fullMessage || 'لديك عرض خاص في انتظارك!'}
    </p>
    
    ${offer.urgency ? `<p style="color: #EF4444; font-weight: bold;">${offer.urgency}</p>` : ''}
    ${offer.scarcity ? `<p style="color: #F59E0B;">${offer.scarcity}</p>` : ''}
    ${offer.bonus ? `<p style="color: #10B981;">${offer.bonus}</p>` : ''}
    ${offer.guarantee ? `<p style="color: #6B7280;">${offer.guarantee}</p>` : ''}
    
    ${offer.discount ? `
    <div style="background: #F0FDF4; border-radius: 8px; padding: 15px; margin: 20px 0; text-align: center;">
      <span style="font-size: 24px; color: #10B981; font-weight: bold;">خصم ${offer.discount}%</span>
    </div>
    ` : ''}
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${checkoutUrl}" 
         style="display: inline-block; background: #10B981; color: white; padding: 15px 40px; 
                border-radius: 8px; text-decoration: none; font-size: 18px; font-weight: bold;">
        ${offer.cta || 'أكمل طلبك الآن ←'}
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #888; font-size: 14px; text-align: center;">
      ${storeName} - نحن هنا لخدمتك 💚
    </p>
  </div>
</body>
</html>`;

  const text = `${offer.headline || 'عرض خاص!'}\n\n${offer.body || offer.fullMessage || ''}\n\n${checkoutUrl}`;
  
  return sendEmail({ to, subject, html, text });
}

module.exports = { sendEmail, sendWelcomeEmail, sendMerchantWelcomeEmail, sendOfferEmail };
