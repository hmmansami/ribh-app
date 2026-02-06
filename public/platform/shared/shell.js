/* ═══════════════════════════════════════════════════
   RIBH Platform Shell
   Injects sidebar + topbar into every platform page
   ═══════════════════════════════════════════════════ */

const RibhShell = {
    currentPage: '',
    storeName: 'متجري',

    nav: [
        { section: 'الرئيسية' },
        { id: 'dashboard', label: 'لوحة التحكم', icon: 'layout-dashboard', href: 'dashboard.html' },
        { section: 'العملاء' },
        { id: 'customers', label: 'العملاء', icon: 'users', href: 'customers.html', badge: '' },
        { id: 'segments', label: 'الشرائح', icon: 'pie-chart', href: 'segments.html' },
        { section: 'التسويق' },
        { id: 'flows', label: 'الأتمتة', icon: 'git-branch', href: 'flows.html' },
        { id: 'campaigns', label: 'الحملات', icon: 'send', href: 'campaigns.html' },
        { section: 'البيانات' },
        { id: 'analytics', label: 'التحليلات', icon: 'bar-chart-3', href: 'analytics.html' },
        { section: 'النظام' },
        { id: 'settings', label: 'الإعدادات', icon: 'settings', href: 'settings.html' },
    ],

    init(pageId) {
        this.currentPage = pageId;
        this.loadStoreName();
        this.render();
        this.initLucide();
        this.bindEvents();
    },

    loadStoreName() {
        try {
            const saved = localStorage.getItem('ribh_store_name');
            if (saved) this.storeName = saved;
        } catch(e) {}
    },

    render() {
        const layout = document.getElementById('app');
        if (!layout) return;

        layout.className = 'platform-layout';
        layout.innerHTML = `
            <div class="sidebar-overlay" id="sidebarOverlay"></div>
            <aside class="sidebar" id="sidebar">
                <div class="sidebar-brand">
                    <div class="sidebar-brand-logo">RIBH</div>
                    <div class="sidebar-brand-sub">منصة نمو المتاجر</div>
                </div>
                <nav class="sidebar-nav">
                    ${this.renderNav()}
                </nav>
                <div class="sidebar-footer">
                    <div class="sidebar-store">
                        <div class="sidebar-store-avatar">${this.storeName.charAt(0)}</div>
                        <div>
                            <div class="sidebar-store-name">${this.storeName}</div>
                            <div class="sidebar-store-plan">الخطة الاحترافية</div>
                        </div>
                    </div>
                </div>
            </aside>
            <div class="main-area">
                <header class="topbar">
                    <div class="topbar-right" style="display:flex;align-items:center;gap:12px;">
                        <button class="sidebar-toggle" id="sidebarToggle" aria-label="القائمة">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                        </button>
                        <h1 class="topbar-page-title">${this.getPageTitle()}</h1>
                    </div>
                    <div class="topbar-left">
                        <div class="topbar-whatsapp-status connected" id="waStatus">
                            <span class="status-dot pulse"></span>
                            <span>واتساب متصل</span>
                        </div>
                        <button class="topbar-btn" title="الإشعارات" onclick="RibhShell.showNotifications()">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
                        </button>
                    </div>
                </header>
                <main class="page-content" id="pageContent">
                    ${document.getElementById('page-body')?.innerHTML || ''}
                </main>
            </div>
        `;

        // Move page body content
        const pageBody = document.getElementById('page-body');
        if (pageBody) pageBody.style.display = 'none';
    },

    renderNav() {
        let html = '';
        for (const item of this.nav) {
            if (item.section) {
                html += `<div class="sidebar-section"><div class="sidebar-section-title">${item.section}</div></div>`;
            } else {
                const isActive = item.id === this.currentPage;
                const badge = item.badge ? `<span class="sidebar-badge">${item.badge}</span>` : '';
                html += `<a href="${item.href}" class="sidebar-link ${isActive ? 'active' : ''}" data-page="${item.id}">
                    <i data-lucide="${item.icon}"></i>
                    <span>${item.label}</span>
                    ${badge}
                </a>`;
            }
        }
        return html;
    },

    getPageTitle() {
        const page = this.nav.find(n => n.id === this.currentPage);
        return page ? page.label : 'RIBH';
    },

    initLucide() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    },

    bindEvents() {
        const toggle = document.getElementById('sidebarToggle');
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');

        if (toggle) {
            toggle.addEventListener('click', () => {
                sidebar.classList.toggle('open');
                overlay.classList.toggle('open');
            });
        }

        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebar.classList.remove('open');
                overlay.classList.remove('open');
            });
        }
    },

    showNotifications() {
        // Placeholder for notification panel
    },

    checkWhatsAppStatus() {
        const el = document.getElementById('waStatus');
        if (!el) return;
        fetch('/api/whatsapp/status')
            .then(r => r.json())
            .then(data => {
                if (data.connected) {
                    el.className = 'topbar-whatsapp-status connected';
                    el.innerHTML = '<span class="status-dot pulse"></span><span>واتساب متصل</span>';
                } else {
                    el.className = 'topbar-whatsapp-status disconnected';
                    el.innerHTML = '<span class="status-dot"></span><span>غير متصل</span>';
                }
            })
            .catch(() => {});
    }
};

