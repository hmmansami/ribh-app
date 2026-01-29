# RIBH Feature Research - Premium Upsell & Pricing Tools

> **Research Date:** January 2025  
> **Goal:** Reverse engineer premium tools to find highest ROI features for RIBH

---

## 📊 Executive Summary

| Tool | Monthly Cost | Key Value Prop | Claimed ROI |
|------|-------------|----------------|-------------|
| **Zipify OCU** | $8/mo base | Post-purchase one-click upsells | +20-30% AOV |
| **Pricefy** | $29-249/mo | Competitor price monitoring | Time savings + margin protection |
| **Omnia Retail** | $500-2000+/mo | AI dynamic pricing | 2-10% margin improvement |
| **Informed Repricer** | $99-499/mo | Amazon Buy Box winning | +63% Buy Box ownership |

**🎯 Highest ROI Features for RIBH:**
1. **Post-Purchase Upsells** (Easy, high-impact, proven $$$)
2. **AI Product Recommendations** (Low effort, compounds over time)
3. **Competitor Price Monitoring** (Critical for competitive markets)
4. **Dynamic Repricing Rules** (Automates tedious manual work)

---

## 1. Zipify OCU (One-Click Upsells)

### 💰 Business Model
- **Pricing:** $8/mo base + revenue share on upsell revenue
- **Target:** Shopify merchants wanting higher AOV
- **Results claimed:** $1B+ in upsell revenue generated, 16.2% avg conversion rate

### 🔧 Core Features

#### Pre-Purchase Upsells
- **Product Page Widgets** - Up to 8 upsells on product pages, one-click add to cart
- **Pre-Purchase Popups** - Up to 5 upsells on cart popup with tiered discounts
- **Bundles & Subscriptions** - Dynamic bundles based on cart contents
- **In-Checkout Offers** - Native Shopify checkout upsells (Plus only)

#### Post-Purchase Upsells (💎 GOLDEN FEATURE)
- **Post-Purchase Page** - Appears AFTER checkout, BEFORE thank you page
- **Downsell Offers** - Shows cheaper alternative if upsell declined
- **Thank You Page Upsells** - No extra orders/deliveries needed
- **One-Click Buy** - No re-entering payment info (card already saved)

#### Revenue Optimization
- **Unlimited Split Testing** - A/B test different offers
- **AI-Powered Funnels** - Auto-generates upsell funnels for all products
- **Pre-Built Funnels** - Start instantly with proven templates
- **Slide Cart Drawer** - Replaces cart page with upsell-enabled drawer

### 🔑 How One-Click Upsell Works (TECHNICAL)

```
Customer Flow:
1. Customer completes checkout → payment processed
2. OCU intercepts BEFORE thank you page
3. Shows upsell offer page
4. Customer clicks "Add to Order" 
5. Backend charges same payment method (already authorized)
6. Single shipment, single order ID
7. Redirects to thank you page

Technical Requirements:
- Shopify Checkout Extensions API
- Payment intent modification (Shopify handles this)
- Order edit API to add products post-checkout
```

### 📦 Build It Approach

```javascript
// Simplified post-purchase upsell logic
async function handlePostPurchase(order) {
  // 1. Get recommended upsell product
  const upsellProduct = await getUpsellRecommendation(order.lineItems);
  
  // 2. Show offer page (intercept thank you page)
  // Uses Shopify post-purchase checkout extension
  
  // 3. If accepted, modify order
  if (customerAccepted) {
    await shopifyAdmin.order.edit({
      id: order.id,
      lineItemsToAdd: [{ variantId: upsellProduct.variantId, quantity: 1 }]
    });
    // Payment already authorized - just capture additional amount
  }
  
  // 4. If declined, optionally show downsell
  if (customerDeclined && downsellEnabled) {
    showDownsellOffer(cheaperAlternative);
  }
}
```

