# Test Coverage Analysis & Improvement Plan

## Current State Summary

**Estimated coverage: ~5%** — 3 out of 54 backend modules have associated tests.

| Metric | Value |
|--------|-------|
| Total backend modules | 54 (50 lib + 2 routes + 2 webhooks) |
| Modules with tests | 3 (`messageQueue`, `replyDetector`, `sallaCart`) |
| Test files | 8 (+ 4 ad-hoc scripts) |
| Test lines of code | ~2,250 |
| Test framework | None — standalone Node.js scripts with custom assertions |
| CI/CD test step | None — `"test": "echo \"No tests yet\""` |

---

## What's Currently Tested

### Unit Tests (good quality, isolated)
- **`messageQueue.test.js`** — Rate limiting, phone formatting, queue timing, batch cooldowns (~25 assertions)
- **`replyDetector.test.js`** — Arabic/English sentiment detection, emoji handling (18 test cases)

### Integration Tests (manual execution, mock Firebase)
- **`fullFlowTest.js`** — E2E pipeline: Shopify/Salla cart detection, conversion tracking, channel fallback (WhatsApp -> SMS -> Email), seasonal offers, AI offer generation
- **`sallaCart.test.js`** — Webhook handler with signature verification

### Ad-hoc Scripts (require running server or API keys)
- `test-abandoned-cart-whatsapp.js` — Live WhatsApp bridge testing
- `test-salla-webhooks.js` — Phone normalization + webhook parsing
- `simulate-salla.js` — Webhook simulator with realistic Saudi test data
- `e2e-test.js` — Health check, webhook, offer generation endpoints

---

## Gap Analysis: What's NOT Tested

### Priority 1 — Critical Business Logic (revenue-impacting, high risk)

These modules directly affect cart recovery (the core revenue driver) and have zero test coverage:

| Module | Risk | Why it matters |
|--------|------|----------------|
| `sallaWebhooks.js` | **Critical** | Handles ALL Salla webhook events. A parsing bug silently drops abandoned carts. `normalizeSaudiPhone()` is tested ad-hoc but not in CI. Signature verification (`verifySallaSignature`) has no negative tests. |
| `cartDetection.js` | **Critical** | Detects cart abandonment (30-min inactivity). If `processAbandonedCarts()` miscalculates timing, carts are missed or double-processed. No edge case tests (empty carts, duplicate events, race conditions). |
| `antiBan.js` | **Critical** | Rate limiting protects merchants from WhatsApp bans. Warm-up schedule (day 1-7 limits), active hour enforcement, and block detection have no tests. A bug here gets merchant numbers banned. |
| `sequenceEngine.js` | **High** | Orchestrates multi-step journeys (WhatsApp -> Email -> SMS). Step timing, cancellation on conversion, and duplicate-send prevention are untested. |
| `lifecycleEngineV2.js` | **High** | Top-level orchestrator for all customer journeys. 29K+ lines. No tests at all. Calls into sequenceEngine, whatsappClient, emailSender, smsSender. |

**Recommendation:** These 5 modules should be the first to get proper unit tests. They represent the core abandoned cart -> recovery -> conversion pipeline. A regression in any of them directly costs revenue.

### Priority 2 — Security & Authentication (compliance risk)

| Module/Area | Risk | Gap |
|-------------|------|-----|
| Webhook signature verification | **Critical** | `verifySallaSignature()` and `verifyWebhook()` (Shopify) have no tests for tampered payloads, missing signatures, expired timestamps, or replay attacks. |
| `verifyStoreToken()` middleware | **High** | Auth middleware in server.js — no tests for expired tokens, missing cookies, forged tokens, or cross-store access. |
| HMAC timing-safe comparison | **Medium** | Using `crypto.timingSafeEqual` but no test verifies this isn't accidentally replaced with `===`. |

**Recommendation:** Add dedicated security-focused tests: malformed HMAC signatures, wrong secrets, missing headers, token expiry, and cross-tenant access attempts.

### Priority 3 — Communication Channels (user-facing, failure-prone)

| Module | Risk | Gap |
|--------|------|-----|
| `whatsappClient.js` | **High** | HTTP client to Render bridge — no tests for connection failures, timeout handling, retry logic, or message format validation. |
| `emailSender.js` | **Medium** | AWS SES integration — no tests for rate limits, bounce handling, or template rendering. |
| `smsSender.js` | **Medium** | AWS SNS + Twilio fallback — no tests verifying fallback triggers correctly when SNS fails. |
| `fallbackSender.js` | **High** | Multi-channel fallback logic (WhatsApp -> SMS -> Email) — the fallback chain is tested in `fullFlowTest.js` but only at the integration level. Unit tests for individual failure scenarios are missing. |

**Recommendation:** Mock external APIs (AWS SES/SNS, Twilio, WhatsApp bridge) and test: successful sends, transient failures with retry, permanent failures with fallback, rate limit responses, and malformed responses.

### Priority 4 — AI & Offer Generation (quality risk)

| Module | Risk | Gap |
|--------|------|-----|
| `offerGenerator.js` | **Medium** | AI offer generation via Groq — no tests for template fallbacks when API fails, seasonal offer selection, or discount percentage bounds. |
| `aiMessenger.js` | **Medium** | 23K+ lines of personalization logic — customer segmentation, urgency messaging, payment plans all untested. |
| `campaignGenerator.js` | **Medium** | Campaign message templates — no tests for template variable substitution or Arabic text handling. |

