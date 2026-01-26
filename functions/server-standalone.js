/**
 * RIBH Standalone Server for Render
 * No Firebase Functions dependency - runs as pure Express
 */
require('dotenv').config();
const { app } = require('./server');

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 RIBH API running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔗 WhatsApp Bridge: ${process.env.WHATSAPP_BRIDGE_URL || 'not configured'}`);
});
