# RIBH Design Guide
> High-Converting E-Commerce & Sales App Design Patterns

Last updated: 2025

---

## Table of Contents
1. [Design System Inspiration](#1-design-system-inspiration)
2. [High-Converting Checkout Flows](#2-high-converting-checkout-flows)
3. [Arabic/RTL UX Considerations](#3-arabicrtl-ux-considerations)
4. [Color Psychology for Sales](#4-color-psychology-for-sales)
5. [Mobile-First Patterns](#5-mobile-first-patterns)
6. [Micro-Copy That Sells](#6-micro-copy-that-sells)
7. [Component Library](#7-component-library)

---

## 1. Design System Inspiration

### Shopify Polaris Patterns
**What works:** Clean data tables, action-focused cards, contextual help

```css
/* Shopify-style card with subtle depth */
.card-shopify {
  @apply bg-white rounded-xl shadow-sm border border-gray-200;
  @apply hover:shadow-md transition-shadow duration-200;
}

/* Data-dense but scannable tables */
.table-shopify th {
  @apply text-xs font-medium text-gray-500 uppercase tracking-wider;
  @apply py-3 px-4 text-left bg-gray-50;
}

.table-shopify td {
  @apply py-4 px-4 text-sm text-gray-900 border-b border-gray-100;
}
```

**Key patterns:**
- **Contextual actions** - Actions appear on hover/focus, not cluttering UI
- **Progressive disclosure** - Show essentials first, details on expand
- **Empty states with CTAs** - Never leave users in a dead-end

### Stripe Dashboard Patterns
**What works:** Information hierarchy, micro-interactions, confidence-building

```css
/* Stripe's signature gradient accent */
.stripe-gradient {
  @apply bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600;
}

/* Revenue/money display - large, confident */
.money-display {
  @apply text-4xl font-semibold tracking-tight text-gray-900;
  font-variant-numeric: tabular-nums;
}

/* Stripe's subtle loading states */
.skeleton-stripe {
  @apply animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200;
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

**Key patterns:**
- **Tabular numbers** for financial data (prevents layout shift)
- **Inline editing** - Click to edit, no separate forms
- **Real-time updates** - Data feels alive
- **Status pills** with semantic colors

### Linear App Patterns
**What works:** Keyboard-first, dark mode excellence, fluid animations

```css
/* Linear's keyboard shortcut hints */
.kbd-hint {
  @apply inline-flex items-center px-1.5 py-0.5 text-xs;
  @apply font-mono text-gray-400 bg-gray-100 rounded border border-gray-200;
}

/* Command palette style */
.command-palette {
  @apply fixed inset-x-0 top-24 mx-auto max-w-xl;
  @apply bg-white rounded-xl shadow-2xl border border-gray-200;
  @apply ring-1 ring-black/5;
}

/* Linear's smooth transitions */
.transition-linear {
  @apply transition-all duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)];
}
```

**Key patterns:**
- **Command palette (⌘K)** - Power users love it
- **Tight spacing** - Dense but not cramped (4px base unit)
- **Monospace for IDs** - Order #A7X2K looks intentional

### Gumroad Patterns
**What works:** Creator-focused, personality, direct sales psychology

```css
/* Gumroad's product card - focus on the product */
.product-card-gumroad {
  @apply group relative overflow-hidden rounded-2xl;
  @apply bg-white border-2 border-transparent;
  @apply hover:border-pink-500 transition-colors;
}

/* Price anchoring */
.price-compare {
  @apply text-gray-400 line-through text-sm;
}
.price-current {
  @apply text-2xl font-bold text-gray-900;
}
.price-savings {
  @apply text-sm font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full;
}

/* Social proof banner */
.social-proof-bar {
  @apply flex items-center gap-2 text-sm text-gray-600;
  @apply py-2 px-4 bg-amber-50 border-l-4 border-amber-400;
}
```

**Key patterns:**
- **Creator personality** - Let brands shine through
- **Price anchoring** - Show original price crossed out
- **Instant social proof** - "127 sold today"

### Notion Patterns
**What works:** Blocks, inline everything, calm productivity

```css
/* Notion's hover-reveal actions */
.block-container {
  @apply relative group;
}
.block-actions {
  @apply absolute -left-8 top-0 opacity-0 group-hover:opacity-100;
  @apply transition-opacity duration-150;
}

/* Notion's subtle input style */
.input-notion {
  @apply w-full px-3 py-2 text-gray-900;
  @apply bg-transparent border-0 border-b-2 border-transparent;
  @apply focus:border-blue-500 focus:ring-0;
  @apply placeholder-gray-400;
}

/* Toggle/accordion */
.toggle-notion {
  @apply flex items-center gap-2 cursor-pointer select-none;
}
.toggle-notion .chevron {
  @apply transform transition-transform duration-200;
}
.toggle-notion[aria-expanded="true"] .chevron {
  @apply rotate-90;
}
```

---

## 2. High-Converting Checkout Flows

### The Psychology
- **Cognitive load kills conversions** - Every field is friction
- **Progress = commitment** - Show them how far they've come
- **Trust reduces anxiety** - Especially for first-time buyers
- **Mobile is primary** - 70%+ of e-commerce is mobile in Saudi Arabia

### Progress Indicators

```html
<!-- Step indicator - shows investment, creates commitment -->
<div class="checkout-progress flex items-center justify-between mb-8">
  <div class="step completed flex items-center">
    <span class="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
      <svg class="w-5 h-5"><!-- checkmark --></svg>
    </span>
    <span class="mr-2 text-sm font-medium text-gray-900">المعلومات</span>
  </div>
  <div class="flex-1 h-1 bg-green-500 mx-2"></div>
  <div class="step current flex items-center">
    <span class="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">2</span>
    <span class="mr-2 text-sm font-medium text-blue-600">الدفع</span>
  </div>
  <div class="flex-1 h-1 bg-gray-200 mx-2"></div>
  <div class="step pending flex items-center">
    <span class="w-8 h-8 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-sm">3</span>
    <span class="mr-2 text-sm text-gray-500">التأكيد</span>
  </div>
</div>
```

```css
/* Progress bar animation */
.checkout-progress .step.completed .connector {
  @apply bg-green-500;
  animation: fill-progress 0.4s ease-out;
}

@keyframes fill-progress {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}
```

### Trust Badges

```html
<!-- Trust strip - place near payment button -->
<div class="trust-badges flex flex-wrap items-center justify-center gap-4 py-4 border-t border-b border-gray-100">
  <div class="flex items-center gap-1.5 text-gray-600 text-sm">
    <svg class="w-5 h-5 text-green-600"><!-- lock icon --></svg>
    <span>دفع آمن 100%</span>
  </div>
  <div class="flex items-center gap-1.5 text-gray-600 text-sm">
    <svg class="w-5 h-5 text-blue-600"><!-- shield icon --></svg>
    <span>حماية المشتري</span>
  </div>
  <div class="flex items-center gap-1.5 text-gray-600 text-sm">
    <svg class="w-5 h-5 text-amber-500"><!-- star icon --></svg>
    <span>تقييم 4.9 من 5</span>
  </div>
</div>

<!-- Payment method logos - recognition = trust -->
<div class="payment-methods flex items-center justify-center gap-3 py-3">
  <img src="/icons/mada.svg" alt="مدى" class="h-6 opacity-60 hover:opacity-100 transition-opacity">
  <img src="/icons/visa.svg" alt="Visa" class="h-6 opacity-60 hover:opacity-100 transition-opacity">
  <img src="/icons/mastercard.svg" alt="Mastercard" class="h-6 opacity-60 hover:opacity-100 transition-opacity">
  <img src="/icons/applepay.svg" alt="Apple Pay" class="h-6 opacity-60 hover:opacity-100 transition-opacity">
  <img src="/icons/stcpay.svg" alt="STC Pay" class="h-6 opacity-60 hover:opacity-100 transition-opacity">
</div>
```

### Minimal Form Fields

```html
<!-- Smart form - phone number formats automatically, validates on blur -->
<form class="checkout-form space-y-4" dir="rtl">
  <!-- Phone with country code built-in -->
  <div class="form-group">
    <label class="block text-sm font-medium text-gray-700 mb-1">رقم الجوال</label>
    <div class="relative">
      <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">+966</span>
      <input 
        type="tel" 
        inputmode="numeric"
        class="form-input w-full pr-16 pl-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
        placeholder="5XX XXX XXX"
        autocomplete="tel-national"
      >
    </div>
    <p class="mt-1 text-xs text-gray-500">سنرسل لك رابط الطلب على واتساب</p>
  </div>

  <!-- Address with autocomplete -->
  <div class="form-group">
    <label class="block text-sm font-medium text-gray-700 mb-1">المدينة</label>
    <select class="form-select w-full py-3 px-4 rounded-lg border border-gray-300 text-lg">
      <option value="">اختر المدينة</option>
      <option value="riyadh">الرياض</option>
      <option value="jeddah">جدة</option>
      <option value="dammam">الدمام</option>
      <!-- etc -->
    </select>
  </div>
</form>
```

### Conversion Boosters

```css
/* Urgency indicator */
.urgency-badge {
  @apply inline-flex items-center gap-1.5 px-3 py-1;
  @apply text-sm font-medium text-red-700 bg-red-50 rounded-full;
  @apply animate-pulse;
}

/* Stock warning */
.stock-low {
  @apply text-amber-600 text-sm font-medium;
}
.stock-low::before {
  content: "⚡ ";
}

/* Live viewer count */
.live-viewers {
  @apply flex items-center gap-1 text-sm text-gray-600;
}
.live-viewers .dot {
  @apply w-2 h-2 bg-green-500 rounded-full animate-pulse;
}
```

```html
<!-- Urgency elements -->
<div class="urgency-strip bg-red-600 text-white text-center py-2 text-sm font-medium">
  🔥 العرض ينتهي خلال <span class="countdown font-mono">02:34:56</span>
</div>

<div class="stock-indicator mt-2">
  <span class="stock-low">باقي 3 قطع فقط!</span>
</div>

<div class="live-viewers mt-3">
  <span class="dot"></span>
  <span>23 شخص يشاهدون الآن</span>
</div>
```

---

## 3. Arabic/RTL UX Considerations

### Core RTL Setup

```css
/* Base RTL configuration */
html[dir="rtl"] {
  /* Flip horizontal margins/paddings */
  --spacing-start: var(--spacing-right);
  --spacing-end: var(--spacing-left);
}

/* RTL-aware flexbox */
.flex-rtl {
  @apply flex;
  flex-direction: row;
}
html[dir="rtl"] .flex-rtl {
  flex-direction: row-reverse;
}

/* Logical properties (modern approach) */
.card-rtl {
  padding-inline-start: 1rem;  /* right in RTL */
  padding-inline-end: 1rem;    /* left in RTL */
  margin-inline-start: auto;
  border-inline-start: 4px solid blue;
}
```

### Typography for Arabic

```css
/* Arabic-optimized font stack */
:root {
  --font-arabic: 'IBM Plex Sans Arabic', 'Noto Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
  --font-display: 'Tajawal', var(--font-arabic);
}

body[dir="rtl"] {
  font-family: var(--font-arabic);
  /* Arabic needs more line height */
  line-height: 1.8;
  /* Slightly larger base size for Arabic legibility */
  font-size: 16px;
}

/* Headlines in Arabic - use bolder display font */
h1, h2, h3 {
  font-family: var(--font-display);
  font-weight: 700;
  line-height: 1.4;
}

/* Numbers should stay LTR */
.number, .price, .phone, [data-numeric] {
  direction: ltr;
  unicode-bidi: isolate;
}

/* Prices with currency */
.price-saudi {
  @apply font-semibold;
  direction: ltr;
  unicode-bidi: isolate;
}
.price-saudi::after {
  content: " ر.س";
  @apply text-gray-500 font-normal text-sm;
}
```

### Icon Mirroring

```css
/* Icons that should flip in RTL */
html[dir="rtl"] .icon-flip {
  transform: scaleX(-1);
}

/* Icons that should NOT flip */
/* ✓ Checkmarks, × Close, ↻ Refresh, ♥ Heart, ⚙ Settings */
.icon-no-flip {
  transform: none !important;
}
```

**Icons to flip:** ← → arrows, 📤 send/share, ↩ reply, ◀ ▶ chevrons, 📖 book/read
**Icons NOT to flip:** ✓ ✗ checkmarks, 🔄 refresh, ❤️ heart, ⚙️ settings, 🔔 notification

### Form Alignment

```html
<!-- RTL form with proper alignment -->
<form dir="rtl" class="space-y-4">
  <div class="form-group">
    <label class="block text-sm font-medium text-gray-700 mb-1 text-right">
      الاسم الكامل
    </label>
    <input 
      type="text" 
      class="form-input w-full text-right py-3 px-4 rounded-lg border border-gray-300"
      placeholder="أدخل اسمك هنا"
    >
  </div>
  
  <!-- Mixed content: Arabic label, LTR input -->
  <div class="form-group">
    <label class="block text-sm font-medium text-gray-700 mb-1 text-right">
      البريد الإلكتروني
    </label>
    <input 
      type="email" 
      dir="ltr"
      class="form-input w-full text-left py-3 px-4 rounded-lg border border-gray-300"
      placeholder="you@example.com"
    >
  </div>
</form>
```

### Navigation Patterns

```css
/* Sidebar on the right for RTL */
.layout-rtl {
  @apply flex;
}
.layout-rtl .sidebar {
  @apply order-last; /* Sidebar on right */
  border-inline-start: 1px solid theme('colors.gray.200');
}
.layout-rtl .main-content {
  @apply order-first;
}

/* Breadcrumbs - flip the separator */
.breadcrumb-rtl {
  @apply flex items-center gap-2;
  flex-direction: row-reverse;
}
.breadcrumb-rtl .separator {
  transform: scaleX(-1);
}
```

---

## 4. Color Psychology for Sales

### The Palette

```css
:root {
  /* Trust & Stability (primary actions) */
  --color-trust: #2563eb;        /* Blue - reliable, professional */
  --color-trust-light: #dbeafe;
  
  /* Money & Success */
  --color-money: #059669;        /* Green - growth, profit, success */
  --color-money-light: #d1fae5;
  
  /* Urgency & Sales */
  --color-urgent: #dc2626;       /* Red - urgency, limited time */
  --color-urgent-light: #fee2e2;
  
  /* Premium & Luxury */
  --color-premium: #7c3aed;      /* Purple - premium, exclusive */
  --color-gold: #d97706;         /* Amber/Gold - value, premium */
  
  /* Neutral backdrop */
  --color-surface: #f9fafb;
  --color-text: #111827;
  --color-muted: #6b7280;
}
```

### When to Use Each Color

```html
<!-- GREEN: Money, savings, success, positive metrics -->
<div class="revenue-card bg-green-50 border border-green-200 rounded-xl p-4">
  <p class="text-sm text-green-700">الأرباح هذا الشهر</p>
  <p class="text-3xl font-bold text-green-600">+12,450 ر.س</p>
  <p class="text-sm text-green-600 flex items-center gap-1">
    <svg class="w-4 h-4"><!-- up arrow --></svg>
    +23% عن الشهر الماضي
  </p>
</div>

<!-- RED: Urgency, limited offers, declining metrics -->
<div class="urgency-banner bg-red-600 text-white py-3 px-4 rounded-lg">
  <p class="font-bold">⏰ العرض ينتهي خلال 2 ساعة!</p>
  <p class="text-red-100 text-sm">وفر 40% - باقي 5 قطع فقط</p>
</div>

<!-- BLUE: Primary actions, trust, main CTAs -->
<button class="bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg">
  أضف للسلة
</button>

<!-- GOLD/AMBER: Premium, featured, special -->
<div class="premium-badge inline-flex items-center gap-1 bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-sm font-medium">
  <svg class="w-4 h-4"><!-- star/crown --></svg>
  منتج مميز
</div>
```

### Button Hierarchy

```css
/* Primary: Main action - one per screen */
.btn-primary {
  @apply bg-blue-600 hover:bg-blue-700 text-white;
  @apply font-medium py-3 px-6 rounded-lg;
  @apply shadow-sm hover:shadow transition-all;
}

/* Secondary: Supporting actions */
.btn-secondary {
  @apply bg-white hover:bg-gray-50 text-gray-700;
  @apply border border-gray-300;
  @apply font-medium py-3 px-6 rounded-lg;
}

/* Success: Confirmations, positive actions */
.btn-success {
  @apply bg-green-600 hover:bg-green-700 text-white;
  @apply font-medium py-3 px-6 rounded-lg;
}

/* Danger: Destructive, urgent */
.btn-danger {
  @apply bg-red-600 hover:bg-red-700 text-white;
  @apply font-medium py-3 px-6 rounded-lg;
}

/* Ghost: Tertiary actions */
.btn-ghost {
  @apply bg-transparent hover:bg-gray-100 text-gray-600;
  @apply font-medium py-3 px-6 rounded-lg;
}
```

### Status Colors

```css
/* Semantic status indicators */
.status-badge {
  @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium;
}

.status-success { @apply bg-green-100 text-green-800; }  /* Paid, Complete, Active */
.status-warning { @apply bg-amber-100 text-amber-800; }  /* Pending, Processing */
.status-danger  { @apply bg-red-100 text-red-800; }      /* Failed, Cancelled */
.status-info    { @apply bg-blue-100 text-blue-800; }    /* New, Info */
.status-neutral { @apply bg-gray-100 text-gray-800; }    /* Draft, Archived */
```

---

## 5. Mobile-First Patterns

### Thumb Zone Design

```
┌─────────────────────┐
│  ❌ Hard to reach   │  Top 20% - Put secondary actions here
│                     │
│  ⚠️ Possible        │  Middle - Navigation, content
│                     │
│  ✅ Easy / Natural  │  Bottom 30% - Primary actions, nav
└─────────────────────┘
```

```css
/* Sticky bottom action bar - always accessible */
.sticky-action-bar {
  @apply fixed bottom-0 inset-x-0 z-50;
  @apply bg-white border-t border-gray-200;
  @apply px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))];
  @apply flex gap-3;
}

/* Bottom sheet modal - more natural than centered modals */
.bottom-sheet {
  @apply fixed inset-x-0 bottom-0 z-50;
  @apply bg-white rounded-t-2xl shadow-xl;
  @apply max-h-[85vh] overflow-auto;
  @apply pb-[env(safe-area-inset-bottom)];
  animation: slide-up 0.3s ease-out;
}

@keyframes slide-up {
  from { transform: translateY(100%); }
  to { transform: translateY(0); }
}

/* Bottom navigation */
.bottom-nav {
  @apply fixed bottom-0 inset-x-0 z-40;
  @apply bg-white border-t border-gray-200;
  @apply flex justify-around items-center;
  @apply h-16 pb-[env(safe-area-inset-bottom)];
}

.bottom-nav-item {
  @apply flex flex-col items-center justify-center gap-1;
  @apply text-gray-500 hover:text-blue-600;
  @apply min-w-[64px] py-2;
}
.bottom-nav-item.active {
  @apply text-blue-600;
}
```

### Touch Targets

```css
/* Minimum touch target: 44×44px (Apple HIG), 48×48px (Material) */
.touch-target {
  @apply min-h-[44px] min-w-[44px];
  @apply flex items-center justify-center;
}

/* Expandable touch target (visual is smaller than tap area) */
.btn-icon {
  @apply relative p-2;
}
.btn-icon::before {
  content: '';
  @apply absolute -inset-2; /* Extends tap area 8px in each direction */
}

/* List items with comfortable spacing */
.list-item-touch {
  @apply flex items-center gap-3 py-4 px-4;
  @apply min-h-[56px]; /* Comfortable tap height */
  @apply active:bg-gray-50;
}

/* Form inputs - bigger for mobile */
.input-mobile {
  @apply w-full py-4 px-4 text-base; /* 16px+ prevents iOS zoom */
  @apply rounded-xl border border-gray-300;
  @apply focus:ring-2 focus:ring-blue-500;
}
```

### Mobile-Optimized Components

```html
<!-- Full-width buttons on mobile -->
<div class="px-4 pb-4 space-y-3">
  <button class="w-full py-4 bg-blue-600 text-white font-medium rounded-xl text-lg">
    إتمام الشراء
  </button>
  <button class="w-full py-4 bg-gray-100 text-gray-700 font-medium rounded-xl">
    متابعة التسوق
  </button>
</div>

<!-- Swipeable cards -->
<div class="overflow-x-auto pb-4 -mx-4 px-4 snap-x snap-mandatory">
  <div class="flex gap-3">
    <div class="snap-start shrink-0 w-[280px] bg-white rounded-xl p-4 shadow-sm">
      <!-- Card content -->
    </div>
    <!-- More cards -->
  </div>
</div>

<!-- Pull-to-refresh indicator -->
<div class="pull-indicator text-center py-4 text-gray-500">
  <svg class="w-6 h-6 mx-auto animate-spin"><!-- spinner --></svg>
  <span class="text-sm">جاري التحديث...</span>
</div>
```

### Responsive Breakpoints

```css
/* Mobile-first breakpoints (Tailwind defaults) */
/* Default: Mobile (< 640px) */
/* sm: 640px+  (large phones, small tablets) */
/* md: 768px+  (tablets) */
/* lg: 1024px+ (laptops) */
/* xl: 1280px+ (desktops) */

/* Example: Cards stack on mobile, grid on desktop */
.product-grid {
  @apply grid grid-cols-1 gap-4;
  @apply sm:grid-cols-2;
  @apply lg:grid-cols-3;
  @apply xl:grid-cols-4;
}

/* Hide desktop elements on mobile */
.desktop-only {
  @apply hidden lg:block;
}

/* Mobile-only elements */
.mobile-only {
  @apply block lg:hidden;
}
```

---

## 6. Micro-Copy That Sells

### Button Text

```
❌ Bad                          ✅ Good
─────────────────────────────────────────────────
Submit                         → إتمام الطلب
Sign Up                        → ابدأ مجاناً
Learn More                     → اكتشف كيف تزيد مبيعاتك
Download                       → حمّل دليلك المجاني
Buy Now                        → احصل عليه الآن
Subscribe                      → انضم لـ 10,000+ تاجر
Register                       → أنشئ متجرك في دقيقتين
Try Free                       → جرّب 14 يوم مجاناً
Continue                       → التالي: اختر طريقة الدفع
```

### Social Proof Patterns

```html
<!-- User count with specificity -->
<p class="social-proof text-sm text-gray-600">
  <span class="font-semibold text-gray-900">+12,847</span> تاجر يستخدمون ربح
</p>

<!-- Recent activity (FOMO) -->
<div class="recent-activity flex items-center gap-2 text-sm bg-gray-50 px-3 py-2 rounded-lg">
  <img src="/avatars/recent.jpg" class="w-6 h-6 rounded-full">
  <span class="text-gray-600">أحمد من الرياض اشترك قبل <span class="font-medium">3 دقائق</span></span>
</div>

<!-- Rating with count -->
<div class="rating flex items-center gap-1.5">
  <div class="stars flex">
    ⭐⭐⭐⭐⭐
  </div>
  <span class="text-sm font-medium">4.9</span>
  <span class="text-sm text-gray-500">(2,341 تقييم)</span>
</div>

<!-- Trust indicators -->
<div class="trust-list space-y-2 text-sm text-gray-600">
  <p class="flex items-center gap-2">
    <svg class="w-5 h-5 text-green-500"><!-- check --></svg>
    ضمان استرجاع 30 يوم
  </p>
  <p class="flex items-center gap-2">
    <svg class="w-5 h-5 text-green-500"><!-- check --></svg>
    دعم فني 24/7
  </p>
  <p class="flex items-center gap-2">
    <svg class="w-5 h-5 text-green-500"><!-- check --></svg>
    لا يحتاج بطاقة ائتمان
  </p>
</div>
```

### Error & Empty States

```html
<!-- Friendly error messages -->
<div class="error-message bg-red-50 border border-red-200 rounded-lg p-4">
  <p class="font-medium text-red-800">عذراً، حدث خطأ</p>
  <p class="text-sm text-red-600 mt-1">لم نتمكن من إتمام الطلب. يرجى المحاولة مرة أخرى.</p>
  <button class="mt-3 text-sm font-medium text-red-700 underline">إعادة المحاولة</button>
</div>

<!-- Empty state with CTA -->
<div class="empty-state text-center py-12 px-4">
  <div class="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
    <svg class="w-8 h-8 text-gray-400"><!-- shopping bag icon --></svg>
  </div>
  <h3 class="text-lg font-medium text-gray-900">سلة التسوق فارغة</h3>
  <p class="text-gray-500 mt-1 mb-4">اكتشف منتجاتنا المميزة وابدأ التسوق</p>
  <button class="btn-primary">تصفح المنتجات</button>
</div>

<!-- Success state -->
<div class="success-state text-center py-8">
  <div class="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
    <svg class="w-8 h-8 text-green-600"><!-- checkmark --></svg>
  </div>
  <h3 class="text-xl font-bold text-gray-900">تم بنجاح! 🎉</h3>
  <p class="text-gray-600 mt-2">سيصلك تأكيد الطلب على واتساب</p>
</div>
```

### Form Labels & Helpers

```html
<div class="form-group">
  <label class="block text-sm font-medium text-gray-700 mb-1">
    اسم المتجر
    <span class="text-red-500">*</span>
  </label>
  <input type="text" class="form-input" placeholder="مثال: متجر الأزياء">
  <p class="mt-1 text-xs text-gray-500">
    سيظهر هذا الاسم للعملاء في الفواتير والرسائل
  </p>
</div>

<!-- Inline validation -->
<div class="form-group">
  <label class="block text-sm font-medium text-gray-700 mb-1">رقم الجوال</label>
  <div class="relative">
    <input type="tel" class="form-input pr-10 border-green-500 focus:ring-green-500">
    <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-green-500"><!-- check --></svg>
  </div>
  <p class="mt-1 text-xs text-green-600">✓ رقم صحيح - سنرسل كود التفعيل</p>
</div>
```

### Loading States

```html
<!-- Button loading -->
<button class="btn-primary" disabled>
  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 inline"><!-- spinner --></svg>
  جاري الإرسال...
</button>

<!-- Skeleton loading -->
<div class="animate-pulse space-y-4">
  <div class="h-4 bg-gray-200 rounded w-3/4"></div>
  <div class="h-4 bg-gray-200 rounded w-1/2"></div>
  <div class="h-10 bg-gray-200 rounded"></div>
</div>
```

---

## 7. Component Library

### Quick Copy-Paste Components

#### Pricing Card

```html
<div class="pricing-card bg-white rounded-2xl shadow-lg border-2 border-blue-500 p-6 relative">
  <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-sm font-medium px-4 py-1 rounded-full">
    الأكثر شعبية
  </div>
  
  <h3 class="text-xl font-bold text-gray-900 mb-2">الباقة الاحترافية</h3>
  <p class="text-gray-500 text-sm mb-4">مثالية للمتاجر النامية</p>
  
  <div class="mb-6">
    <span class="text-4xl font-bold text-gray-900">199</span>
    <span class="text-gray-500">ر.س/شهرياً</span>
  </div>
  
  <ul class="space-y-3 mb-6 text-sm text-gray-600">
    <li class="flex items-center gap-2">
      <svg class="w-5 h-5 text-green-500 shrink-0"><!-- check --></svg>
      <span>منتجات غير محدودة</span>
    </li>
    <li class="flex items-center gap-2">
      <svg class="w-5 h-5 text-green-500 shrink-0"><!-- check --></svg>
      <span>رسائل واتساب تلقائية</span>
    </li>
    <li class="flex items-center gap-2">
      <svg class="w-5 h-5 text-green-500 shrink-0"><!-- check --></svg>
      <span>تقارير متقدمة</span>
    </li>
  </ul>
  
  <button class="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors">
    ابدأ الآن
  </button>
</div>
```

#### Metric Card (Dashboard)

```html
<div class="metric-card bg-white rounded-xl p-6 shadow-sm border border-gray-100">
  <div class="flex items-center justify-between mb-4">
    <span class="text-sm font-medium text-gray-500">إجمالي المبيعات</span>
    <span class="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
      +12.5%
    </span>
  </div>
  <p class="text-3xl font-bold text-gray-900 mb-1" dir="ltr">
    45,230 <span class="text-lg text-gray-500 font-normal">ر.س</span>
  </p>
  <p class="text-sm text-gray-500">مقارنة بـ 40,200 ر.س الشهر الماضي</p>
</div>
```

#### Product Card

```html
<div class="product-card bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
  <div class="relative aspect-square bg-gray-100">
    <img src="/product.jpg" alt="اسم المنتج" class="w-full h-full object-cover">
    <span class="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
      -30%
    </span>
  </div>
  <div class="p-4">
    <h3 class="font-medium text-gray-900 mb-1 line-clamp-2">اسم المنتج هنا</h3>
    <div class="flex items-center gap-2 mb-3">
      <span class="text-lg font-bold text-gray-900">149 ر.س</span>
      <span class="text-sm text-gray-400 line-through">199 ر.س</span>
    </div>
    <button class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors">
      أضف للسلة
    </button>
  </div>
</div>
```

#### Order Status Timeline

```html
<div class="timeline space-y-0" dir="rtl">
  <div class="timeline-item flex gap-4">
    <div class="timeline-marker flex flex-col items-center">
      <div class="w-8 h-8 rounded-full bg-green-500 text-white flex items-center justify-center">
        <svg class="w-4 h-4"><!-- check --></svg>
      </div>
      <div class="w-0.5 h-12 bg-green-500"></div>
    </div>
    <div class="pb-8">
      <p class="font-medium text-gray-900">تم استلام الطلب</p>
      <p class="text-sm text-gray-500">اليوم، 2:30 م</p>
    </div>
  </div>
  
  <div class="timeline-item flex gap-4">
    <div class="timeline-marker flex flex-col items-center">
      <div class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center animate-pulse">
        <svg class="w-4 h-4"><!-- truck --></svg>
      </div>
      <div class="w-0.5 h-12 bg-gray-200"></div>
    </div>
    <div class="pb-8">
      <p class="font-medium text-blue-600">جاري الشحن</p>
      <p class="text-sm text-gray-500">الوصول المتوقع: غداً</p>
    </div>
  </div>
  
  <div class="timeline-item flex gap-4">
    <div class="timeline-marker">
      <div class="w-8 h-8 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center">
        <svg class="w-4 h-4"><!-- home --></svg>
      </div>
    </div>
    <div>
      <p class="font-medium text-gray-400">تم التوصيل</p>
      <p class="text-sm text-gray-400">في انتظار التوصيل</p>
    </div>
  </div>
</div>
```

---

## Quick Reference

### Tailwind Classes for Arabic

```
text-right      → Default text alignment for RTL
space-x-reverse → Reverse horizontal spacing
flex-row-reverse → Flip flex direction
```

### Font Sizes

```
text-xs   → 12px (helper text, badges)
text-sm   → 14px (secondary text)
text-base → 16px (body - minimum for Arabic!)
text-lg   → 18px (emphasis)
text-xl   → 20px (headings)
text-2xl  → 24px (section titles)
text-3xl  → 30px (page titles)
text-4xl+ → 36px+ (hero, metrics)
```

### Spacing Scale

```
4px  → gap-1, p-1  (tight)
8px  → gap-2, p-2  (compact)
12px → gap-3, p-3  (default)
16px → gap-4, p-4  (comfortable)
24px → gap-6, p-6  (spacious)
32px → gap-8, p-8  (section breaks)
```

### Recommended Fonts

**Arabic:**
- IBM Plex Sans Arabic (Google Fonts) - clean, modern
- Tajawal (Google Fonts) - great for headlines
- Noto Sans Arabic - excellent Unicode coverage

**Numbers/Code:**
- JetBrains Mono
- SF Mono (iOS)
- Roboto Mono

---

## Implementation Checklist

- [ ] Set `dir="rtl"` and `lang="ar"` on HTML
- [ ] Use logical CSS properties (`padding-inline-start` vs `padding-left`)
- [ ] Test all icons for RTL mirroring needs
- [ ] Ensure form inputs are min 16px to prevent iOS zoom
- [ ] Place primary CTAs in bottom thumb zone
- [ ] Add loading states to all async actions
- [ ] Include social proof near conversion points
- [ ] Test on actual mobile devices (not just DevTools)
- [ ] Verify touch targets are 44px minimum
- [ ] Add `safe-area-inset` padding for notched devices

---

*This guide is a living document. Update as you discover new patterns that work.*
