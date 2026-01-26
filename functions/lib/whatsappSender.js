/**
 * WhatsApp Sender - Meta Cloud API with Rate Limiting
 * Env: WHATSAPP_TOKEN, WHATSAPP_PHONE_ID (or META_ prefixed)
 */
const TOKEN = process.env.WHATSAPP_TOKEN || process.env.META_WHATSAPP_TOKEN;
const PHONE_ID = process.env.WHATSAPP_PHONE_ID || process.env.META_PHONE_NUMBER_ID;
const API = `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`;
const rateLimits = new Map();
const RATE_LIMIT = 20, RATE_WINDOW = 3600000;

function formatPhone(phone) {
  let p = String(phone).replace(/\D/g, '');
  if (p.startsWith('0')) p = '966' + p.slice(1);
  if (p.length === 9) p = '966' + p;
  return p;
}

function checkRateLimit(phone) {
  const now = Date.now();
  let r = rateLimits.get(phone) || { count: 0, reset: now + RATE_WINDOW };
  if (now > r.reset) { r.count = 0; r.reset = now + RATE_WINDOW; }
  if (r.count >= RATE_LIMIT) return false;
  r.count++;
  rateLimits.set(phone, r);
  return true;
}

async function send(payload) {
  if (!TOKEN || !PHONE_ID) return { success: false, error: 'Not configured' };
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', ...payload })
    });
    const data = await res.json();
    if (data.error) return { success: false, error: data.error.message, code: data.error.code };
    return { success: true, messageId: data.messages?.[0]?.id };
  } catch (e) { return { success: false, error: e.message }; }
}

/** Send text message (works in 24h service window) */
async function sendMessage(phone, message) {
  const to = formatPhone(phone);
  if (!checkRateLimit(to)) return { success: false, error: 'Rate limit exceeded (20/hour)' };
  return send({ to, type: 'text', text: { preview_url: true, body: message } });
}

/** Send template (for marketing - needs Meta approval) */
async function sendTemplate(phone, templateName, params = {}) {
  const to = formatPhone(phone);
  if (!checkRateLimit(to)) return { success: false, error: 'Rate limit exceeded (20/hour)' };
  return send({
    to, type: 'template',
    template: { name: templateName, language: { code: params.language || 'ar' }, components: params.components || [] }
  });
}

/** Check remaining rate limit */
function getRateLimit(phone) {
  const to = formatPhone(phone), r = rateLimits.get(to), now = Date.now();
  if (!r || now > r.reset) return { remaining: RATE_LIMIT, reset: null };
  return { remaining: RATE_LIMIT - r.count, reset: new Date(r.reset).toISOString() };
}

module.exports = { sendMessage, sendTemplate, getRateLimit, formatPhone };
