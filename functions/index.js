// Load environment variables from .env file FIRST
require('dotenv').config();

const functions = require('firebase-functions');
const { app } = require('./server');

// Main API - handles all HTTP requests
exports.api = functions.https.onRequest(app);

// =====================================================
// KEEP-ALIVE SCHEDULER (Self-ping every 5 minutes)
// Keeps WhatsApp sessions warm without external services
// =====================================================

/**
 * Scheduled function that runs every 5 minutes
 * - Pings our own health endpoint to prevent cold starts
 * - Keeps WhatsApp Baileys sessions alive
 * - No external cron service needed!
 * 
 * Cloud Scheduler: First 3 jobs FREE per Google account
 */
exports.keepAlive = functions.pubsub
    .schedule('every 5 minutes')
    .onRun(async (context) => {
        const startTime = Date.now();
        console.log('🔄 Keep-alive triggered at', new Date().toISOString());

        try {
            // Get our own function URL
            const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG
                ? JSON.parse(process.env.FIREBASE_CONFIG).projectId
                : 'ribh-8a479';

            const baseUrl = `https://us-central1-${projectId}.cloudfunctions.net/api`;

            // Ping health endpoint
            const response = await fetch(`${baseUrl}/health`);
            const data = await response.json();

            console.log(`✅ Health check passed in ${Date.now() - startTime}ms:`, data);

            // Also ping WhatsApp status to keep Baileys sessions warm
            try {
                await fetch(`${baseUrl}/api/whatsapp/connected`);
                console.log('✅ WhatsApp sessions pinged');
            } catch (e) {
                // WhatsApp endpoint might not exist yet, that's OK
            }

            return { success: true, latencyMs: Date.now() - startTime };

        } catch (error) {
            console.error('❌ Keep-alive error:', error.message);
            return { success: false, error: error.message };
        }
    });

/**
 * Manual keep-alive trigger (for testing)
 * POST /api/keepalive/trigger
 */
exports.triggerKeepAlive = functions.https.onRequest(async (req, res) => {
    console.log('🔄 Manual keep-alive triggered');

    // Same logic as scheduled
    const baseUrl = `https://us-central1-ribh-8a479.cloudfunctions.net/api`;

    try {
        const healthRes = await fetch(`${baseUrl}/health`);
        const data = await healthRes.json();

        res.json({
            success: true,
            message: 'Keep-alive ping successful',
            health: data,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});