/* ── Shared API Client ── */
const RibhAPI = {
    baseURL: '/api',

    async get(path) {
        try {
            const res = await fetch(this.baseURL + path);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.warn('API Error:', path, e.message);
            return null;
        }
    },

    async post(path, body) {
        try {
            const res = await fetch(this.baseURL + path, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            console.warn('API Error:', path, e.message);
            return null;
        }
    },

    // Demo data fallbacks for when APIs aren't connected
    demo: {
        stats: {
            totalRevenue: 47850,
            recoveredCarts: 234,
            conversionRate: 28.5,
            totalCustomers: 1847,
            activeFlows: 8,
            messagesSent: 12450,
            avgOrderValue: 205,
            repeatRate: 34.2
        },
        customers: [
            { id: 'c1', name: 'أحمد محمد', phone: '+966501234567', orders: 12, revenue: 4520, lastOrder: '2026-02-04', segment: 'champion', clv: 8900, churnRisk: 0.12 },
            { id: 'c2', name: 'سارة العلي', phone: '+966551234567', orders: 8, revenue: 3200, lastOrder: '2026-02-01', segment: 'loyal', clv: 6400, churnRisk: 0.18 },
            { id: 'c3', name: 'محمد الأحمد', phone: '+966541234567', orders: 5, revenue: 1800, lastOrder: '2026-01-25', segment: 'potential', clv: 4200, churnRisk: 0.35 },
            { id: 'c4', name: 'نورة السعيد', phone: '+966531234567', orders: 3, revenue: 950, lastOrder: '2026-01-15', segment: 'recent', clv: 2100, churnRisk: 0.45 },
            { id: 'c5', name: 'خالد العتيبي', phone: '+966561234567', orders: 15, revenue: 6200, lastOrder: '2026-02-05', segment: 'champion', clv: 12500, churnRisk: 0.08 },
            { id: 'c6', name: 'فاطمة الزهراني', phone: '+966571234567', orders: 2, revenue: 450, lastOrder: '2025-12-20', segment: 'at_risk', clv: 800, churnRisk: 0.72 },
            { id: 'c7', name: 'عبدالله القحطاني', phone: '+966581234567', orders: 7, revenue: 2800, lastOrder: '2026-01-28', segment: 'loyal', clv: 5600, churnRisk: 0.22 },
            { id: 'c8', name: 'ريم الشمري', phone: '+966591234567', orders: 1, revenue: 180, lastOrder: '2025-11-10', segment: 'dormant', clv: 300, churnRisk: 0.88 },
            { id: 'c9', name: 'ياسر الدوسري', phone: '+966521234567', orders: 10, revenue: 3900, lastOrder: '2026-02-03', segment: 'champion', clv: 7800, churnRisk: 0.14 },
            { id: 'c10', name: 'هند المالكي', phone: '+966511234567', orders: 4, revenue: 1200, lastOrder: '2026-01-10', segment: 'potential', clv: 2800, churnRisk: 0.40 },
        ],
        segments: [
            { id: 'champion', name: 'الأبطال', nameEn: 'Champions', count: 156, revenue: 89000, color: '#10B981', icon: 'crown', description: 'اشتروا مؤخراً، يشترون كثيراً، ينفقون أكثر' },
            { id: 'loyal', name: 'المخلصون', nameEn: 'Loyal', count: 312, revenue: 67000, color: '#6366F1', icon: 'heart', description: 'يشترون بانتظام وبقيمة جيدة' },
            { id: 'potential', name: 'الواعدون', nameEn: 'Potential Loyalists', count: 428, revenue: 45000, color: '#3B82F6', icon: 'trending-up', description: 'عملاء حديثون بإمكانية عالية' },
            { id: 'recent', name: 'الجدد', nameEn: 'Recent', count: 534, revenue: 28000, color: '#F59E0B', icon: 'user-plus', description: 'أول عملية شراء مؤخراً' },
            { id: 'at_risk', name: 'معرضون للخسارة', nameEn: 'At Risk', count: 267, revenue: 34000, color: '#EF4444', icon: 'alert-triangle', description: 'كانوا نشطين لكن توقفوا عن الشراء' },
            { id: 'dormant', name: 'خاملون', nameEn: 'Dormant', count: 150, revenue: 8000, color: '#71717A', icon: 'moon', description: 'لم يشتروا منذ فترة طويلة' },
        ],
        flows: [
            { id: 'f1', name: 'استرداد السلة المتروكة', type: 'cart_recovery', status: 'active', sent: 3450, converted: 980, revenue: 28500, steps: 3, channel: 'whatsapp' },
            { id: 'f2', name: 'ترحيب العميل الجديد', type: 'welcome', status: 'active', sent: 1200, converted: 340, revenue: 12000, steps: 5, channel: 'whatsapp' },
            { id: 'f3', name: 'ما بعد الشراء', type: 'post_purchase', status: 'active', sent: 2100, converted: 420, revenue: 18500, steps: 4, channel: 'whatsapp' },
            { id: 'f4', name: 'استعادة العملاء', type: 'winback', status: 'active', sent: 890, converted: 156, revenue: 8200, steps: 3, channel: 'whatsapp' },
            { id: 'f5', name: 'تذكير إعادة الطلب', type: 'replenishment', status: 'draft', sent: 0, converted: 0, revenue: 0, steps: 2, channel: 'whatsapp' },
            { id: 'f6', name: 'عيد ميلاد العميل', type: 'birthday', status: 'draft', sent: 0, converted: 0, revenue: 0, steps: 1, channel: 'whatsapp' },
            { id: 'f7', name: 'تخفيض السعر', type: 'price_drop', status: 'active', sent: 670, converted: 201, revenue: 9800, steps: 1, channel: 'whatsapp' },
            { id: 'f8', name: 'المنتج متوفر مجدداً', type: 'back_in_stock', status: 'active', sent: 340, converted: 145, revenue: 5600, steps: 1, channel: 'whatsapp' },
        ],
        recentActivity: [
            { type: 'recovery', text: 'سلة مستردة بقيمة ٣٨٥ ر.س', time: 'منذ 3 دقائق', customer: 'أحمد محمد' },
            { type: 'message', text: 'تم إرسال رسالة ترحيب', time: 'منذ 8 دقائق', customer: 'سارة العلي' },
            { type: 'recovery', text: 'سلة مستردة بقيمة ٢١٠ ر.س', time: 'منذ 15 دقيقة', customer: 'خالد العتيبي' },
            { type: 'flow', text: 'بدء تسلسل ما بعد الشراء', time: 'منذ 22 دقيقة', customer: 'نورة السعيد' },
            { type: 'message', text: 'رسالة استعادة مرسلة', time: 'منذ 35 دقيقة', customer: 'فاطمة الزهراني' },
            { type: 'recovery', text: 'سلة مستردة بقيمة ٥٤٠ ر.س', time: 'منذ 42 دقيقة', customer: 'ياسر الدوسري' },
        ]
    }
};

/* ── Number Formatting ── */
function formatNumber(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toLocaleString('ar-SA');
}

function formatCurrency(n) {
    return n.toLocaleString('ar-SA') + ' ر.س';
}

function formatPercent(n) {
    return n.toFixed(1) + '%';
}

/* ── Segment Helpers ── */
const segmentNames = {
    champion: 'بطل',
    loyal: 'مخلص',
    potential: 'واعد',
    recent: 'جديد',
    at_risk: 'معرض للخسارة',
    dormant: 'خامل'
};

const segmentColors = {
    champion: 'success',
    loyal: 'secondary',
    potential: 'info',
    recent: 'warning',
    at_risk: 'danger',
    dormant: 'neutral'
};

function getSegmentBadge(segment) {
    const name = segmentNames[segment] || segment;
    const color = segmentColors[segment] || 'neutral';
    return `<span class="badge badge-${color}">${name}</span>`;
}

/* ── Chart Helpers (using simple canvas drawing) ── */
const RibhCharts = {
    drawLineChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const w = rect.width;
        const h = rect.height;

        const padding = { top: 10, right: 10, bottom: 30, left: 50 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        const max = Math.max(...data.values) * 1.1 || 1;
        const min = 0;

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (plotH / 4) * i;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            // Labels
            const val = max - (max / 4) * i;
            ctx.fillStyle = '#71717A';
            ctx.font = '10px IBM Plex Sans Arabic';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(val).toLocaleString('ar-SA'), padding.left - 8, y + 4);
        }

        // Line
        const color = options.color || '#10B981';
        const points = data.values.map((v, i) => ({
            x: padding.left + (plotW / (data.values.length - 1)) * i,
            y: padding.top + plotH - ((v - min) / (max - min)) * plotH
        }));

        // Gradient fill
        const grad = ctx.createLinearGradient(0, padding.top, 0, h - padding.bottom);
        grad.addColorStop(0, color + '30');
        grad.addColorStop(1, color + '00');

        ctx.beginPath();
        ctx.moveTo(points[0].x, h - padding.bottom);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.lineTo(points[points.length - 1].x, h - padding.bottom);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();

        // Line stroke
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Dots
        points.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        });

        // X labels
        if (data.labels) {
            ctx.fillStyle = '#71717A';
            ctx.font = '10px IBM Plex Sans Arabic';
            ctx.textAlign = 'center';
            data.labels.forEach((label, i) => {
                if (i % Math.ceil(data.labels.length / 7) === 0 || i === data.labels.length - 1) {
                    const x = padding.left + (plotW / (data.labels.length - 1)) * i;
                    ctx.fillText(label, x, h - 8);
                }
            });
        }
    },

    drawBarChart(canvasId, data, options = {}) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const w = rect.width;
        const h = rect.height;

        const padding = { top: 10, right: 10, bottom: 30, left: 50 };
        const plotW = w - padding.left - padding.right;
        const plotH = h - padding.top - padding.bottom;

        const max = Math.max(...data.values) * 1.1 || 1;
        const barWidth = (plotW / data.values.length) * 0.6;
        const gap = (plotW / data.values.length) * 0.4;

        data.values.forEach((v, i) => {
            const barH = (v / max) * plotH;
            const x = padding.left + (plotW / data.values.length) * i + gap / 2;
            const y = padding.top + plotH - barH;
            const color = data.colors ? data.colors[i] : (options.color || '#10B981');

            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.roundRect(x, y, barWidth, barH, [4, 4, 0, 0]);
            ctx.fill();

            // Label
            if (data.labels) {
                ctx.fillStyle = '#71717A';
                ctx.font = '10px IBM Plex Sans Arabic';
                ctx.textAlign = 'center';
                ctx.fillText(data.labels[i], x + barWidth / 2, h - 8);
            }
        });
    },

    drawDonut(canvasId, data) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);
        const w = rect.width;
        const h = rect.height;

        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(w, h) / 2 - 10;
        const inner = radius * 0.6;
        const total = data.values.reduce((a, b) => a + b, 0);

        let startAngle = -Math.PI / 2;
        data.values.forEach((v, i) => {
            const sliceAngle = (v / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
            ctx.arc(cx, cy, inner, startAngle + sliceAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = data.colors[i];
            ctx.fill();
            startAngle += sliceAngle;
        });

        // Center text
        if (data.centerText) {
            ctx.fillStyle = '#FAFAFA';
            ctx.font = 'bold 20px IBM Plex Sans Arabic';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(data.centerText, cx, cy - 8);
            if (data.centerSub) {
                ctx.fillStyle = '#71717A';
                ctx.font = '11px IBM Plex Sans Arabic';
                ctx.fillText(data.centerSub, cx, cy + 14);
            }
        }
    }
};
