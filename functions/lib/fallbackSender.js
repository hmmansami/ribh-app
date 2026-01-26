/**
 * FALLBACK SENDER - Email + SNS SMS (cheap!)
 * 
 * Strategy: WhatsApp (QR Bridge) is PRIMARY → SNS SMS → Email FALLBACK
 * Amazon SNS: ~$0.01/SMS vs Twilio $0.05 = 80% savings!
 * 
 * Cost: Email $0 | SNS ~$0.01/SMS 🎉
 */
const { SENDGRID_KEY, EMAIL_FROM, RESEND_KEY, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION } = process.env;

/**
 * Send Email via SendGrid (FREE tier: 100/day)
 */
async function sendEmail(email, subject, body) {
  // Try SendGrid first
  if (SENDGRID_KEY) {
    return await sendViaSendGrid(email, subject, body);
  }
  
  // Fallback to Resend if configured
  if (RESEND_KEY) {
    return await sendViaResend(email, subject, body);
  }
  
  return { success: false, error: 'No email provider configured' };
}

async function sendViaSendGrid(email, subject, body) {
  const from = EMAIL_FROM || 'noreply@ribh.click';
  const isHtml = body.includes('<') && body.includes('>');

  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${SENDGRID_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email }] }],
        from: { email: from.includes('<') ? from.match(/<(.+)>/)?.[1] || from : from },
        subject,
        content: [{ type: isHtml ? 'text/html' : 'text/plain', value: body }]
      })
    });
    
    if (res.status === 202) return { success: true, provider: 'sendgrid' };
    return { success: false, error: (await res.text()) || `Status ${res.status}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

async function sendViaResend(email, subject, body) {
  const from = EMAIL_FROM || 'noreply@ribh.click';
  const isHtml = body.includes('<') && body.includes('>');

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${RESEND_KEY}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        from,
        to: email,
        subject,
        [isHtml ? 'html' : 'text']: body
      })
    });
    
    const data = await res.json();
    if (data.id) return { success: true, provider: 'resend', id: data.id };
    return { success: false, error: data.message || 'Resend error' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Format Saudi phone to E.164 (+966...)
 */
function formatSaudiPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('966')) return '+' + digits;
  if (digits.startsWith('0')) return '+966' + digits.slice(1);
  if (digits.startsWith('5')) return '+966' + digits;
  return '+' + digits; // assume already formatted
}

/**
 * Send SMS via Amazon SNS (~$0.01/msg to Saudi)
 */
async function sendSMS_SNS(phone, message) {
  if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
    return { success: false, error: 'AWS credentials not configured' };
  }
  try {
    const { SNSClient, PublishCommand } = require('@aws-sdk/client-sns');
    const client = new SNSClient({ region: AWS_REGION || 'me-south-1' });
    const result = await client.send(new PublishCommand({
      PhoneNumber: formatSaudiPhone(phone),
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' }
      }
    }));
    return { success: true, provider: 'sns', messageId: result.MessageId };
  } catch (e) {
    return { success: false, error: e.message, provider: 'sns' };
  }
}

/**
 * Send SMS - Uses Amazon SNS if configured (80% cheaper than Twilio!)
 */
async function sendSMS(phone, message) {
  // Try SNS if AWS creds exist
  if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
    return await sendSMS_SNS(phone, message);
  }
  console.warn('⚠️ SMS requires AWS credentials. Use WhatsApp as free alternative.');
  return { 
    success: false, 
    error: 'No SMS provider - set AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY for SNS',
    suggestion: 'Use WhatsApp QR Bridge for FREE unlimited messaging'
  };
}

/**
 * Send with fallback - WhatsApp → SNS SMS → Email
 * 
 * Recommended flow in your app:
 * 1. Try WhatsApp QR Bridge (FREE, 98% open rate)
 * 2. If WhatsApp fails, this tries SNS SMS (cheap!) then email
 */
async function sendWithFallback({ phone, email, message, subject, emailBody }) {
  // Try SNS SMS if phone provided and AWS configured
  if (phone && AWS_ACCESS_KEY_ID) {
    const sms = await sendSMS_SNS(phone, message);
    if (sms.success) return { channel: 'sms', success: true, provider: 'sns', messageId: sms.messageId };
    console.log('📱 SNS SMS failed:', sms.error, '- trying email...');
  }
  
  if (email) {
    const mail = await sendEmail(email, subject || 'رسالة من رِبح', emailBody || message);
    if (mail.success) return { channel: 'email', success: true, provider: mail.provider };
    return { channel: 'email', success: false, error: mail.error };
  }
  
  return { 
    channel: 'none', 
    success: false, 
    error: 'No contact method available. Set AWS creds for SMS or provide email.' 
  };
}

module.exports = { sendSMS, sendSMS_SNS, sendEmail, sendWithFallback };

/*
 * 💡 COST COMPARISON:
 * 
 * Twilio SMS:  $0.05/msg × 1000 = $50/month
 * Amazon SNS:  $0.01/msg × 1000 = $10/month  ← 80% savings!
 * WhatsApp:    FREE (QR Bridge)
 * 
 * Strategy: WhatsApp first → SNS SMS fallback → Email last
 * 
 * ENV vars needed for SNS:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_REGION=me-south-1 (Bahrain, closest to Saudi)
 */
