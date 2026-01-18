/**
 * RIBH AI Messenger - Advanced Personalization Engine
 * 
 * Features:
 * - Deep cart analysis and customer segmentation
 * - Urgency/scarcity messaging
 * - Payment plan offers (تقسيط - Tabby/Tamara style)
 * - Alex Hormozi-style persuasion
 * - Multi-channel optimization (WhatsApp, SMS, Email, Telegram)
 */

// ==========================================
// CUSTOMER SEGMENTATION
// ==========================================

const CUSTOMER_SEGMENTS = {
    VIP: {
        minCartValue: 1000,
        discountRange: [15, 25],
        urgencyLevel: 'high',
        paymentPlanEligible: true,
        messageStyle: 'exclusive',
        emoji: '👑'
    },
    HIGH_VALUE: {
        minCartValue: 500,
        discountRange: [10, 15],
        urgencyLevel: 'high',
        paymentPlanEligible: true,
        messageStyle: 'premium',
        emoji: '🌟'
    },
    MEDIUM_VALUE: {
        minCartValue: 200,
        discountRange: [5, 10],
        urgencyLevel: 'medium',
        paymentPlanEligible: true,
        messageStyle: 'friendly',
        emoji: '💚'
    },
    PRICE_SENSITIVE: {
        minCartValue: 50,
        discountRange: [5, 10],
        urgencyLevel: 'low',
        paymentPlanEligible: false,
        messageStyle: 'value_focused',
        emoji: '🎁'
    },
    BROWSER: {
        minCartValue: 0,
        discountRange: [0, 5],
        urgencyLevel: 'low',
        paymentPlanEligible: false,
        messageStyle: 'nurture',
        emoji: '👋'
    }
};

// ==========================================
// URGENCY TACTICS
// ==========================================

const URGENCY_MESSAGES = {
    stock_low: [
        '⚠️ المخزون محدود!',
        '🔥 باقي {{stock}} قطع فقط!',
        '⏰ ينفد قريباً!'
    ],
    time_limited: [
        '⏰ العرض ينتهي خلال {{hours}} ساعات!',
        '🕐 آخر {{hours}} ساعات للخصم!',
        '⌛ الخصم ينتهي منتصف الليل!'
    ],
    high_demand: [
        '🔥 {{viewers}} شخص يشاهدون هذا المنتج الآن!',
        '📈 أكثر المنتجات مبيعاً هذا الأسبوع!',
        '💫 تم شراؤه {{purchases}} مرة اليوم!'
    ],
    last_chance: [
        '🚨 آخر فرصة!',
        '⚡ لا تفوّت الفرصة!',
        '🔔 تذكير أخير!'
    ],
    social_proof: [
        '⭐ تقييم {{rating}}/5 من {{reviews}} عميل',
        '💯 {{satisfaction}}% من العملاء راضون',
        '🏆 الأكثر مبيعاً في {{category}}'
    ]
};

// ==========================================
// PAYMENT PLAN MESSAGES (تقسيط)
// ==========================================

const PAYMENT_PLAN_CONFIG = {
    providers: ['تابي', 'تمارا'],
    minAmount: 200,
    maxAmount: 10000,
    installments: [3, 4, 6],
    noInterest: true
};

function calculatePaymentPlan(total, installments = 4) {
    if (total < PAYMENT_PLAN_CONFIG.minAmount) return null;

    const monthlyAmount = Math.ceil(total / installments);
    const firstPayment = total - (monthlyAmount * (installments - 1));

    return {
        total,
        installments,
        monthlyAmount,
        firstPayment,
        provider: PAYMENT_PLAN_CONFIG.providers[0],
        message: {
            short: `قسّط على ${installments} دفعات: ${monthlyAmount} ر.س/شهر`,
            detailed: `ادفع ${firstPayment} ر.س الآن، ثم ${monthlyAmount} ر.س × ${installments - 1} أشهر`,
            cta: `قسّط بدون فوائد مع ${PAYMENT_PLAN_CONFIG.providers[0]} 💳`
        }
    };
}

// ==========================================
// DEEP CART ANALYSIS
// ==========================================

