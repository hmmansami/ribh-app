#!/usr/bin/env node
/**
 * 🧪 SALLA WEBHOOK SIMULATOR
 * 
 * Sends fake Salla webhook events to test RIBH locally.
 * Uses realistic Saudi test data (Arabic names, +966 phones, SAR prices).
 * 
 * USAGE:
 *   node simulate-salla.js order.created
 *   node simulate-salla.js order.updated:shipped
 *   node simulate-salla.js order.updated:delivered
 *   node simulate-salla.js cart.created
 *   node simulate-salla.js cart.abandoned
 *   node simulate-salla.js customer.created
 *   node simulate-salla.js all              # Full customer journey
 * 
 * OPTIONS:
 *   --url=http://...      Target URL (default: http://localhost:3000/salla/webhook)
 *   --delay=3000          Delay between events in 'all' mode (ms)
 *   --merchant=xxx        Custom merchant ID
 *   --verbose             Show full response bodies
 */

const https = require('https');
const http = require('http');

// ==========================================
// 🇸🇦 SAUDI TEST DATA POOL
// ==========================================

const SAUDI_NAMES = {
    firstNames: [
        // Male names
        'محمد', 'أحمد', 'عبدالله', 'خالد', 'فهد', 'سعود', 'ناصر', 'سلطان', 'بندر', 'تركي',
        'عمر', 'علي', 'يوسف', 'إبراهيم', 'عبدالرحمن', 'ماجد', 'راشد', 'سالم', 'مشعل', 'فيصل',
        // Female names
        'نورة', 'سارة', 'فاطمة', 'عائشة', 'مريم', 'هند', 'لطيفة', 'منى', 'ريم', 'دانة',
        'هيا', 'الجوهرة', 'موضي', 'شهد', 'غادة', 'أمل', 'نوف', 'وفاء', 'رنا', 'لمى'
    ],
    lastNames: [
        'العتيبي', 'القحطاني', 'الدوسري', 'الشمري', 'الحربي', 'المطيري', 'السبيعي', 'الغامدي',
        'الزهراني', 'العنزي', 'الشهري', 'المالكي', 'الرشيدي', 'الحازمي', 'البلوي', 'السهلي',
        'المحمدي', 'الأحمدي', 'السيد', 'الهاشمي', 'الشريف', 'الحسني', 'العلي', 'النصر'
    ]
};

const SAUDI_CITIES = [
    { name: 'الرياض', nameEn: 'Riyadh', region: 'منطقة الرياض' },
    { name: 'جدة', nameEn: 'Jeddah', region: 'منطقة مكة المكرمة' },
    { name: 'الدمام', nameEn: 'Dammam', region: 'المنطقة الشرقية' },
    { name: 'مكة المكرمة', nameEn: 'Makkah', region: 'منطقة مكة المكرمة' },
    { name: 'المدينة المنورة', nameEn: 'Madinah', region: 'منطقة المدينة المنورة' },
    { name: 'الطائف', nameEn: 'Taif', region: 'منطقة مكة المكرمة' },
    { name: 'تبوك', nameEn: 'Tabuk', region: 'منطقة تبوك' },
    { name: 'بريدة', nameEn: 'Buraidah', region: 'منطقة القصيم' },
    { name: 'خميس مشيط', nameEn: 'Khamis Mushait', region: 'منطقة عسير' },
    { name: 'أبها', nameEn: 'Abha', region: 'منطقة عسير' }
];

