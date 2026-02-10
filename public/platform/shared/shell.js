/* ============================================
   RIBH Platform Shell — Navigation & Layout
   Injects sidebar + topbar into every platform page
   ============================================ */

var RibhShell = {
    currentPage: '',
    storeName: '',
    storeInitial: '',

    init: function() {
        this.currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'dashboard';
        this.storeName = localStorage.getItem('ribh_store_name') || 'متجري';
        this.storeInitial = this.storeName.charAt(0);
        this.render();
        this.bindEvents();
    },

    render: function() {
        var layout = document.createElement('div');
        layout.className = 'shell-layout';

        // Sidebar
        layout.innerHTML = `
        <aside class="shell-sidebar" id="sidebar">
            <div class="sidebar-header">
                <div class="sidebar-logo">رِبح</div>
                <div class="sidebar-store">
                    <div class="sidebar-store-avatar">${this.storeInitial}</div>
                    <div class="sidebar-store-info">
                        <div class="sidebar-store-name">${this.storeName}</div>
                        <div class="sidebar-store-plan">Growth</div>
                    </div>
                </div>
            </div>

            <nav class="sidebar-nav">
                <div class="nav-section">
                    <div class="nav-section-label">الرئيسية</div>
                    <a href="/platform/dashboard.html" class="nav-link ${this.isActive('dashboard')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                        <span>لوحة التحكم</span>
                    </a>
                    <a href="/platform/inbox.html" class="nav-link ${this.isActive('inbox')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                        <span>المحادثات</span>
                    </a>
                </div>

                <div class="nav-section">
                    <div class="nav-section-label">التسويق</div>
                    <a href="/platform/journeys.html" class="nav-link ${this.isActive('journeys')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        <span>الرحلات</span>
                        <span class="nav-badge">7</span>
                    </a>
                    <a href="/platform/campaigns.html" class="nav-link ${this.isActive('campaigns')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                        <span>الحملات</span>
                    </a>
                    <a href="/platform/signup-tools.html" class="nav-link ${this.isActive('signup-tools')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 7h10v10H7z"/></svg>
                        <span>أدوات الاشتراك</span>
                    </a>
                </div>

                <div class="nav-section">
                    <div class="nav-section-label">العملاء</div>
                    <a href="/platform/subscribers.html" class="nav-link ${this.isActive('subscribers')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        <span>المشتركين</span>
                    </a>
                    <a href="/platform/segments.html" class="nav-link ${this.isActive('segments')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M2 12h20"/></svg>
                        <span>الشرائح</span>
                    </a>
                </div>

                <div class="nav-section">
                    <div class="nav-section-label">التحليلات</div>
                    <a href="/platform/analytics.html" class="nav-link ${this.isActive('analytics')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                        <span>التحليلات</span>
                    </a>
                </div>

                <div class="nav-section">
                    <div class="nav-section-label">النظام</div>
                    <a href="/platform/settings.html" class="nav-link ${this.isActive('settings')}">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                        <span>الإعدادات</span>
                    </a>
                </div>
            </nav>

            <div class="sidebar-footer">
                <div class="sidebar-status">
                    <span class="status-dot online" id="waStatus"></span>
                    <span>واتساب متصل</span>
                </div>
            </div>
        </aside>

        <div class="shell-main">
            <header class="shell-topbar">
                <div class="topbar-right">
                    <button class="mobile-menu-btn" id="menuBtn" aria-label="القائمة">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </button>
                    <div>
                        <div class="topbar-title" id="pageTitle"></div>
                    </div>
                </div>
                <div class="topbar-left">
                    <button class="topbar-btn" title="الإشعارات">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                    </button>
                    <a href="/platform/settings.html" class="topbar-btn" title="الإعدادات">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68V3a2 2 0 0 1 4 0v.09c.06.83.55 1.56 1.31 1.82a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.27.76 1 1.25 1.82 1.31H21a2 2 0 0 1 0 4h-.09c-.83.06-1.56.55-1.82 1.31z"/></svg>
                    </a>
                </div>
            </header>

            <main class="shell-content fade-in" id="shellContent">
            </main>
        </div>
        `;

        // Preserve page-specific <style> blocks before clearing body
        var existingContent = document.getElementById('page-content');
        var pageStyles = Array.prototype.slice.call(document.body.querySelectorAll('style'));

        // Clear body and rebuild with shell layout
        document.body.innerHTML = '';
        document.body.appendChild(layout);

        // Re-append preserved page styles to head so they survive
        pageStyles.forEach(function(style) {
            document.head.appendChild(style);
        });

        if (existingContent) {
            document.getElementById('shellContent').appendChild(existingContent);
        }

        // Show body now that shell is ready (prevents FOUC)
        document.body.classList.add('shell-ready');

        // Set page title
        var titles = {
            'dashboard': 'لوحة التحكم',
            'inbox': 'المحادثات',
            'journeys': 'الرحلات',
            'campaigns': 'الحملات',
            'signup-tools': 'أدوات الاشتراك',
            'subscribers': 'المشتركين',
            'segments': 'الشرائح',
            'analytics': 'التحليلات',
            'settings': 'الإعدادات',
            'subscriber': 'تفاصيل المشترك'
        };
        var titleEl = document.getElementById('pageTitle');
        if (titleEl) {
            titleEl.textContent = titles[this.currentPage] || '';
        }
    },

    isActive: function(page) {
        return this.currentPage === page ? 'active' : '';
    },

    bindEvents: function() {
        var menuBtn = document.getElementById('menuBtn');
        var sidebar = document.getElementById('sidebar');

        if (menuBtn && sidebar) {
            menuBtn.addEventListener('click', function() {
                sidebar.classList.toggle('open');
            });

            // Close sidebar on outside click (mobile)
            document.addEventListener('click', function(e) {
                if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== menuBtn && !menuBtn.contains(e.target)) {
                    sidebar.classList.remove('open');
                }
            });
        }

        // Check WhatsApp status
        this.checkWhatsAppStatus();
    },

    checkWhatsAppStatus: function() {
        var dot = document.getElementById('waStatus');
        if (!dot) return;

        fetch('/api/whatsapp/status')
            .then(function(r) { return r.json(); })
            .then(function(data) {
                if (data.connected) {
                    dot.className = 'status-dot online';
                } else {
                    dot.className = 'status-dot offline';
                }
            })
            .catch(function() {
                dot.className = 'status-dot offline';
            });
    },

    // Helper: format number in Arabic
    formatNumber: function(n) {
        return n.toLocaleString('ar-SA');
    },

    // Helper: format SAR currency
    formatSAR: function(n) {
        return n.toLocaleString('ar-SA') + ' ر.س';
    },

    // Helper: API fetch with auth
    api: function(url, options) {
        options = options || {};
        options.credentials = 'include';
        if (options.body && typeof options.body === 'object') {
            options.headers = options.headers || {};
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }
        return fetch(url, options).then(function(r) {
            if (r.status === 401) {
                window.location.href = '/login.html';
                return;
            }
            return r.json();
        });
    }
};

// Auto-init when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    RibhShell.init();
});