### 📚 GitHub References
- `kirpalsingh17/post-purchase-shopify-checkout-extension` (⭐3) - Full implementation
- `elephantsneverforget/upsell` (⭐2) - Tracking for post-purchase
- `lightamadi/One-Click-Upsell-Mini-App` - Theme extension approach
- `Sampann11Dwivedi/shopify-bundles-app` - Bundles with cart transform

### 💵 Value to Store Owner
- **20-30% AOV increase** reported by users
- **Zero risk** - shows after purchase complete, can't lose sale
- **High conversion** - 16.2% average (warm buyer, just committed)
- **ROI Example:** 1000 orders/mo × $50 AOV × 20% upsell rate × $20 upsell = **$4,000 extra/month**

---

## 2. Pricefy (Competitor Price Monitoring)

### 💰 Business Model
- **Free:** 50 SKUs, 3 competitors
- **Starter:** $29/mo - 100 SKUs
- **Professional:** $79/mo - 2,000 SKUs + dynamic repricing
- **Business:** $249/mo - 15,000 SKUs + autopilot repricing

### 🔧 Core Features

#### Price Monitoring
- **Daily competitor scraping** - Multiple times per day
- **Multi-marketplace** - Amazon, eBay, any domain
- **Multi-currency support** - Auto-converts for comparison
- **Stock level spying** - Know when competitors are out of stock

#### AI Product Matching
- **Code Automatch** - Uses EAN/GTIN to match products
- **Quick Automatch** - AI compares product titles across catalogs
- **Manual linking** - Override for edge cases

#### Dynamic Repricing
- **Rule-based repricing** - "Be 5% below competitor X"
- **Semi-automated** - Suggests prices, you approve
- **Autopilot** - Fully automated price changes
- **MAP/MSRP monitoring** - Ensure minimum advertised price compliance

#### Alerts & Reports
- **Instant notifications** - Email/Slack when competitor changes price
- **Daily/Weekly reports** - Excel, CSV, XML exports
- **Price change history** - Track trends over time

### 🔑 How Price Monitoring Works (TECHNICAL)

```
Scraping Architecture:
1. Product catalog imported (Shopify/Salla sync)
2. Competitor URLs collected (auto or manual)
3. Scheduled scraper runs:
   - Rotates proxies to avoid blocking
   - Parses price from HTML (CSS selectors)
   - Handles dynamic JS rendering when needed
4. Prices stored in database with timestamps
5. Comparison engine runs:
   - Calculates your position (higher/lower/same)
   - Triggers alerts if thresholds crossed
6. Repricing rules executed:
   - Calculates new price based on rules
   - Pushes to store via API
```

### 📦 Build It Approach

```javascript
// Price monitoring service
class CompetitorMonitor {
  async scrapeCompetitorPrice(url) {
    // Use puppeteer or cheerio depending on site
    const html = await this.fetchWithProxy(url);
    const price = this.extractPrice(html);
    return { url, price, scrapedAt: new Date() };
  }
  
  async checkAllCompetitors(product) {
    const competitorPrices = await Promise.all(
      product.competitors.map(c => this.scrapeCompetitorPrice(c.url))
    );
    
    // Determine position
    const myPrice = product.price;
    const lowestCompetitor = Math.min(...competitorPrices.map(c => c.price));
    
    return {
      position: myPrice < lowestCompetitor ? 'lowest' : 'higher',
      lowestCompetitorPrice: lowestCompetitor,
      recommendedPrice: this.calculateRecommendedPrice(product, competitorPrices)
    };
  }
  
  calculateRecommendedPrice(product, competitorPrices) {
    const rules = product.pricingRules;
    // Example: "Be 5% below lowest competitor"
    if (rules.strategy === 'beat_lowest') {
      return Math.min(...competitorPrices.map(c => c.price)) * (1 - rules.beatBy);
    }
    // More strategies...
  }
}
```