const PRODUCTS = [
    { name: 'عطر عود فاخر', nameEn: 'Premium Oud Perfume', price: 450, category: 'عطور' },
    { name: 'ساعة رجالية كلاسيك', nameEn: 'Classic Men Watch', price: 1200, category: 'ساعات' },
    { name: 'حقيبة يد نسائية', nameEn: 'Women Handbag', price: 380, category: 'حقائب' },
    { name: 'شماغ سعودي أصلي', nameEn: 'Saudi Shemagh', price: 150, category: 'ملابس' },
    { name: 'عباية مطرزة', nameEn: 'Embroidered Abaya', price: 650, category: 'ملابس' },
    { name: 'بخور دخون فاخر', nameEn: 'Premium Incense', price: 120, category: 'بخور' },
    { name: 'قهوة عربية مميزة', nameEn: 'Premium Arabic Coffee', price: 85, category: 'قهوة' },
    { name: 'تمر سكري ممتاز', nameEn: 'Premium Sukkari Dates', price: 95, category: 'تمور' },
    { name: 'عسل سدر أصلي', nameEn: 'Original Sidr Honey', price: 320, category: 'عسل' },
    { name: 'سجادة صلاة فاخرة', nameEn: 'Premium Prayer Rug', price: 180, category: 'إسلاميات' },
    { name: 'مبخرة كهربائية', nameEn: 'Electric Incense Burner', price: 250, category: 'بخور' },
    { name: 'دهن عود كمبودي', nameEn: 'Cambodian Oud Oil', price: 550, category: 'عطور' },
    { name: 'طقم قهوة عربية', nameEn: 'Arabic Coffee Set', price: 420, category: 'أواني' },
    { name: 'شنطة سفر جلد', nameEn: 'Leather Travel Bag', price: 890, category: 'حقائب' },
    { name: 'نظارة شمسية رجالية', nameEn: 'Men Sunglasses', price: 280, category: 'اكسسوارات' }
];

const STORE_NAMES = [
    'متجر الأناقة', 'بيت العود', 'سوق الذهب', 'دار الموضة', 'واحة التسوق',
    'بيت الطيب', 'متجر الرفاهية', 'سوق النخبة', 'دكان الأصالة', 'متجر السعادة'
];

// ==========================================
// 🎲 RANDOM DATA GENERATORS
// ==========================================

const random = {
    pick: (arr) => arr[Math.floor(Math.random() * arr.length)],
    int: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min,
    
    saudiPhone: () => {
        // Saudi mobile: 05X XXX XXXX
        const prefixes = ['50', '53', '54', '55', '56', '57', '58', '59'];
        const prefix = random.pick(prefixes);
        const number = String(random.int(1000000, 9999999));
        return `0${prefix}${number}`;
    },
    
    saudiName: () => {
        const first = random.pick(SAUDI_NAMES.firstNames);
        const last = random.pick(SAUDI_NAMES.lastNames);
        return { first, last, full: `${first} ${last}` };
    },
    
    email: (name) => {
        const domains = ['gmail.com', 'hotmail.com', 'outlook.sa', 'yahoo.com', 'icloud.com'];
        const clean = name.first.toLowerCase().replace(/[أإآ]/g, 'a').replace(/[ى]/g, 'y');
        return `${clean}${random.int(1, 999)}@${random.pick(domains)}`;
    },
    
    product: () => random.pick(PRODUCTS),
    city: () => random.pick(SAUDI_CITIES),
    storeName: () => random.pick(STORE_NAMES),
    
    cartItems: (count = null) => {
        const n = count || random.int(1, 4);
        const items = [];
        const usedProducts = new Set();
        
        for (let i = 0; i < n; i++) {
            let product;
            do {
                product = random.product();
            } while (usedProducts.has(product.name) && usedProducts.size < PRODUCTS.length);
            
            usedProducts.add(product.name);
            items.push({
                id: random.int(1000, 9999),
                product_id: random.int(10000, 99999),
                name: product.name,
                sku: `SKU-${random.int(10000, 99999)}`,
                quantity: random.int(1, 3),
                price: product.price,
                total: product.price * random.int(1, 3),
                thumbnail: `https://cdn.salla.sa/products/${random.int(1000, 9999)}.jpg`,
                category: product.category
            });
        }
        
        return items;
    },
    
    orderId: () => random.int(100000, 999999),
    cartId: () => random.int(10000, 99999),
    customerId: () => random.int(1000, 9999),
    merchantId: () => `merchant_${random.int(10000, 99999)}`
};

// ==========================================
// 📦 WEBHOOK PAYLOAD BUILDERS
// ==========================================

function buildBasePayload(eventType, merchantId) {
    return {
        event: eventType,
        merchant: merchantId || random.merchantId(),
        created_at: new Date().toISOString()
    };
}

function buildCustomerData(customerId = null) {
    const name = random.saudiName();
    const city = random.city();
    
    return {
        id: customerId || random.customerId(),
        first_name: name.first,
        last_name: name.last,
        name: name.full,
        mobile: random.saudiPhone(),
        mobile_code: '+966',
        email: random.email(name),
        gender: Math.random() > 0.5 ? 'male' : 'female',
        city: city.name,
        country: 'SA',
        country_code: 'SA',
        avatar: null,
        created_at: new Date().toISOString()
    };
}

