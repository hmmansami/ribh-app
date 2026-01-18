/**
 * RIBH Behavioral Analytics (Mom Test Style)
 * Track what users STRUGGLE with, not just what they click
 * @version 1.0.2 - Auto-deploy WORKING! 🚀 2026-01-18 11:07
 * 
 * Setup Instructions:
 * 1. Go to https://clarity.microsoft.com and create free account
 * 2. Create a new project for ribh.click
 * 3. Copy the project ID and replace 'YOUR_CLARITY_PROJECT_ID' below
 * 
 * What this tracks:
 * - Rage clicks (frustration)
 * - Dead clicks (confusion)
 * - Excessive scrolling (searching for something)
 * - Time on specific elements (hesitation)
 * - Session recordings (watch users interact)
 */

(function () {
    'use strict';

    // ============================================
    // MICROSOFT CLARITY (Session Recording + Heatmaps)
    // Get your free ID at: https://clarity.microsoft.com
    // ============================================
    const CLARITY_PROJECT_ID = 'v38c5t2wyq'; // Your Clarity project

    if (CLARITY_PROJECT_ID !== 'YOUR_CLARITY_PROJECT_ID') {
        (function (c, l, a, r, i, t, y) {
            c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments) };
            t = l.createElement(r); t.async = 1; t.src = "https://www.clarity.ms/tag/" + i;
            y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
        })(window, document, "clarity", "script", CLARITY_PROJECT_ID);
    }

    // ============================================
    // CUSTOM BEHAVIORAL TRACKING
    // Mom Test style - understand STRUGGLES not just actions
    // ============================================

    const RIBH_ANALYTICS = {
        sessionId: 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        events: [],
        startTime: Date.now(),

        // Track an event
        track: function (eventName, data = {}) {
            const event = {
                event: eventName,
                timestamp: Date.now(),
                timeOnPage: Date.now() - this.startTime,
                url: window.location.pathname,
                sessionId: this.sessionId,
                ...data
            };

            this.events.push(event);

            // Log to console in dev mode
            if (window.location.hostname === 'localhost') {
                console.log('📊 RIBH Analytics:', event);
            }

            // Send to backend (if endpoint exists)
            this.sendToBackend(event);
        },

        // Send events to your backend for AI analysis
        sendToBackend: function (event) {
            // POST to your analytics endpoint
            fetch('/api/analytics', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event)
            }).catch(() => {
                // Silently fail - analytics shouldn't break the app
            });
        }
    };

    // ============================================
    // HESITATION TRACKING
    // How long before they take action? (signals confusion/concern)
    // ============================================

    let elementTimers = {};

    document.addEventListener('mouseover', function (e) {
        const target = e.target.closest('button, a, .feature-card, .oneclick-button, .toggle');
        if (target) {
            const id = target.id || target.className || target.tagName;
            if (!elementTimers[id]) {
                elementTimers[id] = {
                    firstHover: Date.now(),
                    hoverCount: 0
                };
            }
            elementTimers[id].hoverCount++;
        }
    });

    document.addEventListener('click', function (e) {
        const target = e.target.closest('button, a, .feature-card, .oneclick-button, .toggle');
        if (target) {
            const id = target.id || target.className || target.tagName;
            const timer = elementTimers[id];

            if (timer) {
                const hesitationTime = Date.now() - timer.firstHover;

                RIBH_ANALYTICS.track('element_click', {
                    elementId: id,
                    elementText: target.textContent?.substring(0, 50),
                    hesitationMs: hesitationTime,
                    hoverCount: timer.hoverCount,
                    wasHesitant: hesitationTime > 3000 // More than 3 sec = hesitation
                });
            }
        }
    });

    // ============================================
    // RAGE CLICK DETECTION
    // Multiple rapid clicks = frustration
    // ============================================

    let clickTimes = [];

    document.addEventListener('click', function (e) {
        const now = Date.now();
        clickTimes.push(now);

        // Keep only last 5 clicks
        clickTimes = clickTimes.filter(t => now - t < 2000);

        if (clickTimes.length >= 3) {
            RIBH_ANALYTICS.track('rage_click', {
                target: e.target.tagName,
                targetId: e.target.id,
                targetClass: e.target.className,
                clickCount: clickTimes.length,
                element: e.target.textContent?.substring(0, 50)
            });
        }
    });

    // ============================================
    // SCROLL ABANDONMENT
    // Did they scroll past important content?
    // ============================================

    let maxScroll = 0;
    let importantSections = [];

    window.addEventListener('scroll', function () {
        const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        if (scrollPercent > maxScroll) {
            maxScroll = scrollPercent;
        }
    });

    // Track when they leave
    window.addEventListener('beforeunload', function () {
        RIBH_ANALYTICS.track('session_end', {
            maxScrollPercent: Math.round(maxScroll),
            totalTimeMs: Date.now() - RIBH_ANALYTICS.startTime,
            totalEvents: RIBH_ANALYTICS.events.length
        });
    });

    // ============================================
    // IMPORTANT: ONE-CLICK BUTTON TRACKING
    // This is your most important conversion point
    // ============================================

    // Wait for DOM
    document.addEventListener('DOMContentLoaded', function () {
        const oneClickBtn = document.querySelector('.oneclick-button');
        if (oneClickBtn) {
            // Track when they SEE it
            RIBH_ANALYTICS.track('oneclick_button_viewed', {
                page: window.location.pathname
            });

            // Track when they CLICK it
            oneClickBtn.addEventListener('click', function () {
                RIBH_ANALYTICS.track('oneclick_button_clicked', {
                    timeToClick: Date.now() - RIBH_ANALYTICS.startTime
                });
            });
        }

        // Track toggle switches (feature activation)
        document.querySelectorAll('.toggle input').forEach((toggle, index) => {
            toggle.addEventListener('change', function () {
                RIBH_ANALYTICS.track('feature_toggle', {
                    featureIndex: index,
                    enabled: this.checked,
                    featureCard: this.closest('.feature-card')?.querySelector('.feature-name')?.textContent
                });
            });
        });
    });

    // ============================================
    // PAGE-SPECIFIC TRACKING
    // ============================================

    // Track page view
    RIBH_ANALYTICS.track('page_view', {
        page: window.location.pathname,
        referrer: document.referrer
    });

    // Expose for custom events
    window.RIBH = RIBH_ANALYTICS;

})();