### 📚 GitHub References
- `DAILtech/PriceDive` (⭐24) - Price tracking with visualization
- `pocesar/actor-shopify-scraper` (⭐15) - Shopify store scraper
- `jaridnft/marketplace-scraper` (⭐17) - Facebook marketplace monitor
- `nicholassabelli/PriceMonitorScraper` (⭐4) - Scrapy-based monitor

### 💵 Value to Store Owner
- **Save 10-20 hours/week** manual price checking
- **Never lose sales** to underpriced competitors unknowingly
- **Margin protection** - Don't race to bottom blindly
- **Stock opportunity** - Know when competitors out of stock → raise prices

---

## 3. Omnia Retail (Enterprise AI Pricing)

### 💰 Business Model
- **Pricing:** Custom, typically $500-2,000+/mo based on:
  - Number of SKUs
  - Markets/channels
  - Automation level
  - Support tier
- **Target:** Enterprise retailers, brands with 10k+ SKUs

### 🔧 Core Features

#### Price Monitoring
- **CSE scraping** - Google Shopping, idealo, Tweakers, etc.
- **Marketplace monitoring** - Amazon, eBay, bol.com
- **Direct store scraping** - Any competitor website
- **GTIN/ASIN matching** - Automated product identification

#### Pricing Strategy Tree™ (💎 KEY DIFFERENTIATOR)
- **Visual rule builder** - Drag-and-drop pricing logic
- **Category-level rules** - Different strategies per category
- **Product-level overrides** - Fine-tune specific items
- **"Show Me Why"** - Explains every pricing decision

#### Dynamic Pricing Engine
- **Real-time price updates** - Pushes to your store automatically
- **Min/Max guardrails** - Never go below cost or above MSRP
- **Elasticity modeling** - Predict demand at different price points
- **Margin optimization** - Balances volume vs. margin

#### Omnia Agent (AI Assistant)
- **Natural language queries** - "Why did product X change price?"
- **Proactive alerts** - Surfaces competitor moves, margin risks
- **Audit trail** - Every decision logged and explainable

### 🔑 What Makes It Worth $1000+/mo

1. **Scale** - Handles millions of price points across channels
2. **Reliability** - 99.9% uptime, enterprise SLAs
3. **Integrations** - Shopware, PlentyMarkets, JTL, ERP systems
4. **Support** - Dedicated account managers, pricing consultants
5. **AI/ML** - Demand forecasting, elasticity curves, competitive positioning
6. **Compliance** - MAP monitoring, international pricing, tax handling

### 📦 Build It Approach (Simplified)

```javascript
// Pricing Strategy Tree - Simplified
class PricingEngine {
  async calculatePrice(product) {
    const rules = await this.getRulesForProduct(product);
    let price = product.baseCost;
    
    for (const rule of rules) {
      switch (rule.type) {
        case 'markup':
          price = price * (1 + rule.percentage);
          break;
        case 'beat_competitor':
          const competitorPrice = await this.getCompetitorPrice(product, rule.competitorId);
          price = competitorPrice * (1 - rule.beatBy);
          break;
        case 'match_market':
          const marketAvg = await this.getMarketAveragePrice(product);
          price = marketAvg;
          break;
        case 'demand_based':
          const elasticity = await this.getElasticity(product);
          price = this.optimizeForMargin(product, elasticity);
          break;
      }
      
      // Apply guardrails
      price = Math.max(price, product.minPrice);
      price = Math.min(price, product.maxPrice);
    }
    
    return { price, rulesApplied: rules, explanation: this.generateExplanation(rules) };
  }
}
```

### 📚 GitHub References
- `dho-rae/Ecommerce-Pricing-Strategy` - C++ dynamic pricing simulation
- `unicoDErn0/eCommerce` - Dynamic pricing algorithm concepts

### 💵 Value to Store Owner
- **2-10% margin improvement** on average
- **Automation** - No manual price management
- **Competitive edge** - React to market in minutes not days
- **ROI Example:** $1M revenue × 5% margin improvement = **$50,000/year** (pays for itself 4x)

---

