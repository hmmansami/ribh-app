#!/bin/bash
# WhatsApp Bridge Test Script
# Run this to install dependencies and test

echo "📦 Installing WhatsApp dependencies..."
cd /Users/user/Downloads/app/ribh-app/functions

# Install dependencies
npm install whatsapp-web.js qrcode

echo ""
echo "✅ Dependencies installed!"
echo ""
echo "To test WhatsApp Bridge:"
echo "1. Start the server: cd functions && npm run serve"
echo "2. Open browser to: http://localhost:3000/whatsapp"
echo "3. Scan the QR code with your WhatsApp"
echo ""
echo "Or test via API:"
echo "curl 'http://localhost:3000/api/whatsapp/connect?merchant=test123'"
