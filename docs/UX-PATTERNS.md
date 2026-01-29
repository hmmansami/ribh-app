# UX Patterns for E-Commerce Apps

> A comprehensive guide based on Shopify, Salla, WooCommerce, and leading SaaS apps  
> Last updated: January 2026

---

## Table of Contents
1. [Onboarding Flows](#1-best-onboarding-flows)
2. [Dashboard Layouts](#2-dashboard-layouts-that-merchants-love)
3. [Notification/Alert Patterns](#3-notificationalert-patterns-that-dont-annoy)
4. [Settings Pages](#4-settings-pages-that-are-actually-usable)
5. [Empty States](#5-empty-states-that-guide-action)
6. [Error States](#6-error-states-that-help-recover)
7. [Loading States](#7-loading-states-that-feel-fast)

---

## 1. Best Onboarding Flows

### Psychology: Why Onboarding Matters
- **First impressions are lasting** – Users form opinions within 50ms
- **Cognitive load kills** – Too much choice = paralysis
- **Progress motivates** – The closer to a goal, the harder people push (Goal Gradient Effect)
- **Investment creates commitment** – Users who customize feel ownership

### 🏆 Top Pattern: Progressive Disclosure with Quick Wins

#### Example: HubSpot's Onboarding
```
Step 1: Email validation → Single CTA "Confirm Email"
Step 2: Password + real-time checklist (turns green as you meet requirements)
Step 3: Personalization questions (role, goals)
Step 4: Interactive product tour with meaningful tasks
```

**Why it works:**
- ✅ Validates email first (filters tire-kickers)
- ✅ Password checklist = instant feedback loop
- ✅ Questions feel relevant, not invasive
- ✅ Tour accomplishes real work, not fake tasks

#### Example: Trello's Welcome Board
```
┌─────────────────────────────────────────────────┐
│  📋 Welcome Board                               │
├─────────────┬─────────────┬─────────────────────┤
│ To Do       │ Doing       │ Done                │
├─────────────┼─────────────┼─────────────────────┤
│ □ Click me  │ □ Drag here │ ✓ You did it!      │
│ □ Add card  │             │                     │
└─────────────┴─────────────┴─────────────────────┘
```

**Why it works:**
- ✅ Teaches by doing, not reading
- ✅ Pre-filled content shows value immediately
- ✅ Satisfies visual learners
- ✅ Zero friction—you're already using the product

#### Example: Shopify App Onboarding
Best Shopify apps follow this pattern:
```
1. [Installation] → Auto-detect store settings
2. [Setup Wizard] → 3-5 steps max with progress bar
3. [First Success] → Guide to first sale/action
4. [Ongoing Tips] → Contextual help as they explore
```

**Key principles from Shopify Design Guidelines:**
- Match the Shopify admin's familiar patterns
- Prioritize mobile—majority of merchants check mobile first
- Be predictable, not unique for uniqueness' sake

### ✍️ Best Practices for RIBH

```plaintext
RIBH Onboarding Flow (Recommended):

1. WhatsApp Setup (5 sec)
   → Scan QR code
   → "Connected ✓" confirmation
   
2. Quick Win (30 sec)
   → "Send your first abandoned cart reminder"
   → Show live preview of message
   
3. Store Sync (automatic)
   → Progress bar: "Importing 47 products..."
   → Show real product images as they import
   
4. Dashboard Tour (optional)
   → Hotspots on 3 key areas only
   → Skip button always visible
```

### ⚠️ Anti-Patterns to Avoid
- ❌ Mandatory 10-step wizards
- ❌ Asking for permissions before showing value
- ❌ Video tutorials that can't be skipped
- ❌ "Got it" buttons that don't teach anything

---

## 2. Dashboard Layouts That Merchants Love

### Psychology: What Merchants Need
- **Glanceable status** – "Is my store okay?" in 2 seconds
- **Actionable insights** – Not data, but "do this next"
- **Pattern recognition** – Trends matter more than absolutes
- **Control without overwhelm** – Power users want depth; new users need simplicity

### 🏆 Top Pattern: The Action-First Dashboard

#### Layout Structure
```
┌──────────────────────────────────────────────────────────┐
│  🔔 Critical Alert Banner (if any)                       │
├──────────────────────────────────────────────────────────┤
│  QUICK ACTIONS          │  TODAY'S SNAPSHOT              │
│  [Send Campaign]        │  💰 Revenue: $1,247 (+12%)     │
│  [View Cart Abandons]   │  📦 Orders: 23                 │
│  [Check Messages]       │  💬 Unread: 5 messages         │
├──────────────────────────────────────────────────────────┤
│  📊 PERFORMANCE CHART (7 days default)                   │
│  ▁▃▅▇█▆▄ with hover details                              │
├─────────────────────────────┬────────────────────────────┤
│  🎯 SUGGESTED ACTIONS       │  📋 RECENT ACTIVITY        │
│  "47 carts abandoned today" │  • Order #1234 shipped     │
│  → [Recover Now]            │  • New review received     │
│  "Response rate: 89%"       │  • Payment confirmed       │
│  → "Great job! 🎉"          │                            │
└─────────────────────────────┴────────────────────────────┘
```

### Key Principles from Top Apps

#### Shopify Dashboard Patterns
- **Home card system** – Modular, contextual cards
- **Traffic light status** – Green/yellow/red for quick scanning
- **Comparison context** – "vs. yesterday" or "vs. last week"
- **Personalized suggestions** – AI-driven "You should try..."

#### WooCommerce Admin Patterns
- **Inbox notifications** – Actionable tips, not noise
- **Activity panel** – Real-time order/review feed
- **Stats overview** – Expandable detailed views
- **Task lists** – Setup completion tracking

### ✍️ Best Practices for RIBH Dashboard

```plaintext
RIBH Dashboard Structure:

┌─ HEALTH INDICATOR ────────────────────┐
│  WhatsApp: 🟢 Connected               │
│  Last sync: 2 min ago                 │
│  Messages today: 127 sent, 89 read    │
└───────────────────────────────────────┘

┌─ ACTION CENTER ───────────────────────┐
│  🛒 12 carts need recovery            │
│     → Average value: 340 SAR          │
│     → [Send Reminders]                │
│                                       │
│  💬 3 customer questions pending      │
│     → [View & Reply]                  │
└───────────────────────────────────────┘

┌─ PERFORMANCE ─────────────────────────┐
│  This Week:                           │
│  • 23 carts recovered (47% rate)      │
│  • 8,420 SAR recovered revenue        │
│  • 4.2s average response time         │
└───────────────────────────────────────┘
```

### ⚠️ Dashboard Anti-Patterns
- ❌ Data without context (what does "127" mean?)
- ❌ Too many numbers competing for attention
- ❌ Graphs that need explanation
- ❌ Actions buried in menus
- ❌ No clear "what to do next"

---

## 3. Notification/Alert Patterns That Don't Annoy

### Psychology: Why Notifications Fail
- **Notification fatigue** – Each alert trains users to ignore future ones
- **Interruption cost** – 23 minutes to refocus after distraction
- **Relevance decay** – Generic messages become invisible
- **Control matters** – Feeling spammed = immediate uninstall

### 🏆 Top Pattern: Tiered Notification System

#### Severity Levels (from Shopify Polaris)

| Level | When to Use | Behavior | Example |
|-------|-------------|----------|---------|
| **Critical (Red)** | Immediate harm to business | Persistent, can't dismiss | "Payment failed—orders paused" |
| **Warning (Yellow)** | Needs attention soon | Dismissible, but visible | "Stock low for bestseller" |
| **Info (Blue)** | Good to know | Auto-dismiss after read | "New feature available" |
| **Success (Green)** | Confirmation | Auto-dismiss 3-5 sec | "Order shipped ✓" |

#### Toast vs Banner vs Modal

```plaintext
TOAST (Bottom of screen, ephemeral):
├── Use for: Action confirmations
├── Duration: 3-5 seconds, max 3 words
├── Example: "Message sent ✓"
└── Never: Error messages (too easy to miss)

BANNER (Top of page/section, persistent):
├── Use for: System status, required actions
├── Dismissible: Yes, unless critical
├── Example: "WhatsApp session expired—reconnect"
└── Never: Marketing messages (use callout cards)

MODAL (Blocking overlay):
├── Use for: Destructive actions, critical decisions
├── Only when: User initiated or truly urgent
├── Example: "Delete all messages? This can't be undone"
└── Never: Announcements, tips, promotions
```

### LinkedIn's 500% Notification Opt-In Increase
**What they did:**
1. Asked for permission at the moment of value
2. Showed exactly what notifications would look like
3. Let users customize frequency immediately
4. Honored preferences religiously

### ✍️ Best Practices for RIBH Notifications

```plaintext
In-App Alerts:
┌────────────────────────────────────────────┐
│ ⚠️ 5 carts abandoned in last hour          │
│    Potential revenue: 1,200 SAR            │
│    [Send Recovery Messages]  [Dismiss]     │
└────────────────────────────────────────────┘

WhatsApp/Push Strategy:
• 🟢 Send: Order updates, payment confirmations
• 🟡 Ask first: Daily summaries, tips
• 🔴 Never: Marketing without consent, at night

Notification Copy Rules:
• Lead with the number or impact
• Make action obvious
• "47 carts" not "There are currently forty-seven shopping carts"
```

### ⚠️ Notification Anti-Patterns
- ❌ "Hey! 👋" empty engagement
- ❌ Daily "check in!" reminders
- ❌ Notifications that require app open to understand
- ❌ "Don't miss out!" FOMO manipulation
- ❌ Duplicate alerts across channels

---

## 4. Settings Pages That Are Actually Usable

### Psychology: Settings Anxiety
- **Decision fatigue** – Every toggle is a choice
- **Fear of breaking things** – "What if I mess up my store?"
- **Paradox of choice** – More options = less satisfaction
- **Defaults matter** – 95% never change defaults

### 🏆 Top Pattern: Smart Defaults + Progressive Disclosure

#### Settings Structure

```plaintext
LEVEL 1: Essential Settings (Always Visible)
├── Store connection status
├── Notification preferences (on/off)
└── Language selection

LEVEL 2: Common Customization (One Click to Access)
├── Message templates
├── Timing rules
└── Auto-reply settings

LEVEL 3: Advanced (Collapsed by Default)
├── API keys
├── Webhook URLs
├── Custom code snippets
└── Danger zone (destructive actions)
```

#### Visual Hierarchy

```plaintext
┌─ SETTINGS ─────────────────────────────────────────┐
│                                                    │
│  📱 WhatsApp Connection                            │
│  ┌──────────────────────────────────────────────┐  │
│  │ Status: 🟢 Connected                         │  │
│  │ Phone: +966 5** *** *38                      │  │
│  │ [Reconnect] [Disconnect]                     │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  🔔 Notifications                      [On ━━●]   │
│     Daily summary                      [On ━━●]   │
│     Abandoned cart alerts              [On ━━●]   │
│                                                    │
│  ▸ Message Templates                              │
│  ▸ Automation Rules                               │
│  ▸ Team Members                                   │
│                                                    │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │
│  ▸ Advanced Settings                              │
│  ▸ Developer Options                              │
│                                                    │
│  ┌─ ⚠️ DANGER ZONE ───────────────────────────┐   │
│  │ [Delete All Data]  [Disconnect Store]      │   │
│  └────────────────────────────────────────────┘   │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Key Principles

1. **Group by task, not by type**
   - ✅ "Cart Recovery Settings" (timing + template + toggle)
   - ❌ "Toggles" / "Dropdowns" / "Text fields"

2. **Explain, don't just label**
   - ✅ "Auto-reply delay: Wait before responding to avoid seeming robotic"
   - ❌ "Delay (seconds)"

3. **Show impact of changes**
   - ✅ Preview message template as you edit
   - ✅ "This will affect 47 scheduled messages"

4. **Make saving obvious**
   - ✅ Auto-save with "Saved ✓" indicator
   - ✅ If manual, sticky save button

### ✍️ RIBH Settings Recommendations

```plaintext
Tab Structure:
├── 📱 Connection (WhatsApp, Salla/Shopify)
├── 💬 Messages (Templates, auto-replies)
├── ⏰ Automation (Timing, triggers)
├── 👤 Account (Profile, billing, team)
└── ⚙️ Advanced (API, exports, danger zone)

Each Section Should Have:
• Brief description of what it does
• Preview/test button where applicable
• Reset to default option
• Link to help docs
```

### ⚠️ Settings Anti-Patterns
- ❌ Wall of toggles without grouping
- ❌ Technical jargon without explanation
- ❌ Settings that require app restart
- ❌ No indication of recommended/default values
- ❌ Destructive actions without confirmation

---

## 5. Empty States That Guide Action

### Psychology: The Empty State Opportunity
- **Nature abhors a vacuum** – Empty = broken in user's mind
- **Blank canvas paralysis** – Without guidance, users freeze
- **First impression** – Empty states ARE the first impression for many features
- **Teaching moment** – Show value before they commit time

### 🏆 Top Pattern: Value-First Empty States

#### Shopify Polaris Empty State Anatomy
```plaintext
┌────────────────────────────────────────────────────────┐
│                                                        │
│                    [Illustration]                      │
│                    (40px white space above)            │
│                                                        │
│              Manage your inventory transfers           │
│              ═══════════════════════════               │
│     Track and receive your incoming inventory          │
│                  from suppliers.                       │
│                                                        │
│              ┌─────────────────┐                       │
│              │  Add transfer   │  ← Primary action     │
│              └─────────────────┘                       │
│                  Learn more     ← Secondary action     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### Empty State Formula

```plaintext
1. ILLUSTRATION
   • Simple, friendly, on-brand
   • Not sad/broken imagery
   • Shows what WILL be there

2. HEADLINE (Action-oriented)
   ✅ "Create orders and send invoices"
   ❌ "Orders and invoices"
   ❌ "No orders yet"

3. DESCRIPTION (Benefit-focused)
   ✅ "Track and receive your incoming inventory from suppliers."
   ❌ "This area is empty. Add items to see them here."

4. PRIMARY ACTION (Verb + Noun)
   ✅ "Add transfer"
   ❌ "Get started"
   ❌ "Click here"

5. SECONDARY ACTION (Learn more)
   ✅ Link to help docs
   ✅ Video tutorial
```

### Context-Specific Empty States

#### Search Results Empty
```plaintext
┌────────────────────────────────────────┐
│  🔍 No results for "xyz"               │
│                                        │
│  Try:                                  │
│  • Checking your spelling              │
│  • Using fewer filters                 │
│  • Searching for something else        │
│                                        │
│  [Clear Filters]  [Browse All]         │
└────────────────────────────────────────┘
```

#### Inbox/Messages Empty
```plaintext
┌────────────────────────────────────────┐
│            📬                          │
│     No messages yet                    │
│                                        │
│  Customer messages will appear here    │
│  when they reply to your campaigns.    │
│                                        │
│  💡 Tip: Send a cart recovery message  │
│     to start conversations!            │
│                                        │
│     [Send Campaign]                    │
└────────────────────────────────────────┘
```

#### Analytics Empty
```plaintext
┌────────────────────────────────────────┐
│            📊                          │
│   Not enough data yet                  │
│                                        │
│  Analytics will populate after your    │
│  first 24 hours of activity.           │
│                                        │
│  Check back tomorrow, or:              │
│  [Send Test Campaign]                  │
└────────────────────────────────────────┘
```

### ✍️ RIBH Empty States

```plaintext
Cart Recovery - Empty:
"🛒 No abandoned carts today
 That's actually great news!
 We'll notify you when carts need recovery."

Conversations - Empty:
"💬 Start conversations that convert
 Send your first campaign and customer
 replies will appear here.
 [Create Campaign]"

Analytics - Empty:
"📈 Your insights are loading
 Give us 24 hours of data to show
 meaningful trends. Meanwhile:
 [Explore Sample Report]"
```

### ⚠️ Empty State Anti-Patterns
- ❌ "No data" (and nothing else)
- ❌ Sad/broken imagery (crying faces, error symbols)
- ❌ Technical messages ("null", "undefined", "0 records")
- ❌ Blaming the user ("You haven't added anything")
- ❌ Missing call to action

---

## 6. Error States That Help Recover

### Psychology: Error State Emotions
- **Fight or flight** – Errors trigger stress response
- **Blame avoidance** – Users blame themselves first, then the product
- **Helplessness** – Without clear next steps, users quit
- **Trust damage** – One bad error = "this product is buggy"

### 🏆 Top Pattern: Problem → Impact → Solution

#### Shopify Error Message Formula

```plaintext
GOOD ERROR:
┌────────────────────────────────────────────────────┐
│ 🔴 Couldn't deposit payout                         │
│                                                    │
│ The bank account we have on file was closed.       │
│ Update your details, and we'll retry automatically.│
│                                                    │
│ [Update Bank Account]                              │
└────────────────────────────────────────────────────┘

BAD ERROR:
┌────────────────────────────────────────────────────┐
│ ⚠️ Invalid bank account                            │
│                                                    │
│ Your payout was not deposited because your bank    │
│ account was closed. Go to your bank account        │
│ details and update them to match a valid checking  │
│ account. Then save so that we can retry.           │
│                                                    │
│ [Next]                                             │
└────────────────────────────────────────────────────┘
```

### Error Message Checklist

| Element | Do | Don't |
|---------|-----|-------|
| **Tone** | Calm, helpful | Alarmist, blaming |
| **Language** | Plain English | Jargon ("invalid", "error 500") |
| **Specificity** | Exact issue + fix | Vague "something went wrong" |
| **Action** | One clear CTA | "Contact support" as only option |
| **Apology** | Only if it's your fault | Over-apologizing |

### Error Types & Patterns

#### Form Validation Errors
```plaintext
✅ GOOD:
┌─────────────────────────────────────────┐
│ To save this product, make 2 changes:   │
│ • Enter title                           │
│ • Add weight                            │
└─────────────────────────────────────────┘

❌ BAD:
┌─────────────────────────────────────────┐
│ There are 2 errors on this page.        │
│ • Invalid title                         │
│ • Weight must be > 0.1 lb               │
└─────────────────────────────────────────┘
```

#### Connection Errors
```plaintext
✅ GOOD:
┌─────────────────────────────────────────┐
│ Connection timed out                    │
│ [Retry]                                 │
└─────────────────────────────────────────┘

❌ BAD:
┌─────────────────────────────────────────┐
│ Sorry, the connection timed out.        │
│ Try again later.                        │
│ [Learn more]                            │
└─────────────────────────────────────────┘
```

#### System Errors
```plaintext
✅ GOOD:
┌─────────────────────────────────────────┐
│ Something went wrong.                   │
│ Refresh your browser to try again.      │
│ [Refresh]                               │
└─────────────────────────────────────────┘

❌ BAD:
┌─────────────────────────────────────────┐
│ Sorry, something went wrong.            │
│ Learn more.                             │
└─────────────────────────────────────────┘
```

### ✍️ RIBH Error Messages

```plaintext
WhatsApp Disconnected:
"📱 WhatsApp session expired
 This happens every 14 days for security.
 Scan the QR code to reconnect.
 [Reconnect Now]"

Message Failed:
"❌ Message couldn't be delivered
 Phone number may be invalid or WhatsApp blocked.
 • Check the number format (+966...)
 • Try sending a test message
 [Edit Number] [Skip This Customer]"

API Error:
"⚠️ Couldn't sync with Salla
 Our connection to your store was interrupted.
 Your data is safe—we'll retry in 5 minutes.
 [Retry Now] [Check Status]"
```

### ⚠️ Error Anti-Patterns
- ❌ "Error: null" or error codes only
- ❌ "Oops!" without substance
- ❌ Blaming the user ("You entered invalid data")
- ❌ Technical details exposed to non-technical users
- ❌ No way to recover or retry
- ❌ "Contact support" as the only solution

---

## 7. Loading States That Feel Fast

### Psychology: Perceived vs Actual Speed
- **100ms** – Feels instant, no feedback needed
- **1 second** – Noticeable, but feels continuous
- **10 seconds** – Attention limit, show progress
- **Progress bars** – Feel faster than spinners (even if same time)
- **Content loads** – Showing ANYTHING beats showing nothing

### 🏆 Top Pattern: Skeleton Loading with Progressive Content

#### Shopify Loading Principles

1. **Make it fast** – Prioritize visible content, cache common data
2. **Make good use of time** – Show structure, not spinners
3. **Focus on the job** – Don't distract with loading animations

#### Skeleton Loading Pattern

```plaintext
LOADING:                         LOADED:
┌────────────────────────────┐   ┌────────────────────────────┐
│ ████████████ (title)       │   │ Cart Recovery Dashboard    │
│ ██████████████████████     │   │ 47 carts need attention    │
│                            │   │                            │
│ ┌──────────────────────┐   │   │ ┌──────────────────────┐   │
│ │ ████████████         │   │   │ │ Ahmed M. - 340 SAR   │   │
│ │ ████████             │   │   │ │ Abandoned 2h ago     │   │
│ └──────────────────────┘   │   │ └──────────────────────┘   │
│ ┌──────────────────────┐   │   │ ┌──────────────────────┐   │
│ │ ████████████         │   │   │ │ Fatima S. - 520 SAR  │   │
│ │ ████████             │   │   │ │ Abandoned 4h ago     │   │
│ └──────────────────────┘   │   │ └──────────────────────┘   │
└────────────────────────────┘   └────────────────────────────┘
```

### Loading States Hierarchy

```plaintext
1. INSTANT (<100ms)
   → No loading indicator needed
   → Optimistic UI updates

2. BRIEF (100ms - 1s)
   → Subtle spinner on action button
   → Button disabled state
   → "Saving..." text

3. MODERATE (1-10s)
   → Skeleton screens
   → Progress indicators
   → Real content appearing progressively

4. LONG (>10s)
   → Progress bar with percentage
   → Estimated time remaining
   → Option to background the task
   → Ability to cancel
```

### Best Practices from Shopify Polaris

| Do | Don't |
|-----|-------|
| Show real layout structure | Show empty view with spinner |
| Use skeleton shapes that match content | Use generic placeholders |
| Make layout visually stable | Let content jump around as it loads |
| Show static content immediately | Hide everything until all data ready |
| Animate content smoothly in | Pop content in suddenly |
| Cache commonly needed data | Re-fetch everything on each page |

### Toast Loading Pattern

```plaintext
ACTION:     [Send Messages]
             ↓
LOADING:    [Sending... ━━━━━━●━━━━━]
             ↓
SUCCESS:    ✓ 47 messages sent
            (Auto-dismiss in 3s)
```

### ✍️ RIBH Loading Patterns

```plaintext
Dashboard Loading:
┌────────────────────────────────────────┐
│  WhatsApp: 🟢 Connected                │ ← Static, show immediately
│  ████████████████████████              │ ← Skeleton for dynamic
│                                        │
│  ┌──────────────────────┐              │
│  │ ████ carts ████      │              │
│  │ ██████████████       │              │
│  └──────────────────────┘              │
└────────────────────────────────────────┘

Message Sending:
• Button: "Send" → "Sending..." (disabled)
• Progress: ━━━━━━━━━━●━━━━━ 47/50
• Complete: Toast "✓ Sent to 50 customers"

Data Sync:
• Show: "Syncing with Salla..."
• Progress: Actual count "127/340 products"
• Complete: "Last synced: just now"
```

### ⚠️ Loading Anti-Patterns
- ❌ Full-page spinners for partial content loads
- ❌ Blocking UI for background operations
- ❌ No indication of progress on long operations
- ❌ Skeleton screens that don't match final layout
- ❌ Loading states that cause layout shift
- ❌ Spinners as placeholders (use skeleton shapes)

---

## Quick Reference Card

### The 7 Patterns Summary

| Pattern | Core Principle | Key Metric |
|---------|---------------|------------|
| **Onboarding** | Quick win within 2 minutes | Activation rate |
| **Dashboard** | Glanceable status + clear actions | Time to insight |
| **Notifications** | Right message, right time, right channel | Opt-out rate |
| **Settings** | Smart defaults + progressive disclosure | Support tickets |
| **Empty States** | Teach value, guide action | Feature adoption |
| **Error States** | Problem → Impact → Solution | Recovery rate |
| **Loading States** | Show structure, not spinners | Perceived speed |

### Psychology Cheat Sheet

| Principle | Application |
|-----------|-------------|
| **Goal Gradient** | Progress bars motivate completion |
| **Cognitive Load** | Max 3-5 options per screen |
| **Loss Aversion** | "Recover 340 SAR" > "Send reminder" |
| **Social Proof** | "12,000 merchants use this" |
| **Reciprocity** | Give value before asking for commitment |
| **Endowed Progress** | Pre-fill onboarding steps |

---

## Resources

### Design Systems
- [Shopify Polaris](https://polaris.shopify.com) – Components & patterns
- [Atlassian Design](https://atlassian.design) – Enterprise patterns
- [Material Design](https://material.io) – Mobile-first components

### UX Research
- [Nielsen Norman Group](https://nngroup.com/articles) – Evidence-based UX
- [Growth.Design](https://growth.design/case-studies) – Psychology-focused teardowns
- [Baymard Institute](https://baymard.com/blog) – E-commerce specific research

### Inspiration
- [Mobbin](https://mobbin.com) – Mobile app screenshots
- [Page Flows](https://pageflows.com) – User flow recordings
- [Really Good Emails](https://reallygoodemails.com) – Email design

---

*Document created for RIBH app development. Apply these patterns with cultural sensitivity for Saudi/Gulf merchants.*