## 4. Informed Repricer (Amazon/Walmart)

### 💰 Business Model
- **Pricing:** Based on active listings, typically $99-499/mo
- **Target:** Amazon/Walmart third-party sellers
- **Results claimed:** +63% Buy Box ownership in 2 weeks

### 🔧 Core Features

#### Buy Box Optimization
- **Compete Against Featured Merchant** - Only compete with Buy Box eligible sellers
- **Raise Buy Box Price** - Increase price when you win (avoid penny wars)
- **FBA/MFN differentiation** - Different strategies per fulfillment type

#### Smart Repricing Strategies
- **Beat competition** - Be X% below lowest competitor
- **Private Label Strategy** - Optimize when you're the only seller
- **Smart Price Reset** - Raise prices during off-peak hours
- **Machine learning optimization** - Find optimal price point

#### Automation
- **Auto Min/Max calculation** - Factors in fees, shipping, desired ROI
- **Instant repricing** - No delays, 24/7 price changes
- **Listing deactivation prevention** - Stay within Amazon's limits

#### Analytics
- **Buy Box tracking** - % of time you win
- **Competitor analysis** - See what others are doing
- **Profit tracking** - Real profit after all fees

### 🔑 How Amazon Repricing Works

```
Buy Box Algorithm (Simplified):
1. Amazon selects "Featured Merchant" (Buy Box winner)
2. Factors: Price, fulfillment, seller rating, shipping speed
3. Price is major factor but not only one
4. FBA sellers often win at higher prices than MFN

Repricing Strategy:
1. Monitor competitor prices via Amazon API
2. If competitor lowers price:
   - Calculate if beating them is profitable
   - If yes, lower price to beat by X%
   - If no, let them have the sale
3. If you win Buy Box:
   - Slowly raise price until you lose it
   - Find maximum profitable price that keeps Buy Box
4. During off-peak (2-5 AM):
   - Raise prices for potential late-night buyers
   - Test higher price points with low volume
```

### 📦 Build It Approach

```javascript
// Amazon repricing logic (requires SP-API access)
class AmazonRepricer {
  async reprice(listing) {
    const competitors = await this.getCompetitorOffers(listing.asin);
    const buyBoxWinner = await this.getBuyBoxWinner(listing.asin);
    
    // Am I winning the Buy Box?
    if (buyBoxWinner.sellerId === myId) {
      // Try to raise price
      return this.optimizeUpward(listing, competitors);
    } else {
      // Try to win Buy Box
      return this.competeForBuyBox(listing, buyBoxWinner, competitors);
    }
  }
  
  competeForBuyBox(listing, buyBoxWinner, competitors) {
    const targetPrice = buyBoxWinner.price * (1 - 0.01); // Beat by 1%
    
    // Check profitability
    const fees = this.calculateAmazonFees(listing, targetPrice);
    const profit = targetPrice - listing.cost - fees;
    
    if (profit >= listing.minProfit) {
      return { action: 'reprice', newPrice: targetPrice };
    } else {
      return { action: 'hold', reason: 'Not profitable to compete' };
    }
  }
  
  optimizeUpward(listing, competitors) {
    // Already winning - slowly raise price
    const nextCompetitor = this.getNextHighestCompetitor(competitors);
    const safeIncrease = Math.min(
      listing.currentPrice * 1.02, // 2% max increase
      nextCompetitor.price - 0.01 // Stay just below next competitor
    );
    return { action: 'reprice', newPrice: safeIncrease };
  }
}
```

### 📚 GitHub References
- `fixanoid/amazon-repricing-console` (⭐4) - Basic repricing console
- `angeldev20/amazon_repricer` (⭐3) - Python Amazon repricer
- `YibinLong/Amazon-Repricer` (⭐1) - Simple repricer implementation
- `nux/Amazon-Mws-Repricing` - MWS helper classes