function analyzeCartDeep(cart) {
    const total = cart.total || 0;
    const itemCount = cart.items?.length || 0;
    const currency = cart.currency || 'SAR';

    // Determine segment based on cart value
    let segment = 'BROWSER';
    if (total >= 1000) segment = 'VIP';
    else if (total >= 500) segment = 'HIGH_VALUE';
    else if (total >= 200) segment = 'MEDIUM_VALUE';
    else if (total >= 50) segment = 'PRICE_SENSITIVE';

    const segmentConfig = CUSTOMER_SEGMENTS[segment];

    // Calculate suggested discount (higher value = bigger discount worth it)
    const discountRange = segmentConfig.discountRange;
    const suggestedDiscount = Math.round(
        discountRange[0] + (Math.random() * (discountRange[1] - discountRange[0]))
    );

    // Calculate payment plan if eligible
    const paymentPlan = segmentConfig.paymentPlanEligible
        ? calculatePaymentPlan(total)
        : null;

    // Generate urgency tactics based on segment
    const urgencyTactics = generateUrgencyTactics(cart, segmentConfig);

    // Calculate potential savings for customer
    const potentialSavings = Math.round(total * (suggestedDiscount / 100));

    // Time-based urgency (hours since cart was abandoned)
    const hoursAbandoned = cart.createdAt
        ? Math.round((Date.now() - new Date(cart.createdAt).getTime()) / (1000 * 60 * 60))
        : 0;

    return {
        // Basic info
        segment,
        segmentConfig,
        total,
        itemCount,
        currency,

        // Discount strategy
        suggestedDiscount,
        discountCode: `RIBH${suggestedDiscount}`,
        potentialSavings,

        // Urgency
        urgencyLevel: segmentConfig.urgencyLevel,
        urgencyTactics,
        hoursAbandoned,

        // Payment plan
        paymentPlan,

        // Message style
        messageStyle: segmentConfig.messageStyle,
        emoji: segmentConfig.emoji,

        // Customer insights
        customerName: cart.customer?.name || 'عميلنا',
        hasEmail: !!cart.customer?.email,
        hasPhone: !!cart.customer?.phone,

        // Product insights
        highestPricedItem: getHighestPricedItem(cart.items),
        productCategories: extractCategories(cart.items)
    };
}

function generateUrgencyTactics(cart, segmentConfig) {
    const tactics = [];

    // Simulate stock urgency (in production, get real stock data)
    if (segmentConfig.urgencyLevel === 'high') {
        const randomStock = Math.floor(Math.random() * 5) + 2;
        tactics.push({
            type: 'stock_low',
            message: URGENCY_MESSAGES.stock_low[1].replace('{{stock}}', randomStock),
            priority: 1
        });
    }

    // Time-limited offer
    const hoursLeft = Math.floor(Math.random() * 12) + 6;
    tactics.push({
        type: 'time_limited',
        message: URGENCY_MESSAGES.time_limited[0].replace('{{hours}}', hoursLeft),
        priority: 2
    });

    // Social proof
    const viewers = Math.floor(Math.random() * 20) + 5;
    tactics.push({
        type: 'high_demand',
        message: URGENCY_MESSAGES.high_demand[0].replace('{{viewers}}', viewers),
        priority: 3
    });

    return tactics.sort((a, b) => a.priority - b.priority);
}

function getHighestPricedItem(items) {
    if (!items || !items.length) return null;
    return items.reduce((max, item) => {
        const price = item.price || item.total || 0;
        return price > (max?.price || 0) ? item : max;
    }, null);
}

function extractCategories(items) {
    if (!items || !items.length) return [];
    return [...new Set(items.map(item => item.category || 'عام').filter(Boolean))];
}

// ==========================================
// AI PROMPT BUILDER
// ==========================================

