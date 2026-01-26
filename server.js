/**
 * RIBH API Server - Root entry point for Render
 * Loads the full server from functions/
 */
require('dotenv').config();

// Set up Firebase service account from env if present
if (process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const fs = require('fs');
    const path = require('path');
    const tmpPath = '/tmp/serviceAccount.json';
    fs.writeFileSync(tmpPath, process.env.FIREBASE_SERVICE_ACCOUNT);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tmpPath;
}

// Load the actual server from functions
const { app } = require('./functions/server');

const PORT = process.env.PORT || 3000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🚀 RIBH API Server running on port ${PORT}                   ║
║                                                               ║
║   Endpoints:                                                  ║
║   • Health:     /health                                       ║
║   • Webhooks:   /api/webhooks/salla                          ║
║   • WhatsApp:   /api/whatsapp/*                              ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});