### 💵 Value to Store Owner
- **63% more Buy Box wins** = 63% more sales potential
- **Avoid race to bottom** - Smart strategies protect margin
- **24/7 automation** - Never miss a pricing opportunity
- **ROI Example:** 1000 listings × 10% more sales × $10 avg profit = **$1,000/month extra**

---

## 🏆 RIBH Feature Priority Matrix

| Feature | Difficulty | Revenue Impact | Build vs Buy |
|---------|-----------|----------------|--------------|
| **Post-Purchase Upsells** | Medium | 💰💰💰 | BUILD (high value) |
| **Product Page Upsells** | Easy | 💰💰 | BUILD |
| **AI Recommendations** | Medium | 💰💰💰 | BUILD (use ML model) |
| **Competitor Monitoring** | Medium | 💰💰 | BUILD (scraping) |
| **Dynamic Repricing** | Hard | 💰💰💰 | BUILD (rules engine) |
| **A/B Testing** | Easy | 💰 | BUILD |
| **Buy Box Optimization** | Hard | 💰💰💰 | BUILD (Amazon SP-API) |

### 🎯 Recommended Build Order for RIBH

#### Phase 1: Quick Wins (Week 1-2)
1. **Product Page Upsells** - "Frequently bought together"
2. **Cart Upsells** - "Add X for $Y more"
3. **Thank You Page Upsells** - No payment complexity

#### Phase 2: High Impact (Week 3-4)
4. **Post-Purchase One-Click Upsell** - The money maker
5. **AI Product Recommendations** - Train on order history
6. **A/B Testing Framework** - Optimize everything

#### Phase 3: Competitive Edge (Week 5-8)
7. **Competitor Price Monitoring** - Daily scraping
8. **Dynamic Repricing Rules** - Rule-based engine
9. **Price Alerts** - WhatsApp notifications

#### Phase 4: Enterprise (Future)
10. **ML Demand Forecasting**
11. **Elasticity Pricing**
12. **Multi-Marketplace Sync**

---

## 🔧 Technical Components Needed

### For Upsells
```
- Shopify Checkout Extensions (post-purchase)
- Salla Webhooks (order.created, checkout.completed)
- Product recommendation ML model
- Frontend widgets (React/Vue components)
- Analytics tracking
```

### For Price Monitoring
```
- Web scraper service (Puppeteer/Playwright)
- Proxy rotation (avoid blocking)
- Price extraction algorithms
- Database for price history
- Alert system (WhatsApp/Email)
```

### For Dynamic Pricing
```
- Rules engine (JSON-based rules)
- Price calculation service
- Store sync (push prices to Shopify/Salla)
- Audit logging (why did price change?)
- Min/max guardrails
```

---

## 💡 Key Insights

1. **Post-purchase upsells have highest ROI** because customer already bought - you can't lose the sale
2. **One-click is crucial** - Any friction kills conversion
3. **AI recommendations beat manual** - "Customers also bought" outperforms curated lists
4. **Price monitoring is table stakes** - Competitors do it, you must too
5. **Dynamic pricing needs guardrails** - Never go below cost or above MSRP
6. **Transparency builds trust** - "Show me why" feature reduces support tickets

---

## 📎 Quick Reference Links

### Official Docs
- [Shopify Post-Purchase Extensions](https://shopify.dev/docs/api/checkout-ui-extensions)
- [Amazon SP-API Pricing](https://developer-docs.amazon.com/sp-api/docs/pricing-api-v0-reference)
- [Salla Webhooks](https://docs.salla.dev/docs/merchant/webhooks)

### Open Source Starting Points
- [kirpalsingh17/post-purchase-shopify-checkout-extension](https://github.com/kirpalsingh17/post-purchase-shopify-checkout-extension)
- [pocesar/actor-shopify-scraper](https://github.com/pocesar/actor-shopify-scraper)
- [DAILtech/PriceDive](https://github.com/DAILtech/PriceDive)

---

*Research compiled for RIBH app development. Focus on post-purchase upsells first - they're the quickest path to revenue.*
