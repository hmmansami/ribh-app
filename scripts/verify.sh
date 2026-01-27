#!/bin/bash
# 🔍 RIBH Quick Verification Script
# Run after any changes to verify everything works

echo "🔍 RIBH Verification"
echo "===================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        ((PASS++))
    else
        echo -e "${RED}❌ $1${NC}"
        ((FAIL++))
    fi
}

# 1. Syntax checks
echo ""
echo "📝 Syntax Checks..."
node --check functions/server.js 2>/dev/null
check "server.js syntax"

node --check functions/lib/emailSender.js 2>/dev/null
check "emailSender.js syntax"

# 2. Service health
echo ""
echo "🏥 Service Health..."
HEALTH=$(curl -s --max-time 10 https://ribh-app.onrender.com/health 2>/dev/null | grep -o '"status":"healthy"')
[ -n "$HEALTH" ]
check "RIBH App healthy"

WA=$(curl -s --max-time 10 https://ribh-whatsapp-1.onrender.com/ 2>/dev/null | grep -o '"service"')
[ -n "$WA" ]
check "WhatsApp Bridge running"

# 3. Key endpoints
echo ""
echo "🔗 Endpoint Checks..."
CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://ribh-app.onrender.com/)
[ "$CODE" = "200" ]
check "Landing page (HTTP $CODE)"

CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://ribh-app.onrender.com/onboarding.html)
[ "$CODE" = "200" ]
check "Onboarding page (HTTP $CODE)"

# 4. API endpoints
echo ""
echo "🔌 API Checks..."
WEBHOOK=$(curl -s --max-time 10 -X POST https://ribh-app.onrender.com/webhooks/salla \
    -H "Content-Type: application/json" \
    -d '{"event":"test","data":{}}' 2>/dev/null | grep -o '"success":true')
[ -n "$WEBHOOK" ]
check "Webhook endpoint"

# 5. WhatsApp QR
echo ""
echo "📱 WhatsApp QR..."
QR_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 https://ribh-whatsapp-1.onrender.com/qr/verify-test)
[ "$QR_CODE" = "200" ]
check "QR endpoint (HTTP $QR_CODE)"

# Summary
echo ""
echo "===================="
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some checks failed${NC}"
    exit 1
fi
