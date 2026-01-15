/**
 * رِبح Exit Intent Widget
 * 
 * Paste this in your Salla store to capture leaving visitors
 * 
 * <script src="https://ribh.click/widget/exit-popup.js" data-store="YOUR_STORE_ID"></script>
 */

(function () {
    'use strict';

    // Get store ID from script tag
    const scriptTag = document.currentScript;
    const storeId = scriptTag?.getAttribute('data-store') || 'default';

    // Check if already shown this session
    const storageKey = 'ribh_exit_shown_' + storeId;
    if (sessionStorage.getItem(storageKey)) return;

    // Configuration
    const config = {
        discount: 10,
        headline: '✋ انتظر! لا تفوت هذا العرض',
        body: 'احصل على خصم خاص كهدية قبل المغادرة',
        buttonText: 'احصل على الخصم الآن 🎁',
        delay: 3000, // Wait 3 seconds before enabling
        triggerDistance: 50 // Pixels from top to trigger
    };

    let enabled = false;
    let shown = false;

    // Enable after delay
    setTimeout(() => { enabled = true; }, config.delay);

    // Create popup HTML
    function createPopup() {
        const overlay = document.createElement('div');
        overlay.id = 'ribh-exit-overlay';
        overlay.innerHTML = `
            <style>
                #ribh-exit-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0,0,0,0.7);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 999999;
                    animation: ribhFadeIn 0.3s ease;
                    font-family: 'Noto Kufi Arabic', Arial, sans-serif;
                    direction: rtl;
                }
                @keyframes ribhFadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes ribhSlideIn {
                    from { transform: scale(0.8) translateY(-20px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }
                #ribh-exit-popup {
                    background: white;
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 420px;
                    text-align: center;
                    animation: ribhSlideIn 0.4s ease;
                    position: relative;
                }
                #ribh-exit-close {
                    position: absolute;
                    top: 16px;
                    left: 16px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #999;
                }
                #ribh-exit-icon {
                    font-size: 50px;
                    margin-bottom: 16px;
                }
                #ribh-exit-headline {
                    font-size: 24px;
                    font-weight: 700;
                    color: #1D1D1F;
                    margin-bottom: 12px;
                }
                #ribh-exit-body {
                    font-size: 16px;
                    color: #666;
                    margin-bottom: 24px;
                    line-height: 1.6;
                }
                #ribh-exit-discount {
                    background: linear-gradient(135deg, #10B981, #059669);
                    color: white;
                    padding: 16px 24px;
                    border-radius: 12px;
                    font-size: 28px;
                    font-weight: 700;
                    margin-bottom: 24px;
                    display: inline-block;
                }
                #ribh-exit-form {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 16px;
                }
                #ribh-exit-email {
                    flex: 1;
                    padding: 14px 16px;
                    border: 2px solid #E2E8F0;
                    border-radius: 10px;
                    font-size: 14px;
                    direction: ltr;
                }
                #ribh-exit-btn {
                    background: #1D1D1F;
                    color: white;
                    border: none;
                    padding: 14px 24px;
                    border-radius: 10px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                #ribh-exit-btn:hover {
                    background: #333;
                    transform: translateY(-2px);
                }
                #ribh-exit-skip {
                    color: #999;
                    font-size: 12px;
                    cursor: pointer;
                    text-decoration: underline;
                }
            </style>
            <div id="ribh-exit-popup">
                <button id="ribh-exit-close">×</button>
                <div id="ribh-exit-icon">🎁</div>
                <div id="ribh-exit-headline">${config.headline}</div>
                <div id="ribh-exit-body">${config.body}</div>
                <div id="ribh-exit-discount">خصم ${config.discount}%</div>
                <form id="ribh-exit-form">
                    <input type="email" id="ribh-exit-email" placeholder="أدخل بريدك الإلكتروني" required>
                    <button type="submit" id="ribh-exit-btn">${config.buttonText}</button>
                </form>
                <div id="ribh-exit-skip">لا شكراً، لا أريد الخصم</div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Event listeners
        overlay.querySelector('#ribh-exit-close').onclick = closePopup;
        overlay.querySelector('#ribh-exit-skip').onclick = closePopup;
        overlay.onclick = (e) => { if (e.target === overlay) closePopup(); };

        overlay.querySelector('#ribh-exit-form').onsubmit = async (e) => {
            e.preventDefault();
            const email = overlay.querySelector('#ribh-exit-email').value;

            // Send to رِبح
            try {
                await fetch('https://ribh.click/api/popup/capture', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        storeId: storeId,
                        email: email,
                        discount: config.discount,
                        source: 'exit_popup'
                    })
                });
            } catch (e) { }

            // Show success
            overlay.querySelector('#ribh-exit-popup').innerHTML = `
                <div id="ribh-exit-icon" style="font-size: 60px;">✅</div>
                <div id="ribh-exit-headline">تم! تحقق من بريدك</div>
                <div id="ribh-exit-body">أرسلنا لك كود الخصم على ${email}</div>
                <button id="ribh-exit-btn" onclick="document.getElementById('ribh-exit-overlay').remove()">متابعة التسوق</button>
            `;
        };
    }

    function closePopup() {
        const overlay = document.getElementById('ribh-exit-overlay');
        if (overlay) overlay.remove();
        sessionStorage.setItem(storageKey, 'true');
    }

    function showPopup() {
        if (!enabled || shown) return;
        shown = true;
        sessionStorage.setItem(storageKey, 'true');
        createPopup();

        // Track popup shown
        try {
            fetch('https://ribh.click/api/popup/shown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ storeId: storeId })
            });
        } catch (e) { }
    }

    // Exit intent detection
    document.addEventListener('mouseout', (e) => {
        if (e.clientY < config.triggerDistance &&
            e.relatedTarget == null &&
            e.target.nodeName.toLowerCase() !== 'select') {
            showPopup();
        }
    });

    // Mobile: back button / tab close attempt
    let lastScrollY = window.scrollY;
    window.addEventListener('scroll', () => {
        if (window.scrollY < 0 || (lastScrollY === 0 && window.scrollY === 0)) {
            showPopup();
        }
        lastScrollY = window.scrollY;
    });

    console.log('رِبح Exit Intent Widget loaded');
})();
