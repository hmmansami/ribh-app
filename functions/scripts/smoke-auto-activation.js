#!/usr/bin/env node

/**
 * Smoke checks for auto-activation hardening.
 * Fast static checks (no Firebase creds required).
 */

const fs = require('fs');
const path = require('path');

const serverPath = path.join(__dirname, '..', 'server.js');
const src = fs.readFileSync(serverPath, 'utf8');

const checks = [];

function check(name, condition, details) {
  checks.push({ name, ok: !!condition, details: details || '' });
}

check(
  'AUTO_ACTIVATION_ENABLED flag exists',
  src.includes("const AUTO_ACTIVATION_ENABLED = process.env.AUTO_ACTIVATION_ENABLED !== 'false';")
);

check(
  'WhatsApp status uses edge-trigger (wasConnected -> isConnectedNow)',
  src.includes('const wasConnected = whatsappActivationEdgeState.get(String(merchantId)) === true;') &&
    src.includes('const isConnectedNow = !!status?.connected;') &&
    src.includes('if (!wasConnected && isConnectedNow && isAutoActivationEnabled())') &&
    (
      src.includes('whatsappActivationEdgeState.set(String(merchantId), isConnectedNow);') ||
      src.includes('whatsappActivationEdgeState.set(String(merchantId), activationFailed ? false : isConnectedNow);')
    )
);

const activationRoutes = [
  "app.get('/api/activation/status', requireStoreAuth",
  "app.post('/api/activation/toggle', requireStoreAuth",
  "app.post('/api/activation/activate', requireStoreAuth",
  "app.get('/api/activation/ai-status', requireStoreAuth",
  "app.post('/api/activation/preview-offer', requireStoreAuth"
];

check(
  'All /api/activation/* endpoints are protected by requireStoreAuth',
  activationRoutes.every(route => src.includes(route))
);

const autoIdx = src.indexOf('autoActivation.processAbandonedCart');
const fallbackIdx = src.indexOf('lifecycleEngine.processEvent(event.event, event.merchant, event.data);');
check(
  'Webhook route order: autoActivation before lifecycle fallback',
  autoIdx !== -1 && fallbackIdx !== -1 && autoIdx < fallbackIdx,
  `autoIdx=${autoIdx}, fallbackIdx=${fallbackIdx}`
);

check(
  'Global disable is respected in activation endpoints',
  src.includes("return res.status(503).json({ success: false, error: 'Auto-activation disabled' });")
);

const failed = checks.filter(c => !c.ok);

for (const c of checks) {
  console.log(`${c.ok ? '✅' : '❌'} ${c.name}${c.details ? ` (${c.details})` : ''}`);
}

if (failed.length) {
  console.error(`\n${failed.length} check(s) failed.`);
  process.exit(1);
}

console.log('\nAll smoke checks passed.');