function buildAdvancedPrompt(cart, reminderNumber, analysis) {
    const isLastReminder = reminderNumber >= 3;

    // Alex Hormozi style personality
    const personalityPrompt = `أنت خبير مبيعات محترف على طريقة Alex Hormozi. قواعدك:
1. العنوان قصير ومباشر ومثير
2. ركّز على القيمة وليس السعر
3. اجعل العرض "غبي" بمعنى أنه لا يُرفض
4. أزل كل المخاطر من ذهن العميل
5. اختم بإجراء واضح وسهل`;

    const segmentStrategy = {
        VIP: `العميل VIP - قدّم له معاملة حصرية، اذكر أنه عميل مميز، العرض خاص له فقط`,
        HIGH_VALUE: `عميل عالي القيمة - ركّز على الجودة والحصرية، الخصم الكبير يستحق`,
        MEDIUM_VALUE: `عميل متوسط - وازن بين القيمة والسعر، اذكر التقسيط كميزة`,
        PRICE_SENSITIVE: `عميل حساس للسعر - ركّز على التوفير، الشحن المجاني، العرض المحدود`,
        BROWSER: `متصفح فقط - كن ودوداً، لا تضغط، ساعده في القرار`
    };

    let prompt = `${personalityPrompt}

===== معلومات العميل =====
- الاسم: ${analysis.customerName}
- قيمة السلة: ${analysis.total} ${analysis.currency}
- عدد المنتجات: ${analysis.itemCount}
- نوع العميل: ${analysis.segment}
- الوقت منذ ترك السلة: ${analysis.hoursAbandoned} ساعة

===== استراتيجية الرسالة =====
${segmentStrategy[analysis.segment]}

===== عناصر الإقناع المطلوبة =====
`;

    // Add discount info
    if (analysis.suggestedDiscount > 0) {
        prompt += `✅ الخصم: ${analysis.suggestedDiscount}% - كود: ${analysis.discountCode} (يوفر ${analysis.potentialSavings} ${analysis.currency})
`;
    }

    // Add payment plan if available
    if (analysis.paymentPlan) {
        prompt += `✅ التقسيط: ${analysis.paymentPlan.message.short}
`;
    }

    // Add urgency for later reminders
    if (reminderNumber >= 2 || analysis.urgencyLevel === 'high') {
        const urgencyTactic = analysis.urgencyTactics[0];
        prompt += `✅ الاستعجال: ${urgencyTactic?.message || 'العرض محدود!'}
`;
    }

    // Add scarcity for last reminder
    if (isLastReminder) {
        prompt += `✅ الندرة: هذه آخر رسالة - استخدم "آخر فرصة" و "ينتهي اليوم"
`;
    }

    // Channel-specific instructions
    prompt += `
===== نوع الرسالة =====
- رسالة رقم: ${reminderNumber} من 3
- القناة: واتساب/SMS
- الحد: أقل من 160 حرف للـ SMS، 250 حرف للواتساب

===== المطلوب =====
اكتب رسالة واحدة فقط، قصيرة ومؤثرة، بالعربية السعودية العامية.
استخدم إيموجي واحد أو اثنين فقط.
اذكر اسم العميل.
${analysis.suggestedDiscount > 0 ? `اذكر كود الخصم: ${analysis.discountCode}` : ''}
${analysis.paymentPlan ? `اذكر خيار التقسيط` : ''}

اكتب الرسالة مباشرة بدون مقدمات أو شرح:`;

    return prompt;
}

// ==========================================
// TEMPLATE MESSAGES (Fallback)
// ==========================================

function getAdvancedTemplate(cart, analysis, reminderNumber) {
    const name = analysis.customerName;
    const discount = analysis.suggestedDiscount;
    const code = analysis.discountCode;
    const savings = analysis.potentialSavings;
    const currency = analysis.currency;
    const emoji = analysis.emoji;

    const templates = {
        VIP: [
            // Reminder 1 - Exclusive attention
            `${name}، أنت عميل مميز عندنا ${emoji}\n\nسلتك محجوزة لك\n💎 خصم حصري ${discount}%\n\nكود: ${code}`,
            // Reminder 2 - Add urgency + payment plan
            `${name}، عرضك الخاص ينتهي قريباً! ⏰\n\n${discount}% خصم\n${analysis.paymentPlan ? analysis.paymentPlan.message.short : ''}\n\nكود: ${code}`,
            // Reminder 3 - Last chance + max value
            `${emoji} آخر فرصة يا ${name}!\n\nخصم ${discount}% = توفير ${savings} ${currency}\n${analysis.paymentPlan ? '+ تقسيط بدون فوائد!' : ''}\n\nينتهي العرض خلال ساعات!`
        ],
        HIGH_VALUE: [
            `مرحباً ${name}! ${emoji}\n\nمنتجاتك المميزة في الانتظار\nخصم خاص: ${discount}%\n\nكود: ${code}`,
            `${name}، لا تفوّت العرض! 🔥\n\n${discount}% خصم على سلتك\n${analysis.paymentPlan ? `قسّط على 4 دفعات!` : ''}\n\nكود: ${code}`,
            `⚡ يا ${name}، آخر تذكير!\n\nخصمك ${discount}% ينتهي اليوم\nوفّر ${savings} ${currency}!\n\nكود: ${code}`
        ],
        MEDIUM_VALUE: [
            `مرحباً ${name}! ${emoji}\n\nسلتك في انتظارك 🛒\n\nأكمل طلبك الآن`,
            `${name}، هدية لك! 🎁\n\n${discount}% خصم على طلبك\n${analysis.paymentPlan ? analysis.paymentPlan.message.short : ''}\n\nكود: ${code}`,
            `${name}، فرصتك الأخيرة! ⏰\n\n${discount}% خصم + ${analysis.paymentPlan ? 'تقسيط' : 'شحن مجاني'}!\n\nكود: ${code}`
        ],
        PRICE_SENSITIVE: [
            `${name}، سلتك محفوظة! ${emoji}\n\n🚚 شحن مجاني عليها!\n\nأكمل طلبك الآن`,
            `عرض خاص يا ${name}! 🎁\n\n${discount}% خصم = توفير ${savings} ${currency}\n\nكود: ${code}`,
            `⏰ ينتهي اليوم!\n\n${name}، ${discount}% خصم + شحن مجاني\n\nكود: ${code}`
        ],
        BROWSER: [
            `مرحباً ${name}! ${emoji}\n\nلاحظنا اهتمامك بمنتجاتنا\n\nهل تحتاج مساعدة؟`,
            `${name}، منتجاتك في الانتظار 🛒\n\nنحن هنا لمساعدتك!`,
            `${name}، هل تحتاج مساعدة في الطلب?\n\nتواصل معنا! 💬`
        ]
    };

    const segmentTemplates = templates[analysis.segment] || templates.BROWSER;
    return segmentTemplates[reminderNumber - 1] || segmentTemplates[0];
}

