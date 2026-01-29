/**
 * RIBH Smooth Navigation & Page Transitions
 * Enhanced version with preloading, active state management, and better animations
 */
(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        transitionDuration: 200,
        preloadDelay: 500,
        mainPages: ['/index.html', '/dashboard.html', '/settings.html', '/analytics.html', '/messages.html', '/preview.html']
    };

    // Inject enhanced transition styles
    const style = document.createElement('style');
    style.id = 'ribh-transitions';
    style.textContent = `
        /* Base transition */
        body {
            opacity: 1;
        }
        
        /* Page exit animation */
        body.page-exit {
            animation: pageExit 0.2s ease-in forwards;
        }
        
        /* Page enter animation */
        body.page-enter {
            animation: pageEnter 0.3s ease-out;
        }
        
        @keyframes pageExit {
            0% {
                opacity: 1;
                transform: translateY(0);
            }
            100% {
                opacity: 0;
                transform: translateY(-10px);
            }
        }
        
        @keyframes pageEnter {
            0% {
                opacity: 0;
                transform: translateY(10px);
            }
            100% {
                opacity: 1;
                transform: translateY(0);
            }
        }
        
        /* Loading bar */
        .page-loading {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: linear-gradient(90deg, #10B981, #059669, #6366F1, #10B981);
            background-size: 300% 100%;
            z-index: 9999;
            transform: scaleX(0);
            transform-origin: left;
            transition: transform 0.3s ease;
            animation: loadingGradient 2s ease-in-out infinite;
        }
        
        .page-loading.active {
            transform: scaleX(0.7);
        }
        
        .page-loading.complete {
            transform: scaleX(1);
            transition: transform 0.1s ease;
        }
        
        @keyframes loadingGradient {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
        }
        
        /* Nav item enhancements */
        .nav-item {
            position: relative;
            overflow: hidden;
            transition: all 0.25s ease;
        }
        
        .nav-item::before {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 0;
            height: 0;
            background: radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, transparent 70%);
            transform: translate(-50%, -50%);
            transition: width 0.4s ease, height 0.4s ease;
            border-radius: 50%;
            pointer-events: none;
        }
        
        .nav-item:hover::before {
            width: 200%;
            height: 200%;
        }
        
        /* Active indicator animation */
        .nav-item.active {
            position: relative;
        }
        
        /* RTL support for loading bar */
        html[dir="rtl"] .page-loading {
            transform-origin: right;
        }
        
        /* Smooth content reveal */
        .main, .main-content {
            animation: contentReveal 0.4s ease-out;
        }
        
        @keyframes contentReveal {
            0% {
                opacity: 0;
            }
            100% {
                opacity: 1;
            }
        }
        
        /* Preload hint (invisible) */
        link[rel="prefetch"] {
            display: none;
        }
    `;
    document.head.appendChild(style);

    // Create loading bar
    const loader = document.createElement('div');
    loader.className = 'page-loading';
    loader.id = 'page-loader';
    
    // Insert at the very beginning of body
    function insertLoader() {
        if (document.body && !document.getElementById('page-loader')) {
            document.body.insertBefore(loader, document.body.firstChild);
        }
    }

    // Get normalized path
    function getCurrentPath() {
        const path = window.location.pathname;
        if (path === '/' || path === '') return '/index.html';
        return path;
    }

    // Check if paths match (handling index.html/dashboard.html equivalence)
    function pathsMatch(path1, path2) {
        const normalize = (p) => {
            if (p === '/' || p === '/index.html' || p === '/dashboard.html') {
                return '/index.html';
            }
            return p;
        };
        return normalize(path1) === normalize(path2);
    }

    // Update active navigation state
    function updateActiveNav() {
        const currentPath = getCurrentPath();
        document.querySelectorAll('.nav-item').forEach(item => {
            const href = item.getAttribute('href');
            if (href && pathsMatch(href, currentPath)) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Preload a page
    const preloaded = new Set();
    function preloadPage(url) {
        if (preloaded.has(url)) return;
        preloaded.add(url);
        
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = url;
        document.head.appendChild(link);
    }

    // Preload adjacent pages
    function preloadAdjacentPages() {
        const current = getCurrentPath();
        CONFIG.mainPages.forEach(page => {
            if (!pathsMatch(page, current)) {
                setTimeout(() => preloadPage(page), CONFIG.preloadDelay);
            }
        });
    }

    // Handle navigation click
    function handleClick(e) {
        const link = e.target.closest('a');
        if (!link) return;
        
        const href = link.getAttribute('href');
        
        // Skip if external, anchor, or special link
        if (!href || 
            href.startsWith('#') || 
            href.startsWith('http') || 
            href.startsWith('mailto:') || 
            href.startsWith('tel:') ||
            link.target === '_blank' ||
            link.hasAttribute('download')) {
            return;
        }
        
        // Skip if same page
        if (pathsMatch(href, getCurrentPath())) {
            e.preventDefault();
            return;
        }
        
        e.preventDefault();
        
        // Start transition
        document.body.classList.add('page-exit');
        loader.classList.add('active');
        
        // Navigate after animation
        setTimeout(() => {
            loader.classList.remove('active');
            loader.classList.add('complete');
            window.location.href = href;
        }, CONFIG.transitionDuration);
    }

    // Handle hover for preloading
    function handleHover(e) {
        const link = e.target.closest('a.nav-item');
        if (!link) return;
        
        const href = link.getAttribute('href');
        if (href && !href.startsWith('http') && !href.startsWith('#')) {
            preloadPage(href);
        }
    }

    // Initialize on DOM ready
    function init() {
        insertLoader();
        updateActiveNav();
        
        // Animate page in
        document.body.classList.add('page-enter');
        
        // Preload other pages after a delay
        setTimeout(preloadAdjacentPages, 1000);
        
        // Event listeners
        document.addEventListener('click', handleClick);
        document.addEventListener('mouseover', handleHover);
    }

    // Run initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Also try to insert loader ASAP
    if (document.body) {
        insertLoader();
    } else {
        document.addEventListener('DOMContentLoaded', insertLoader);
    }

    // Expose API
    window.RIBHTransitions = {
        preload: preloadPage,
        updateNav: updateActiveNav
    };

})();
