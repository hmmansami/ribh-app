/**
 * Campaign Generator - AI-powered personalized message generation
 *
 * Uses Hormozi's Value Equation:
 * Value = (Dream Outcome × Perceived Likelihood) / (Time Delay × Effort)
 *
 * For each customer type, we generate a message that:
 * 1. Addresses their specific situation
 * 2. Offers clear value
 * 3. Creates urgency
 * 4. Has ONE clear action
 */

const GROQ_API_KEY = process.env.GROQ_API_KEY;

// Message templates (fallback if AI fails)
const TEMPLATES = {
    cartRecovery: {
        ar: `مرحباً {name} 👋

لاحظنا إنك ما كملت طلبك!
سلتك لسا موجودة 🛒

{items}

المجموع: {value} ر.س

🎁 خصم 10% لو كملت الحين
الكود: RIBH10

{cartUrl}`,
        en: `Hi {name} 👋

You left items in your cart!
They're still waiting 🛒

{items}

Total: {value} SAR

🎁 10% off if you complete now
Code: RIBH10

{cartUrl}`
    },
    winback: {
        ar: `مرحباً {name} 👋

وحشتنا! 😊
مر وقت من آخر زيارة لك

عندنا جديد يناسبك ✨

خصم خاص لك: 15%
الكود: WELCOME15

{storeUrl}`,
        en: `Hi {name} 👋

We miss you! 😊
It's been a while since your last visit

We have new arrivals for you ✨

Special discount: 15%
Code: WELCOME15

{storeUrl}`
    },
    upsell: {
        ar: `مرحباً {name} 🎉

شكراً على طلبك الأخير!

عملاء اشتروا نفس المنتج أعجبهم أيضاً:
{recommendations}

خصم 10% على طلبك الجاي
الكود: THANKYOU10

{storeUrl}`,
        en: `Hi {name} 🎉

Thanks for your recent order!

Customers who bought the same also loved:
{recommendations}

10% off your next order
Code: THANKYOU10

{storeUrl}`
    },
    review: {
        ar: `مرحباً {name} ⭐

نتمنى عجبك طلبك!

رأيك يهمنا كثير 💚
30 ثانية من وقتك تفرق معنا

{reviewUrl}

شكراً لك!`,
        en: `Hi {name} ⭐

Hope you loved your order!

Your feedback means a lot 💚
30 seconds of your time makes a difference

{reviewUrl}

Thank you!`
    },
    codConfirm: {
        ar: `مرحباً {name} 📦

تم استلام طلبك #{orderId} ✅
المجموع: {value} ر.س

للتأكيد رد بـ:
1️⃣ = نعم، أكد الطلب
2️⃣ = لا، ألغِ الطلب

شكراً لثقتك!`,
        en: `Hi {name} 📦

Order #{orderId} received ✅
Total: {value} SAR

To confirm reply:
1️⃣ = Yes, confirm
2️⃣ = No, cancel

Thanks!`
    }
};

/**
 * Generate campaign messages for a list of customers
 * @param {string} campaignType - 'cartRecovery' | 'winback' | 'upsell' | 'review' | 'codConfirm'
 * @param {array} customers - Customer data from storeAnalyzer
 * @param {object} storeInfo - Store name, URL, etc.
 * @param {string} lang - 'ar' | 'en'
 * @returns {array} - Messages ready to send
 */
async function generateCampaign(campaignType, customers, storeInfo, lang = 'ar') {
    console.log(`[CampaignGenerator] Generating ${campaignType} for ${customers.length} customers`);

    const messages = [];

    for (const customer of customers) {
        try {
            const message = await generateMessage(campaignType, customer, storeInfo, lang);
            messages.push({
                phone: customer.phone,
                name: customer.name,
                message,
                customerId: customer.id,
                campaignType,
                value: customer.value || customer.estimatedValue || 0,
                generatedAt: new Date().toISOString()
            });
        } catch (e) {
            console.error(`[CampaignGenerator] Error for ${customer.phone}:`, e.message);
            // Use template as fallback
            const message = generateFromTemplate(campaignType, customer, storeInfo, lang);
            messages.push({
                phone: customer.phone,
                name: customer.name,
                message,
                customerId: customer.id,
                campaignType,
                value: customer.value || customer.estimatedValue || 0,
                generatedAt: new Date().toISOString(),
                fallback: true
            });
        }
    }

    return messages;
}

/**
 * Generate a single personalized message using AI
 */