// ==========================================
// EMAIL TEMPLATE BUILDER
// ==========================================

function buildEmailHTML(cart, analysis, reminderNumber) {
    const name = analysis.customerName;
    const discount = analysis.suggestedDiscount;
    const code = analysis.discountCode;
    const savings = analysis.potentialSavings;
    const isLastReminder = reminderNumber >= 3;

    // Product list HTML
    const productListHtml = cart.items
        .map(item => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 12px 0;">
                    <strong>${item.name || item.product_name}</strong>
                    <br><span style="color: #666; font-size: 12px;">${item.quantity || 1}×</span>
                </td>
                <td style="padding: 12px 0; text-align: left;">
                    ${item.price || ''} ${analysis.currency}
                </td>
            </tr>
        `).join('');

    // Dynamic subject line
    const subjects = {
        1: `${name}، منتجاتك في الانتظار! 🛒`,
        2: `خصم ${discount}% خاص لك يا ${name}! 🎁`,
        3: `⚡ آخر فرصة! ${discount}% ينتهي اليوم`
    };

    // Urgency banner for later reminders
    const urgencyBanner = reminderNumber >= 2 ? `
        <div style="background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%); color: white; padding: 15px; text-align: center; border-radius: 8px; margin-bottom: 20px;">
            <strong>${isLastReminder ? '🚨 آخر فرصة!' : '⏰ عرض محدود!'}</strong>
            ${analysis.urgencyTactics[0]?.message || ''}
        </div>
    ` : '';

    // Payment plan section
    const paymentPlanSection = analysis.paymentPlan ? `
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <div style="font-size: 14px; margin-bottom: 8px;">💳 خيار التقسيط</div>
            <div style="font-size: 24px; font-weight: bold;">${analysis.paymentPlan.message.short}</div>
            <div style="font-size: 12px; margin-top: 8px; opacity: 0.9;">بدون فوائد مع ${analysis.paymentPlan.provider}</div>
        </div>
    ` : '';

    // Discount section
    const discountSection = discount > 0 ? `
        <div style="background: linear-gradient(135deg, #10B981 0%, #34D399 100%); color: white; padding: 25px; border-radius: 12px; margin: 20px 0; text-align: center;">
            <div style="font-size: 14px; margin-bottom: 8px;">🎁 خصم خاص لك</div>
            <div style="font-size: 48px; font-weight: bold;">${discount}%</div>
            <div style="font-size: 18px; margin-top: 8px;">توفير ${savings} ${analysis.currency}</div>
            <div style="background: rgba(255,255,255,0.2); padding: 10px; border-radius: 8px; margin-top: 15px;">
                <div style="font-size: 12px; margin-bottom: 5px;">كود الخصم</div>
                <div style="font-size: 24px; font-weight: bold; letter-spacing: 3px;">${code}</div>
            </div>
        </div>
    ` : '';

    const html = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subjects[reminderNumber]}</title>
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap');
            * { font-family: 'Tajawal', -apple-system, Arial, sans-serif; }
        </style>
    </head>
    <body style="margin: 0; padding: 0; background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%); min-height: 100vh;">
        <div style="max-width: 500px; margin: 0 auto; padding: 20px;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
                <div style="font-size: 36px; color: #10B981; font-weight: bold;">رِبح 💚</div>
                <div style="color: #888; font-size: 14px; margin-top: 8px;">استرجع مبيعاتك المفقودة</div>
            </div>
            
            <!-- Main Content -->
            <div style="background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.1);">
                ${urgencyBanner}
                
                <h1 style="color: #1a1a2e; font-size: 24px; margin: 0 0 15px 0;">
                    مرحباً ${name}! ${analysis.emoji}
                </h1>
                
                <p style="color: #666; font-size: 16px; line-height: 1.8;">
                    ${isLastReminder
            ? 'هذه آخر فرصة للحصول على عرضك الخاص! لا تفوّت الفرصة.'
            : 'لاحظنا أنك تركت بعض المنتجات الرائعة في سلتك. نحن هنا لمساعدتك!'}
                </p>
                
                <!-- Products Table -->
                <div style="background: #f9fafb; padding: 20px; border-radius: 12px; margin: 20px 0;">
                    <h3 style="margin: 0 0 15px 0; color: #1a1a2e;">🛒 منتجاتك المحجوزة</h3>
                    <table style="width: 100%; border-collapse: collapse;">
                        ${productListHtml}
                        <tr style="border-top: 2px solid #10B981;">
                            <td style="padding: 15px 0; font-weight: bold; font-size: 18px;">المجموع</td>
                            <td style="padding: 15px 0; text-align: left; font-weight: bold; font-size: 18px; color: #10B981;">
                                ${analysis.total} ${analysis.currency}
                            </td>
                        </tr>
                    </table>
                </div>
                
                ${discountSection}
                ${paymentPlanSection}
                
                <!-- CTA Button -->
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${cart.checkoutUrl || cart.storeUrl || '#'}" 
                       style="display: inline-block; background: linear-gradient(135deg, #10B981 0%, #34D399 100%); color: white; padding: 18px 40px; text-decoration: none; border-radius: 12px; font-weight: bold; font-size: 18px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);">
                        أكمل طلبك الآن 🛒
                    </a>
                </div>
                
                ${discount > 0 ? `
                <p style="text-align: center; color: #888; font-size: 14px;">
                    استخدم الكود <strong style="color: #10B981;">${code}</strong> عند الدفع
                </p>
                ` : ''}
            </div>
            
            <!-- Footer -->
            <div style="text-align: center; padding: 20px; color: #888; font-size: 12px;">
                <p>هذه الرسالة من رِبح - خدمة استرجاع السلات المتروكة</p>
                <p>لإلغاء الاشتراك، <a href="#" style="color: #10B981;">اضغط هنا</a></p>
            </div>
        </div>
    </body>
    </html>
    `;

    return {
        subject: subjects[reminderNumber],
        html
    };
}

// ==========================================
// MAIN EXPORT FUNCTIONS
// ==========================================

async function generateSmartMessage(cart, reminderNumber, aiGenerator = null) {
    // Deep analysis
    const analysis = analyzeCartDeep(cart);

    console.log('🧠 Advanced Cart Analysis:', {
        segment: analysis.segment,
        total: analysis.total,
        discount: analysis.suggestedDiscount,
        urgency: analysis.urgencyLevel,
        paymentPlan: analysis.paymentPlan ? 'Yes' : 'No'
    });

    // Build AI prompt
    const prompt = buildAdvancedPrompt(cart, reminderNumber, analysis);

    // Try AI generation if available
    let message = null;
    if (aiGenerator) {
        try {
            message = await aiGenerator(prompt);
        } catch (error) {
            console.error('❌ AI generation failed:', error.message);
        }
    }

    // Fallback to template
    if (!message) {
        message = getAdvancedTemplate(cart, analysis, reminderNumber);
    }

    return {
        message,
        analysis,
        discountCode: analysis.discountCode,
        discount: analysis.suggestedDiscount,
        paymentPlan: analysis.paymentPlan
    };
}

function generateEmailContent(cart, reminderNumber) {
    const analysis = analyzeCartDeep(cart);
    return buildEmailHTML(cart, analysis, reminderNumber);
}

// Export all functions
module.exports = {
    // Main functions
    generateSmartMessage,
    generateEmailContent,
    analyzeCartDeep,

    // Prompt builders
    buildAdvancedPrompt,

    // Templates
    getAdvancedTemplate,

    // Payment plans
    calculatePaymentPlan,
    PAYMENT_PLAN_CONFIG,

    // Segments & urgency
    CUSTOMER_SEGMENTS,
    URGENCY_MESSAGES
};