**Recommendation:** Test the fallback paths (AI API down -> template-based fallback). Validate offer discount bounds (never negative, never above configured max). Test Arabic text rendering in messages.

### Priority 5 — Analytics & Data Integrity

| Module | Risk | Gap |
|--------|------|-----|
| `predictiveAnalytics.js` | **Low** | CLV/churn calculations — incorrect predictions won't break the system but could mislead merchants. |
| `rfmSegmentation.js` | **Low** | RFM scoring — misclassification could target wrong customers with wrong offers. |
| `analyticsEngine.js` | **Low** | Dashboard aggregations — incorrect stats erode merchant trust. |
| `abTesting.js` | **Low** | A/B test winner selection — statistical errors could pick losing variants. |

---

## Infrastructure Gaps

### 1. No Test Framework

The `package.json` has `"test": "echo \"No tests yet\""`. Tests are standalone scripts with custom assertion functions (`assertEqual`, `assertTrue`).

**Impact:** No standardized test discovery, no parallel execution, no coverage reporting, no watch mode for development.

**Recommendation:** Adopt **Jest** (or Vitest). It's zero-config for Node.js, has built-in mocking (`jest.mock`), snapshot testing, and coverage reporting. Migrate existing custom assertions to `expect()`.

### 2. No CI/CD Test Step

The GitHub Actions workflow (`firebase-hosting.yml`) installs dependencies and deploys — but never runs tests. Broken code deploys automatically.

**Impact:** Any regression in webhook handling, phone normalization, or rate limiting goes live without detection.

**Recommendation:** Add a test job that runs before the deploy step. Fail the pipeline if tests fail.

### 3. No Test Fixtures / Shared Mocks

Each test file re-implements Firebase mocks (`mockFirestore`, `mockAdmin`). The Salla webhook test data is duplicated across `sampleWebhooks.json`, `simulate-salla.js`, and inline in test files.

**Impact:** Mock drift — if Firestore's API changes, each mock needs updating separately. Test data inconsistencies.

**Recommendation:** Create a `functions/test/helpers/` directory with shared mock factories (`createMockFirestore()`, `createMockWhatsApp()`) and fixture files for webhook payloads.

### 4. No Negative / Error Path Testing

Existing tests are almost entirely happy-path. Missing:
- Malformed webhook payloads (missing fields, wrong types)
- Network timeouts from external services
- Firestore write failures / quota exceeded
- Invalid phone number formats (non-Saudi, landlines, too short/long)
- Concurrent webhook events for the same cart
- Idempotency (same webhook delivered twice)

---

## Proposed Test Plan (Priority Order)

### Phase 1: Foundation

1. Install Jest as a dev dependency
2. Add `"test": "jest"` to `package.json`
3. Create shared mock helpers (`functions/test/helpers/mockFirebase.js`, `mockWhatsApp.js`)
4. Migrate `messageQueue.test.js` and `replyDetector.test.js` to Jest format
5. Add test step to GitHub Actions pipeline (run before deploy)

### Phase 2: Critical Path Tests

6. `sallaWebhooks.test.js` — Phone normalization (all formats + edge cases), signature verification (valid, tampered, missing, replay), cart/order event parsing
7. `antiBan.test.js` — Rate limits (per-hour, per-day), warm-up schedule, active hours, batch cooldowns, block detection
8. `cartDetection.test.js` — Abandonment timing (30 min threshold), duplicate cart handling, conversion marking, empty cart edge cases
9. `sequenceEngine.test.js` — Step creation/execution, cancellation on conversion, channel selection, timing delays
10. Auth middleware test — Token validation, expiry, missing cookie, cross-store access

### Phase 3: Channel & Integration Tests

11. `whatsappClient.test.js` — Connection states, send success/failure, retry behavior, phone format validation
12. `fallbackSender.test.js` — Full fallback chain, partial failures, all-channels-down scenario
13. `emailSender.test.js` — Template rendering, SES error handling
14. `offerGenerator.test.js` — API success, API failure fallback to templates, discount bounds, seasonal selection

### Phase 4: Hardening

15. Webhook idempotency tests (same event delivered twice)
16. Concurrent request tests (two cart.abandoned events for same cart)
17. `sallaCart.js` webhook handler — end-to-end with mocked dependencies
18. `sallaOrder.js` webhook handler — order status transitions

---

## Quick Wins (high value, low effort)

These can be done immediately without a test framework:

1. **Add `normalizeSaudiPhone()` edge case tests** — The function in `sallaWebhooks.js:37` is critical and already partially tested in `test-salla-webhooks.js`. Add cases for: empty string, `null`, non-numeric input, landline numbers, international non-Saudi numbers, numbers with spaces/dashes.

2. **Add signature verification negative tests** — Test `verifySallaSignature()` with wrong secret, empty body, modified payload.

3. **Add `antiBan.js` config boundary tests** — Verify rate limits at exactly the boundary (message 20 of 20/hour, message 100 of 100/day) and one over.

4. **Wire existing tests into npm** — Change `"test"` script to run the existing test files that don't require a running server: `node functions/lib/messageQueue.test.js && node functions/lib/replyDetector.test.js && node functions/test/fullFlowTest.js`