async function generateMessage(campaignType, customer, storeInfo, lang) {
    // For simple cases, use templates (faster, cheaper)
    if (!GROQ_API_KEY || customers?.length > 50) {
        return generateFromTemplate(campaignType, customer, storeInfo, lang);
    }

    const prompts = {
        cartRecovery: `Generate a WhatsApp message to recover an abandoned cart.
Customer: ${customer.name}
Cart value: ${customer.value} SAR
Items: ${customer.items?.map(i => i.name).join(', ') || 'Various items'}
Hours since abandon: ${customer.hoursSinceAbandon || 24}
Store: ${storeInfo.name}`,

        winback: `Generate a WhatsApp message to reactivate a dormant customer.
Customer: ${customer.name}
Days since last order: ${customer.daysSinceOrder || 30}
Previous total spent: ${customer.totalSpent || 0} SAR
Store: ${storeInfo.name}`,

        upsell: `Generate a WhatsApp message for post-purchase upsell.
Customer: ${customer.name}
Recent purchase value: ${customer.lastOrderValue || customer.avgOrderValue || 100} SAR
Store: ${storeInfo.name}`
    };

    const systemPrompt = `You are a WhatsApp marketing expert for Saudi e-commerce.
Write in ${lang === 'ar' ? 'Arabic' : 'English'}.
Keep messages:
- Under 500 characters
- Friendly but not pushy
- 3rd grade reading level
- Include ONE emoji per sentence max
- End with a clear call to action
- Include a discount code when appropriate

Do not include placeholder text like [Store URL] - just say "رابط المتجر" or leave it for the system to fill.`;

    try {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${GROQ_API_KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama-3.1-8b-instant',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompts[campaignType] || prompts.winback }
                ],
                max_tokens: 300,
                temperature: 0.7
            })
        });

        if (!res.ok) {
            throw new Error(`Groq API ${res.status}: ${await res.text()}`);
        }

        const completion = await res.json();
        let message = completion.choices?.[0]?.message?.content || '';

        // Add store URL if not present
        if (storeInfo.url && !message.includes(storeInfo.url)) {
            message += `\n\n${storeInfo.url}`;
        }

        return message;

    } catch (e) {
        console.error(`[CampaignGenerator] AI error:`, e.message);
        return generateFromTemplate(campaignType, customer, storeInfo, lang);
    }
}

/**
 * Generate message from template (fallback)
 */
function generateFromTemplate(campaignType, customer, storeInfo, lang) {
    const template = TEMPLATES[campaignType]?.[lang] || TEMPLATES.winback[lang];

    let message = template
        .replace(/{name}/g, customer.name || 'عميل')
        .replace(/{value}/g, (customer.value || customer.estimatedValue || 0).toLocaleString())
        .replace(/{cartUrl}/g, customer.cartUrl || storeInfo.url || '')
        .replace(/{storeUrl}/g, storeInfo.url || '')
        .replace(/{reviewUrl}/g, storeInfo.reviewUrl || storeInfo.url || '')
        .replace(/{orderId}/g, customer.orderId || '---')
        .replace(/{recommendations}/g, '• منتجات مشابهة متوفرة');

    // Format items if present
    if (customer.items?.length) {
        const itemsList = customer.items
            .slice(0, 3)
            .map(i => `• ${i.name}`)
            .join('\n');
        message = message.replace(/{items}/g, itemsList);
    } else {
        message = message.replace(/{items}/g, '');
    }

    return message.trim();
}

/**
 * Generate all campaigns for a store analysis
 */
async function generateAllCampaigns(analysis, storeInfo, lang = 'ar') {
    const campaigns = {};

    // Cart Recovery (highest priority)
    if (analysis.abandonedCarts?.length > 0) {
        campaigns.cartRecovery = await generateCampaign(
            'cartRecovery',
            analysis.abandonedCarts,
            storeInfo,
            lang
        );
    }

    // Win-back (medium priority)
    if (analysis.dormantCustomers?.length > 0) {
        campaigns.winback = await generateCampaign(
            'winback',
            analysis.dormantCustomers,
            storeInfo,
            lang
        );
    }

    // Upsell (lower priority)
    if (analysis.recentBuyers?.length > 0) {
        campaigns.upsell = await generateCampaign(
            'upsell',
            analysis.recentBuyers,
            storeInfo,
            lang
        );
    }

    return campaigns;
}

/**
 * Preview what a campaign will look like (for UI)
 */
function previewCampaign(campaignType, sampleCustomer, storeInfo, lang = 'ar') {
    return {
        type: campaignType,
        sampleMessage: generateFromTemplate(campaignType, sampleCustomer, storeInfo, lang),
        audience: 0, // Will be filled by caller
        estimatedRevenue: 0 // Will be filled by caller
    };
}

module.exports = {
    generateCampaign,
    generateAllCampaigns,
    generateFromTemplate,
    previewCampaign,
    TEMPLATES
};
