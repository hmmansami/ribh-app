#!/bin/bash
# Test Salla Abandoned Cart Webhook
# Simulates a Salla abandoned.cart webhook event

# Configuration
API_URL="${1:-https://europe-west1-ribh-484706.cloudfunctions.net/api}"
ENDPOINT="/webhooks/salla/cart"

# Test Data - Simulates a real Salla abandoned cart event
PAYLOAD='{
  "event": "abandoned.cart",
  "merchant": 12345678,
  "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'",
  "data": {
    "id": "test_cart_'$(date +%s)'",
    "cart_id": "cart_'$(date +%s)'",
    "customer": {
      "id": 987654,
      "name": "محمد أحمد",
      "first_name": "محمد",
      "last_name": "أحمد",
      "email": "test@example.com",
      "mobile": "+966501234567",
      "phone": "0501234567"
    },
    "items": [
      {
        "id": "prod_001",
        "product_id": "prod_001",
        "name": "قميص قطني أبيض",
        "quantity": 2,
        "price": {
          "amount": 150,
          "currency": "SAR"
        },
        "image": {
          "url": "https://cdn.salla.sa/image1.jpg"
        },
        "sku": "SHIRT-WHT-L"
      },
      {
        "id": "prod_002",
        "product_id": "prod_002",
        "name": "بنطلون جينز",
        "quantity": 1,
        "price": {
          "amount": 200,
          "currency": "SAR"
        },
        "image": {
          "url": "https://cdn.salla.sa/image2.jpg"
        },
        "sku": "JEANS-BLU-32"
      }
    ],
    "total": {
      "amount": 500,
      "currency": "SAR"
    },
    "currency": {
      "code": "SAR"
    },
    "checkout_url": "https://example.salla.sa/checkout/test123",
    "age_in_minutes": 30,
    "status": "abandoned",
    "created_at": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"
  }
}'

echo "🧪 Testing Salla Webhook..."
echo "📍 URL: ${API_URL}${ENDPOINT}"
echo "📦 Payload:"
echo "$PAYLOAD" | python3 -m json.tool 2>/dev/null || echo "$PAYLOAD"
echo ""
echo "📤 Sending request..."
echo ""

# Send the webhook
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${API_URL}${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "X-Salla-Signature: test-signature" \
  -H "User-Agent: Salla-Webhook/1.0" \
  -d "$PAYLOAD")

# Extract status code and body
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "📥 Response (HTTP $HTTP_CODE):"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ SUCCESS! Webhook processed correctly."
else
  echo "❌ FAILED! HTTP status: $HTTP_CODE"
fi