function buildAddressData(customer) {
    const city = random.city();
    
    return {
        name: customer.name,
        phone: customer.mobile,
        email: customer.email,
        city: city.name,
        region: city.region,
        country: 'SA',
        country_code: 'SA',
        street: `شارع الملك فهد، حي ${random.pick(['العليا', 'الروضة', 'النهضة', 'السلام', 'الملز'])}`,
        postal_code: String(random.int(10000, 99999)),
        building_number: String(random.int(1, 999)),
        additional_info: ''
    };
}

function buildStoreData(merchantId) {
    return {
        id: merchantId,
        name: random.storeName(),
        domain: `store-${random.int(1000, 9999)}.salla.sa`,
        description: 'متجر سعودي متخصص في المنتجات الأصيلة',
        logo: `https://cdn.salla.sa/stores/${merchantId}/logo.png`,
        url: `https://store-${random.int(1000, 9999)}.salla.sa`
    };
}

// ==========================================
// 🛒 CART.CREATED / CART.ABANDONED
// ==========================================

function buildCartPayload(options = {}) {
    const merchantId = options.merchantId || random.merchantId();
    const cartId = options.cartId || random.cartId();
    const customer = buildCustomerData(options.customerId);
    const items = random.cartItems(options.itemCount);
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const eventType = options.abandoned ? 'cart.abandoned' : 'cart.created';
    
    return {
        ...buildBasePayload(eventType, merchantId),
        data: {
            id: cartId,
            cart_id: cartId,
            customer: customer,
            items: items,
            products: items, // Salla sometimes uses 'products'
            total: total,
            sub_total: total,
            grand_total: total + 15, // +15 shipping
            currency: { code: 'SAR', name: 'ريال سعودي' },
            checkout_url: `https://store-${random.int(1000, 9999)}.salla.sa/cart/checkout/${cartId}`,
            recovery_url: `https://store-${random.int(1000, 9999)}.salla.sa/cart/recover/${cartId}`,
            store: buildStoreData(merchantId),
            created_at: new Date(Date.now() - (options.abandoned ? 3600000 : 0)).toISOString(),
            ...(options.abandoned && { abandoned_at: new Date().toISOString() })
        }
    };
}

// ==========================================
// 💰 ORDER.CREATED
// ==========================================

function buildOrderCreatedPayload(options = {}) {
    const merchantId = options.merchantId || random.merchantId();
    const orderId = options.orderId || random.orderId();
    const customer = buildCustomerData(options.customerId);
    const items = options.items || random.cartItems();
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const shipping = 15;
    const total = subtotal + shipping;
    
    return {
        ...buildBasePayload('order.created', merchantId),
        data: {
            id: orderId,
            order_id: orderId,
            reference_id: `ORD-${orderId}`,
            
            customer: customer,
            
            items: items,
            
            amounts: {
                sub_total: { amount: subtotal, currency: 'SAR' },
                shipping: { amount: shipping, currency: 'SAR' },
                total: { amount: total, currency: 'SAR' },
                discount: { amount: 0, currency: 'SAR' }
            },
            
            total: total,
            sub_total: subtotal,
            grand_total: total,
            
            currency: { code: 'SAR', name: 'ريال سعودي' },
            
            status: { 
                id: 1, 
                name: 'pending',
                name_ar: 'قيد الانتظار',
                customized_name: 'قيد المعالجة'
            },
            
            payment_method: random.pick(['bank_transfer', 'credit_card', 'mada', 'apple_pay', 'stc_pay', 'tabby']),
            
            shipping_address: buildAddressData(customer),
            billing_address: buildAddressData(customer),
            
            cart_id: options.cartId || random.cartId(),
            
            notes: '',
            
            urls: {
                customer: `https://store.salla.sa/orders/${orderId}`,
                admin: `https://s.salla.sa/orders/${orderId}`
            },
            
            store: buildStoreData(merchantId),
            
            date: { 
                date: new Date().toISOString(),
                timezone_type: 3,
                timezone: 'Asia/Riyadh'
            },
            
            created_at: new Date().toISOString()
        }
    };
}

// ==========================================
// 📦 ORDER.UPDATED (Shipped/Delivered)
// ==========================================

