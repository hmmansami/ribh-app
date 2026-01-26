/**
 * FALLBACK SENDER - Email only (SMS removed to save $$)
 * 
 * Strategy: WhatsApp (QR Bridge) is PRIMARY → Email is FALLBACK
 * SMS removed entirely - costs money, lower open rates
 * 
 * Cost: $0/month 🎉
 */
const { SENDGRID_KEY, EMAIL_FROM, RESEND_KEY } = process.env;

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
 * Send SMS - DEPRECATED (removed to save costs)
 * Use WhatsApp QR Bridge instead!
 */
async function sendSMS(phone, message) {
  console.warn('⚠️ SMS is disabled to save costs. Use WhatsApp instead.');
  return { 
    success: false, 
    error: 'SMS disabled - use WhatsApp QR Bridge for FREE unlimited messaging',
    suggestion: 'Call WhatsApp bridge at /ribh-whatsapp/'
  };
}

/**
 * Send with fallback - Email only (WhatsApp should be tried first elsewhere)
 * 
 * Recommended flow in your app:
 * 1. Try WhatsApp QR Bridge (FREE, 98% open rate)
 * 2. If WhatsApp fails, call this for email fallback
 */
async function sendWithFallback({ phone, email, message, subject, emailBody }) {
  // SMS intentionally skipped - costs money, use WhatsApp instead
  if (phone) {
    console.log('📱 Phone provided but SMS disabled. Use WhatsApp QR Bridge instead.');
  }
  
  if (email) {
    const mail = await sendEmail(email, subject || 'رسالة من رِبح', emailBody || message);
    if (mail.success) return { channel: 'email', success: true, provider: mail.provider };
    return { channel: 'email', success: false, error: mail.error };
  }
  
  return { 
    channel: 'none', 
    success: false, 
    error: 'No email provided. For phone, use WhatsApp QR Bridge.' 
  };
}

module.exports = { sendSMS, sendEmail, sendWithFallback };

/*
 * 💡 COST SAVINGS:
 * 
 * OLD: Twilio SMS at $0.05/msg × 1000 msgs = $50/month
 * NEW: WhatsApp QR Bridge = $0/month
 * 
 * SAVINGS: $50+/month
 * 
 * Plus WhatsApp has 98% open rate vs SMS 20%!
 */
