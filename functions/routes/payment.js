/**
 * PAYMENT ROUTES
 *
 * One-click payment API for RIBH cart recovery.
 * Customer taps link in WhatsApp → sees cart → one tap → done.
 *
 * Routes:
 *   GET  /api/pay/:token        - Get cart data for payment page
 *   POST /api/pay/:token        - Complete payment
 *   GET  /api/pay/stats/:id     - Merchant recovery stats
 */

const express = require('express');
const router = express.Router();

let paymentTokens;
try {
    paymentTokens = require('../lib/paymentTokens');
} catch (e) {
    console.error('[Payment] Failed to load paymentTokens:', e.message);
}

/**
 * GET /api/pay/:token
 * Returns cart data for the one-click payment page
 */
router.get('/:token', async (req, res) => {
    try {
        const { token } = req.params;

        if (!paymentTokens) {
            return res.status(500).json({ success: false, error: 'Payment system unavailable' });
        }

        const data = await paymentTokens.validateToken(token);

        if (!data) {
            return res.status(404).json({
                success: false,
                error: 'expired',
                message: 'رابط الدفع منتهي الصلاحية',
            });
        }

        if (data.alreadyCompleted) {
            return res.status(200).json({
                success: true,
                completed: true,
                orderId: data.orderId,
                message: 'تم الدفع مسبقاً',
            });
        }

        // Return cart data for the payment page
        return res.status(200).json({
            success: true,
            cart: {
                items: data.items,
                originalTotal: data.originalTotal,
                discountedTotal: data.discountedTotal,
                discount: data.discount,
                discountCode: data.discountCode,
                currency: data.currency,
            },
            customer: {
                name: data.customer?.name || '',
                phone: data.customer?.phone || '',
                city: data.customer?.city || '',
            },
            expiresAt: data.expiresAt,
        });
    } catch (error) {
        console.error('[Payment] GET error:', error.message);
        return res.status(500).json({ success: false, error: 'حدث خطأ' });
    }
});

/**
 * POST /api/pay/:token
 * Complete the payment - one tap
 */
router.post('/:token', async (req, res) => {
    try {
        const { token } = req.params;
        const { paymentMethod, name, phone, city } = req.body;

        if (!paymentTokens) {
            return res.status(500).json({ success: false, error: 'Payment system unavailable' });
        }

        if (!paymentMethod) {
            return res.status(400).json({ success: false, error: 'اختر طريقة الدفع' });
        }

        const validMethods = ['apple_pay', 'mada', 'tamara', 'cod', 'stc_pay'];
        if (!validMethods.includes(paymentMethod)) {
            return res.status(400).json({ success: false, error: 'طريقة دفع غير صالحة' });
        }

        const customerInfo = {};
        if (name) customerInfo.name = name;
        if (phone) customerInfo.phone = phone;
        if (city) customerInfo.city = city;

        const result = await paymentTokens.completePayment(token, paymentMethod, customerInfo);

        if (!result.success) {
            const messages = {
                invalid_token: 'رابط الدفع غير صالح',
                already_completed: 'تم الدفع مسبقاً',
                expired: 'رابط الدفع منتهي الصلاحية',
            };
            return res.status(400).json({
                success: false,
                error: messages[result.error] || result.error,
            });
        }

        return res.status(200).json({
            success: true,
            orderId: result.orderId,
            total: result.total,
            currency: result.currency,
            paymentMethod: result.paymentMethod,
            message: 'تم تأكيد طلبك بنجاح!',
        });
    } catch (error) {
        console.error('[Payment] POST error:', error.message);
        return res.status(500).json({ success: false, error: 'حدث خطأ' });
    }
});

/**
 * GET /api/pay/stats/:merchantId
 * Get recovery stats for merchant dashboard
 */
router.get('/stats/:merchantId', async (req, res) => {
    try {
        if (!paymentTokens) {
            return res.status(500).json({ success: false, error: 'Payment system unavailable' });
        }

        const stats = await paymentTokens.getPaymentStats(req.params.merchantId);
        return res.status(200).json({ success: true, ...stats });
    } catch (error) {
        console.error('[Payment] Stats error:', error.message);
        return res.status(500).json({ success: false, error: 'حدث خطأ' });
    }
});

module.exports = router;