function buildOrderUpdatedPayload(options = {}) {
    const merchantId = options.merchantId || random.merchantId();
    const orderId = options.orderId || random.orderId();
    const customer = buildCustomerData(options.customerId);
    
    // Status mapping
    const statuses = {
        shipped: { id: 4, name: 'shipped', name_ar: 'تم الشحن' },
        delivered: { id: 5, name: 'delivered', name_ar: 'تم التوصيل' },
        canceled: { id: 6, name: 'canceled', name_ar: 'ملغي' },
        refunded: { id: 7, name: 'refunded', name_ar: 'مسترجع' }
    };
    
    const newStatus = statuses[options.status] || statuses.shipped;
    const oldStatus = options.status === 'delivered' ? statuses.shipped : { id: 1, name: 'pending', name_ar: 'قيد الانتظار' };
    
    return {
        ...buildBasePayload('order.updated', merchantId),
        data: {
            id: orderId,
            order_id: orderId,
            reference_id: `ORD-${orderId}`,
            
            customer: customer,
            
            status: newStatus,
            old_status: oldStatus,
            
            total: options.total || random.int(200, 2000),
            grand_total: options.total || random.int(200, 2000),
            
            currency: { code: 'SAR', name: 'ريال سعودي' },
            
            // Shipping info for shipped/delivered
            ...(options.status === 'shipped' && {
                shipment: {
                    company: random.pick(['أرامكس', 'سمسا', 'DHL', 'زاجل', 'ناقل']),
                    tracking_number: `TRK${random.int(1000000000, 9999999999)}`,
                    tracking_url: `https://tracking.aramex.com/shipments/${random.int(1000000000, 9999999999)}`
                }
            }),
            
            store: buildStoreData(merchantId),
            
            updated_at: new Date().toISOString()
        }
    };
}

// ==========================================
// 👤 CUSTOMER.CREATED
// ==========================================

function buildCustomerCreatedPayload(options = {}) {
    const merchantId = options.merchantId || random.merchantId();
    const customer = buildCustomerData(options.customerId);
    
    return {
        ...buildBasePayload('customer.created', merchantId),
        data: {
            ...customer,
            store: buildStoreData(merchantId)
        }
    };
}

// ==========================================
// 🚀 HTTP SENDER
// ==========================================

async function sendWebhook(url, payload) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const isHttps = urlObj.protocol === 'https:';
        const lib = isHttps ? https : http;
        
        const data = JSON.stringify(payload);
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (isHttps ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'X-Salla-Signature': 'test_signature_12345',
                'User-Agent': 'Salla-Webhook/1.0'
            }
        };
        
        const req = lib.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    body: body,
                    headers: res.headers
                });
            });
        });
        
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

// ==========================================
// 🎯 CLI RUNNER
// ==========================================

