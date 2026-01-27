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

async function sendWelcomeEmail({ to, merchantName, storeName }) {
  const subject = 'مرحباً بك في رِبح! 🎉';
  
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="font-family: 'Segoe UI', Tahoma, sans-serif; background: #f5f5f5; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; padding: 30px;">
    <h1 style="color: #10B981; margin: 0;">مرحباً ${merchantName || 'بك'}! 🎉</h1>
    <p style="font-size: 18px; color: #333;">تم تفعيل رِبح على متجرك <strong>${storeName || ''}</strong> بنجاح!</p>
    
    <h2 style="color: #333;">الخطوة التالية:</h2>
    <p style="font-size: 16px; color: #666;">اربط الواتساب لبدء استرجاع السلات المتروكة تلقائياً</p>
    
    <a href="https://ribh-app.onrender.com/onboarding-v2.html" 
       style="display: inline-block; background: #10B981; color: white; padding: 15px 30px; 
              border-radius: 8px; text-decoration: none; font-size: 18px; margin: 20px 0;">
      ربط الواتساب الآن ←
    </a>
    
    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
    <p style="color: #888; font-size: 14px;">
      تحتاج مساعدة؟ تواصل معنا: 
      <a href="https://wa.me/966579353338" style="color: #10B981;">واتساب</a>
    </p>
  </div>
</body>
</html>`;

  const text = `مرحباً ${merchantName}! تم تفعيل رِبح على متجرك ${storeName}. الخطوة التالية: اربط الواتساب.`;
  
  return sendEmail({ to, subject, html, text });
}

module.exports = { sendEmail, sendWelcomeEmail };
