// Load environment variables from .env file FIRST
require('dotenv').config();

const functions = require('firebase-functions');
const { app } = require('./server');

// =====================================================
// REGION CONFIGURATION - Saudi Arabia (europe-west1)
// =====================================================
const REGION = 'europe-west1';
const regionalFunctions = functions.region(REGION);

// =====================================================
// LIFECYCLE ENGINE V2 - The Brain of RIBH
// =====================================================
let lifecycleEngineV2;
try {
    lifecycleEngineV2 = require('./lib/lifecycleEngineV2');
    console.log('✅ LifecycleEngineV2 loaded - Full integration active!');
} catch (e) {
    console.log('⚠️ LifecycleEngineV2 not available:', e.message);
    lifecycleEngineV2 = null;
}

// Main API - handles all HTTP requests (deployed to europe-west1)
exports.api = regionalFunctions.https.onRequest(app);

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
exports.keepAlive = regionalFunctions.pubsub
    .schedule('every 5 minutes')
    .onRun(async (context) => {
        const startTime = Date.now();
        console.log('🔄 Keep-alive triggered at', new Date().toISOString());

        const results = {
            health: false,
            whatsapp: false,
            sequences: { processed: 0 }
        };

        try {
            // Get our own function URL
            const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_CONFIG
                ? JSON.parse(process.env.FIREBASE_CONFIG).projectId
                : 'ribh-8a479';

            const baseUrl = `https://${REGION}-${projectId}.cloudfunctions.net/api`;

            // Ping health endpoint
            const response = await fetch(`${baseUrl}/health`);
            const data = await response.json();
            results.health = true;

            console.log(`✅ Health check passed in ${Date.now() - startTime}ms:`, data);

            // Ping WhatsApp status to keep Baileys sessions warm
            try {
                await fetch(`${baseUrl}/api/whatsapp/connected`);
                results.whatsapp = true;
                console.log('✅ WhatsApp sessions pinged');
            } catch (e) {
                // WhatsApp endpoint might not exist yet, that's OK
            }

            // ==========================================
            // 🔥 PROCESS PENDING SEQUENCES! 
            // This is the KEY integration - runs every 5 minutes
            // ==========================================
            if (lifecycleEngineV2) {
                try {
                    results.sequences = await lifecycleEngineV2.processPendingStepsWithWhatsApp();
                    console.log(`📧 Sequences processed: ${results.sequences.processed}`);
                } catch (e) {
                    console.error('❌ Sequence processing error:', e.message);
                    results.sequences = { error: e.message };
                }
            }

            return { success: true, latencyMs: Date.now() - startTime, results };

        } catch (error) {
            console.error('❌ Keep-alive error:', error.message);
            return { success: false, error: error.message, results };
        }
    });

/**
 * Manual keep-alive trigger (for testing)
 * POST /api/keepalive/trigger
 */
exports.triggerKeepAlive = regionalFunctions.https.onRequest(async (req, res) => {
    console.log('🔄 Manual keep-alive triggered');

    // Same logic as scheduled
    const baseUrl = `https://${REGION}-ribh-8a479.cloudfunctions.net/api`;

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