async function main() {
    const args = process.argv.slice(2);
    
    // Parse options
    let targetUrl = 'http://localhost:3000/salla/webhook';
    let delay = 3000;
    let merchantId = null;
    let verbose = false;
    let eventArg = 'all';
    
    for (const arg of args) {
        if (arg.startsWith('--url=')) {
            targetUrl = arg.split('=')[1];
        } else if (arg.startsWith('--delay=')) {
            delay = parseInt(arg.split('=')[1]);
        } else if (arg.startsWith('--merchant=')) {
            merchantId = arg.split('=')[1];
        } else if (arg === '--verbose' || arg === '-v') {
            verbose = true;
        } else if (!arg.startsWith('--')) {
            eventArg = arg;
        }
    }
    
    console.log('\n🧪 SALLA WEBHOOK SIMULATOR');
    console.log('═'.repeat(50));
    console.log(`📍 Target: ${targetUrl}`);
    console.log(`📦 Event:  ${eventArg}`);
    console.log('═'.repeat(50) + '\n');
    
    // Track IDs for consistency in 'all' mode
    const sharedData = {
        merchantId: merchantId || random.merchantId(),
        customerId: random.customerId(),
        cartId: random.cartId(),
        orderId: random.orderId(),
        items: random.cartItems(2)
    };
    
    async function sendAndLog(eventType, payload) {
        const startTime = Date.now();
        process.stdout.write(`📤 Sending ${eventType}... `);
        
        try {
            const result = await sendWebhook(targetUrl, payload);
            const elapsed = Date.now() - startTime;
            
            if (result.statusCode >= 200 && result.statusCode < 300) {
                console.log(`✅ ${result.statusCode} (${elapsed}ms)`);
            } else {
                console.log(`⚠️  ${result.statusCode} (${elapsed}ms)`);
            }
            
            if (verbose) {
                try {
                    const parsed = JSON.parse(result.body);
                    console.log('   Response:', JSON.stringify(parsed, null, 2));
                } catch {
                    console.log('   Response:', result.body.substring(0, 200));
                }
            }
            
            return result;
        } catch (error) {
            console.log(`❌ Error: ${error.message}`);
            return null;
        }
    }
    
    // Single event handling
    const eventHandlers = {
        'cart.created': () => buildCartPayload({ 
            merchantId: sharedData.merchantId,
            customerId: sharedData.customerId,
            cartId: sharedData.cartId
        }),
        
        'cart.abandoned': () => buildCartPayload({ 
            merchantId: sharedData.merchantId,
            customerId: sharedData.customerId,
            cartId: sharedData.cartId,
            abandoned: true
        }),
        
        'order.created': () => buildOrderCreatedPayload({ 
            merchantId: sharedData.merchantId,
            customerId: sharedData.customerId,
            orderId: sharedData.orderId,
            cartId: sharedData.cartId,
            items: sharedData.items
        }),
        
        'order.updated:shipped': () => buildOrderUpdatedPayload({ 
            merchantId: sharedData.merchantId,
            customerId: sharedData.customerId,
            orderId: sharedData.orderId,
            status: 'shipped'
        }),
        
        'order.updated:delivered': () => buildOrderUpdatedPayload({ 
            merchantId: sharedData.merchantId,
            customerId: sharedData.customerId,
            orderId: sharedData.orderId,
            status: 'delivered'
        }),
        
        'order.updated:canceled': () => buildOrderUpdatedPayload({ 
            merchantId: sharedData.merchantId,
            customerId: sharedData.customerId,
            orderId: sharedData.orderId,
            status: 'canceled'
        }),
        
        'customer.created': () => buildCustomerCreatedPayload({ 
            merchantId: sharedData.merchantId,
            customerId: sharedData.customerId
        })
    };
    
    // Handle 'all' - Full customer journey
    if (eventArg === 'all') {
        console.log('🎬 Running full customer journey...\n');
        console.log(`   Merchant: ${sharedData.merchantId}`);
        console.log(`   Customer: ${sharedData.customerId}`);
        console.log(`   Cart:     ${sharedData.cartId}`);
        console.log(`   Order:    ${sharedData.orderId}\n`);
        
        const journey = [
            { event: 'customer.created', label: '1️⃣  New customer registers' },
            { event: 'cart.created', label: '2️⃣  Customer adds items to cart' },
            { event: 'cart.abandoned', label: '3️⃣  Cart is abandoned (1hr later)' },
            { event: 'order.created', label: '4️⃣  Customer completes purchase!' },
            { event: 'order.updated:shipped', label: '5️⃣  Order shipped' },
            { event: 'order.updated:delivered', label: '6️⃣  Order delivered' }
        ];
        
        for (const step of journey) {
            console.log(`\n${step.label}`);
            const handler = eventHandlers[step.event];
            if (handler) {
                const payload = handler();
                await sendAndLog(step.event, payload);
            }
            
            // Wait between steps
            if (step !== journey[journey.length - 1]) {
                process.stdout.write(`   ⏳ Waiting ${delay}ms...`);
                await new Promise(r => setTimeout(r, delay));
                console.log(' done\n');
            }
        }
        
        console.log('\n' + '═'.repeat(50));
        console.log('✅ Full journey completed!');
        console.log('═'.repeat(50) + '\n');
        
    } else {
        // Single event
        const handler = eventHandlers[eventArg];
        
        if (!handler) {
            console.log(`❌ Unknown event: ${eventArg}\n`);
            console.log('Available events:');
            Object.keys(eventHandlers).forEach(e => console.log(`  - ${e}`));
            console.log('  - all (full journey)\n');
            process.exit(1);
        }
        
        const payload = handler();
        
        console.log('📦 Payload Preview:');
        console.log('   Event:', payload.event);
        console.log('   Merchant:', payload.merchant);
        if (payload.data?.customer) {
            console.log('   Customer:', payload.data.customer.name);
            console.log('   Phone:', payload.data.customer.mobile);
        }
        if (payload.data?.total) {
            console.log('   Total:', payload.data.total, 'SAR');
        }
        console.log('');
        
        await sendAndLog(eventArg, payload);
    }
    
    console.log('');
}

// Run!
main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
});
