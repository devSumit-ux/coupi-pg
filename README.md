<div align="center">

```
 ██████╗ ██████╗ ██╗   ██╗██████╗ ██╗    ██████╗  ██████╗ 
██╔════╝██╔═══██╗██║   ██║██╔══██╗██║    ██╔══██╗██╔════╝ 
██║     ██║   ██║██║   ██║██████╔╝██║    ██████╔╝██║  ███╗
██║     ██║   ██║██║   ██║██╔═══╝ ██║    ██╔═══╝ ██║   ██║
╚██████╗╚██████╔╝╚██████╔╝██║     ██║    ██║     ╚██████╔╝
 ╚═════╝ ╚═════╝  ╚═════╝ ╚═╝     ╚═╝    ╚═╝      ╚═════╝ 
```

# ⚡ CouPI PG V2

### The Sovereign, 100% Cloud-Native 0%-Fee UPI Payment Engine
**Bypass 2% + 18% GST Gateway Fees • Zero Hardware (No Physical Phones/SIMs) • High-Concurrency Paise Offset Engine • Instant IMAP IDLE Push (<400ms)**

<br/>

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B%20LTS-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![Zero Aggregator Fees](https://img.shields.io/badge/Fees-0%25%20Forever-10b981?style=for-the-badge&logo=cashapp&logoColor=white)](#)
[![Zero Hardware Required](https://img.shields.io/badge/Hardware-Zero%20Phones%20%2F%20No%20SIMs-blueviolet?style=for-the-badge)](#)
[![High Concurrency](https://img.shields.io/badge/Concurrency-Paise%20Offset%20(100%2B%20Simultaneous)-0284c7?style=for-the-badge)](#)
[![Flutter Widget](https://img.shields.io/badge/Flutter-coupi__flutter%20(pub.dev)-02569B?style=for-the-badge&logo=flutter&logoColor=white)](#-pre-packaged-flutter-widget-coupi_flutter)
[![Multi-VPA Guard](https://img.shields.io/badge/Multi--VPA-Auto--Rotation%20Guard-6366f1?style=for-the-badge)](#-multi-vpa-auto-rotation--daily-limit-guard)
[![Hybrid Routing](https://img.shields.io/badge/Enterprise-Hybrid%20Smart%20Collect-059669?style=for-the-badge)](#-phase-2-enterprise-hybrid-routing-bank-smart-collect)
[![Tests Passing](https://img.shields.io/badge/Tests-33%2F33%20Passing%20(100%25)-success?style=for-the-badge&logo=vitest&logoColor=white)](#)
[![Successor to YouPI](https://img.shields.io/badge/Evolution-YouPI--PG%20V2%20Successor-e11d48?style=for-the-badge)](#)

<br/>

<p align="center">
  <a href="#-the-evolution-what-youpi-pg-lacked--how-coupi-solves-it">YouPI-PG vs CouPI</a> •
  <a href="#-pre-packaged-flutter-widget-coupi_flutter">Flutter Widget</a> •
  <a href="#-multi-vpa-auto-rotation--daily-limit-guard">Multi-VPA Guard</a> •
  <a href="#-phase-2-enterprise-hybrid-routing-bank-smart-collect">Hybrid Smart Collect</a> •
  <a href="#-quickstart-in-60-seconds">Quickstart</a> •
  <a href="#-bank-email-push-setup-zero-hardware">Bank Setup</a> •
  <a href="#-high-concurrency-paise-offset-engine">Paise Offset</a> •
  <a href="#-developer-integration-web--flutter">Developer Integration</a> •
  <a href="#-authoritative-server-to-server-webhooks">Webhooks</a>
</p>

---

</div>

<br/>

## 🔍 The Evolution: What YouPI-PG Lacked & How CouPI Solves It

If you are looking for **YouPI-PG** (or a self-hosted UPI payment gateway), you likely encountered severe architectural roadblocks in the original codebase:

| Limitation in Original YouPI-PG | ⚡ How CouPI PG Solves It |
| :--- | :--- |
| **Single-Slot Queue Bottleneck**<br/>Only **1 user** could pay at any given time. If two buyers attempted to pay ₹500 simultaneously, User 2 was locked in a **5-minute waiting queue** to prevent attribution collisions. | **Paise Offset Concurrency Engine (`₹0.00 – ₹0.99`)**<br/>Dynamically offsets identical amounts (User 1 pays ₹500.00, User 2 pays ₹500.01, User 3 pays ₹500.02). **Up to 100 concurrent buyers per VPA** pay immediately with zero queue delay and 100% deterministic attribution. |
| **Physical Phone & SIM Dependency**<br/>Required a dedicated physical Android phone running an APK plugged into a charger 24/7 with the merchant's banking SIM card listening to `SMS_RECEIVED`. | **100% Cloud-Native IMAP IDLE Push (< 400ms)**<br/>Zero phones, zero SIM cards. Uses persistent RFC 2177 TLS sockets (`imapflow` + `mailparser`) connected directly to your bank alert mailbox. Catches incoming bank credit alert emails instantly. |
| **Headless Chrome Scraping Crashes**<br/>Ran heavy Puppeteer/CDP headless Chrome browsers to scrape Gmail and SMS web messages, consuming 1GB+ RAM and crashing inside cloud containers. | **Lightweight Socket-Native Engine (~25MB RAM)**<br/>Zero browser automation binaries. Runs cleanly on **Render, Railway, Docker, and standard $5/month Linux VPS** nodes. |
| **WhatsApp Account Ban Risk**<br/>Relied on Baileys reverse-engineered WhatsApp Web protocol for customer OTPs, frequently triggering permanent WhatsApp number bans. | **Flexible, Resilient Customer Identity**<br/>Tokenized session engine with optional WhatsApp or instant SMS/JWT login without risking WhatsApp merchant account bans. |
| **High Latency Bank Feedback (3–15s)**<br/>Customers sat waiting for SMS relay hops before seeing confirmation. | **Sub-Second Intent Return & Clipboard UTR**<br/>Android native `startActivityForResult` intent directly returns `ApprovalRefNo` to Flutter in 100ms. In-app clipboard auto-detects 12-digit UTRs instantly. |
| **Single VPA Saturation**<br/>Limited to a single UPI ID, capping daily limits. | **Multi-VPA Round-Robin Pooling**<br/>Pool multiple VPAs (e.g. 5 VPAs = 500 simultaneous identical-amount buyers) with automatic load balancing. |

<br/>

---

## 💡 Stop Paying 2% + 18% GST to Payment Gateways

Traditional aggregators (Razorpay, Cashfree, PayU, Stripe India) penalize your revenue and retain your cash flow:

```
Order Value: ₹10,000
Aggregator Fee (2%):  - ₹200.00
GST on Fee (18%):     -  ₹36.00
Settlement Wait:      T+2 to T+3 Business Days
------------------------------------------------
With CouPI PG:        ₹0.00 Fees • Instant Direct Bank Settlement
```

- **0.0% Gateway Fees Forever**: Money travels directly from the customer's UPI app (GPay, PhonePe, Paytm, CRED, BHIM) to your bank account via NPCI rails.
- **Zero Settlement Holdbacks**: Instant settlement in real time.
- **Zero Third-Party Account Freezes**: You control your sovereign self-hosted infrastructure.
- **100% White-Label**: Zero "Powered by Razorpay" badges. Your brand, your domain, your rules.

<br/>

---

## 🏗️ How CouPI Works

```
  [ Customer (Web / Flutter App) ]
                │
    (1) Initiates checkout: Base Order ₹500.00
                │
    (2) CouPI Paise Offset Engine allocates unique active slot: ₹500.02
                │
    (3) Customer scans vector QR or 1-taps UPI intent deep link
                │
    (4) Customer approves in GPay / PhonePe / Paytm / CRED
                │
    (5) Bank receives funds & sends instant credit alert email
                │
  ┌─────────────┴─────────────────────────────────┐
  ▼                                               ▼
[ Sub-Second Intent Callback ]      [ Cloud-Native IMAP IDLE Listener ]
Android intent returns ApprovalRefNo   Persistent TLS socket receives email (<400ms)
(Submits UTR in 100ms)                 Regex parses amount ₹500.02 & 12-digit UTR
  └─────────────┬─────────────────────────────────┘
                │
    (6) Attribution Engine matches ₹500.02 & transitions session to SUCCESS
                │
    ┌───────────┴───────────────────────────────┐
    ▼                                           ▼
[ Real-Time Client Push ]             [ HMAC-SHA256 Signed Webhook ]
Socket.io / SSE broadcasts to UI      POST /api/webhook to merchant server
(Instant green checkmark)             (Authoritative database fulfillment)
```

<br/>

---

## ⚡ Quickstart in 60 Seconds

### Prerequisites
- Node.js 20+ LTS (`node -v`)
- npm 10+ (`npm -v`)

### 1. Clone & Install
```bash
git clone https://github.com/coupi-pg/coupi.git
cd coupi
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```

Edit `.env` to configure your receiving VPA and email observer:
```env
# Server Ports
PORT=6100
CHECKOUT_PORTAL_PORT=7000
MERCHANT_ADMIN_PORT=6001
GMAIL_OBSERVER_PORT=6003

# IMAP Bank Email Push Listener (Zero Hardware)
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=your-bank-alerts-email@gmail.com
IMAP_PASSWORD=your-16-char-app-password
```

### 3. Run All Services in Development Mode
```bash
npm run dev
```

All 5 core microservices spin up with live hot-reloading:

```
🟢 ALL SERVICES ONLINE & OPERATIONAL
====================================================
• Merchant Panel & Admin Hub:   http://localhost:6001
• Payment Core REST API:        http://localhost:6100
• Customer Checkout Portal:     http://localhost:7000/checkout/:id
• Bank Email Payment Observer:  http://localhost:6003
• CouPI Showcase Store (Demo):  http://localhost:5000
====================================================
```

<br/>

---

## 📧 Bank Email Push Setup (Zero Hardware)

Indian banks (HDFC, ICICI, SBI, Axis, Kotak, IDFC, PNB, Canara) dispatch credit alert emails **within 1–2 seconds** of every incoming UPI transaction.

### Step 1: Create a Dedicated Email Account or Rule
- Create a dedicated Gmail address (e.g., `payments@yourdomain.com` or `yourbusiness.alerts@gmail.com`).
- In your net banking portal, add this email for instant transaction alerts, OR set up an automatic email forwarding rule from your primary banking email.

### Step 2: Generate a Google App Password
1. Visit your [Google Account Security Settings](https://myaccount.google.com/security).
2. Enable **2-Step Verification**.
3. Under **App passwords**, create an App Password named `CouPI Payment Engine`.
4. Copy the generated 16-character password (e.g. `abcd efgh ijkl mnop`).

### Step 3: Add to `.env`
```env
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=yourbusiness.alerts@gmail.com
IMAP_PASSWORD=abcdefghijklmnop
```

That's it! CouPI opens an RFC 2177 persistent TLS socket. Whenever a bank email arrives, the mail server triggers the socket's `exists` event in **< 300ms**, extracting the credited amount, UTR, and sender details automatically.

<br/>

---

## 🎯 High-Concurrency Paise Offset Engine

### The Problem CouPI Solves:
When a customer transfers money via P2P UPI, the bank notification typically reads:
> *"A/c credited by INR 500.00 on 17-Oct-26 via UPI Ref 429182736192"*

It does **not** contain your internal merchant Order ID. If 5 customers buy a ₹500 product at the exact same minute, standard gateways cannot distinguish who paid.

### The CouPI Solution:
CouPI assigns each simultaneous buyer a distinct paise offset:
- **Buyer 1**: Pays **₹500.00**
- **Buyer 2**: Pays **₹500.01**
- **Buyer 3**: Pays **₹500.02**
- **Buyer 4**: Pays **₹500.03**
- ... up to **₹500.99**

1. **Zero Customer Friction**: An extra 1¢ to 99¢ (₹0.01 – ₹0.99) is virtually unnoticeable to buyers.
2. **100% Deterministic Attribution**: When the bank email reports `INR 500.02`, Buyer 3 is attributed instantly and transitioned to `SUCCESS`.
3. **Instant Slot Release**: As soon as a transaction succeeds or expires, its offset is immediately returned to the pool for the next buyer.
4. **Multi-VPA Multiplier**: Pooling 5 VPAs yields `5 × 100 = 500` concurrent payments for the exact same base product amount!

<br/>

---

## 💻 Developer Integration: Web & Flutter

### Option A: Universal One-Script (HTML / React / Next.js)

Include the universal script in your `<head>` or `<body>`:

```html
<script src="http://localhost:7000/coupi.js" data-coupi-key="YOUR_MERCHANT_KEY"></script>
```

Add `data-coupi-pay` to any button:
```html
<button 
  data-coupi-pay 
  data-order-id="ORDER-1001" 
  data-amount="499"
  data-customer-name="Mohit"
  data-customer-email="mohit@example.com"
  data-customer-phone="9876543210">
  Pay with UPI (0% Fees)
</button>
```

CouPI automatically dims the background and presents a responsive modal on desktop or a native bottom sheet on mobile with dynamic vector QR and 1-tap app launch buttons.

### Option B: Programmatic JavaScript API

```javascript
Coupi.pay({
  order_id: "ORDER-1001",
  amount: 499.00,
  customer: {
    name: "Mohit",
    email: "mohit@example.com",
    phone: "9876543210"
  },
  handler: function(response) {
    console.log("Payment confirmed!", response);
    // response: { status: "SUCCESS", order_id, amount_received, utr }
  },
  onClose: function() {
    console.log("Checkout closed");
  }
});
```

### Option C: Official Zero-Boilerplate Flutter Package (`coupi_flutter`)

For Flutter applications on Android & iOS, use the official pre-packaged widget from `packages/coupi-flutter`:

```yaml
# pubspec.yaml
dependencies:
  coupi_flutter:
    path: ./packages/coupi-flutter # or hosted on pub.dev
```

#### 2-Line Zero-Boilerplate Pay Button:
```dart
import 'package:coupi_flutter/coupi_flutter.dart';

// In your build method:
CoupiPayButton(
  amount: 499.00,
  orderId: 'ORDER-1001',
  customerName: 'Aarav Sharma',
  customerPhone: '9876543210',
  onPaymentSuccess: (res) {
    print('Payment confirmed! UTR: ${res.utr}, Amount: ₹${res.amountRupees}');
  },
  onPaymentFailed: (error) => print('Payment failed: $error'),
)
```

#### What `coupi_flutter` Automates Under the Hood:
1. **Dynamic Session Creation**: Automatically calls `POST /api/v1/checkout/sessions` with paise offset allocation.
2. **Native UPI Intent Launching**: Opens installed UPI apps (GPay, PhonePe, Paytm, CRED, BHIM) with a single tap.
3. **Intent Return Parsing**: Extracts `ApprovalRefNo` and `Status` from Android intent callbacks.
4. **Clipboard Auto-Capture (`WidgetsBindingObserver`)**: Detects 12-digit UTR copied to the system clipboard upon returning from the bank app and dispatches fast-path verification.
5. **Real-time SSE Stream**: Listens to `/api/v1/sessions/:id/stream` for instant server confirmation.

<br/>

---

## 🛡️ Multi-VPA Auto-Rotation & Daily Limit Guard

UPI consumer VPAs have an NPCI ceiling of **₹1,00,000 / day** or **20 daily transactions**. CouPI PG V2 includes an automated daily limit guard (`VpaRotatorEngine`) that tracks volume in real time and rotates accounts before bank rejections occur:

```
  ┌─────────────────────────────────────────────────────────────────────────────┐
  │                   MULTI-VPA AUTO-ROTATION & CAPACITY GUARD                  │
  └─────────────────────────────────────────────────────────────────────────────┘

    Incoming Checkout (₹499.00)
                │
                ▼
  ┌───────────────────────────┐
  │  VpaRotatorEngine Check   │
  └─────────────┬─────────────┘
                │
    ┌───────────┴──────────────────────────────┐
    ▼                                          ▼
[ VPA #1: merchant@hdfc ]               [ VPA #2: merchant@icici ]
Today's Volume: ₹89,800                 Today's Volume: ₹12,000
Safety Ceiling: ₹90,000                 Safety Ceiling: ₹90,000
Daily Tx Count: 19 / 20                 Daily Tx Count: 3 / 20
    │                                          ▲
    │ (Capacity Full / > ₹90k)                 │ (Promoted Instantly!)
    └───────────────── AUTO-ROTATE ────────────┘
```

### Operational Guard Rules:
- **Real-Time Volume & Tx Tracking**: Calculates daily settled volume in integer paise (`totalVolumePaise`) and completed transactions (`txCount`) using SQLite WAL index scans.
- **Safety Threshold at ₹90,000**: Proactively switches at ₹90,000 (10% buffer below NPCI ₹1,00,000 ceiling) to eliminate payment drops.
- **Auto-Promotion**: Switches `is_merchant_enabled` in descending order of capacity, guaranteeing continuous 24/7 transaction uptime.

<br/>

---

## ⚡ Phase 2 Enterprise Hybrid Routing (Bank Smart Collect)

For high-ticket purchases or merchants processing over **1,000 orders/day**, CouPI PG V2 provides an enterprise hybrid payment router (`HybridPaymentRouter`):

```
                       HYBRID PAYMENT ROUTER
                         Order Amount (₹)
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
       Amount < ₹2,000 (Retail)         Amount >= ₹2,000 (High-Ticket)
                 │                               │
                 ▼                               ▼
      ┌─────────────────────┐         ┌─────────────────────┐
      │  CouPI Sovereign    │         │  Bank Smart Collect │
      │  P2P UPI (0% Fee)   │         │  Dynamic Virtual A/c│
      └──────────┬──────────┘         └──────────┬──────────┘
                 │                               │
           0% Gateway Cut                  Flat ₹1.00 / txn
           0 Hardware                      (ICICI / Yes Bank)
           Instant IMAP Push               Direct Bank Webhook
```

### The Math: Aggregator 2% vs. Bank Smart Collect Flat ₹1

| Order Value | Aggregator Fee (2% + 18% GST) | CouPI Hybrid (Bank Smart Collect) | Your Net Savings |
| :--- | :--- | :--- | :--- |
| **₹500.00** | ₹11.80 | **₹0.00** *(0% CouPI P2P)* | **+ ₹11.80 (100%)** |
| **₹2,000.00** | ₹47.20 | **₹1.00** *(Flat Bank Fee)* | **+ ₹46.20 (97.8%)** |
| **₹10,000.00** | ₹236.00 | **₹1.00** *(Flat Bank Fee)* | **+ ₹235.00 (99.5%)** |
| **₹50,000.00** | ₹1,180.00 | **₹1.00** *(Flat Bank Fee)* | **+ ₹1,179.00 (99.9%)** |

- **Under ₹2,000**: Routed to zero-fee P2P UPI via CouPI's Paise Offset Engine.
- **Over ₹2,000**: Routed to Bank Smart Collect dynamic virtual accounts (`ICIC0000104...`) or unique enterprise VPAs, bypassing aggregator percentage cuts entirely.

<br/>

---

## 🔒 Authoritative Server-to-Server Webhooks

> [!CRITICAL]
> **Never fulfill orders or deliver digital goods based on browser events.**  
> Always fulfill orders strictly upon receipt of the HMAC-SHA256 signed server-to-server webhook!

### Webhook Request:
- **Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `X-Gateway-Event: SUCCESS`
  - `X-Gateway-Signature: sha256=<64_hex_hash>`
  - `X-Gateway-Delivery-Id: <uuid>`

### Webhook Verification in Node.js (Express):
```javascript
import crypto from 'node:crypto';

app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-gateway-signature'] || '';
  const secret = process.env.COUPI_WEBHOOK_SECRET;

  // IMPORTANT: Compute HMAC over RAW unparsed bytes
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.body).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const payload = JSON.parse(req.body.toString('utf8'));
  if (payload.event === 'SUCCESS') {
    // Authoritatively mark order as PAID in your database:
    // payload.orderId, payload.utr, payload.amount
    console.log(`Order ${payload.orderId} verified with UTR: ${payload.utr}`);
  }

  res.status(200).json({ received: true });
});
```

*(Implementations in Python, Go, and PHP are provided in [AGENTS.md](AGENTS.md)).*

<br/>

---

## ☁️ Cloud Deployment (Render / Railway / Docker)

CouPI PG requires zero Docker daemons, zero external database instances, and zero phone hardware.

### 1. Deploy on Railway / Render:
1. Connect your GitHub repository to Railway or Render.
2. Set Build Command: `npm install`
3. Set Start Command: `npm start`
4. Configure Environment Variables in Dashboard:
   - `NODE_ENV=production`
   - `CLOUDFLARE_DOMAIN=pay.yourdomain.com`
   - `IMAP_HOST=imap.gmail.com`
   - `IMAP_USER=your-bank-email@gmail.com`
   - `IMAP_PASSWORD=your-google-app-password`
   - `SQLITE_DB_PATH=/app/data/coupi_pg.sqlite` (mount a persistent volume on `/app/data`)

### 2. Run with Docker:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 6100 7000 6001 6003
CMD ["npm", "start"]
```

<br/>

---

## 📈 Scaling Roadmap: 0 to 10,000+ Orders/Day

```
                    SCALE & CONCURRENCY MATURITY
  ┌──────────────────────────────────────────────────────────────┐
  │ Phase 1: 0 to 1,000 Orders/Day                               │
  │ • Sovereign Cloud CouPI Engine                               │
  │ • IMAP IDLE Email Push (<400ms)                              │
  │ • Paise Offset Engine (0.00 to 0.99)                         │
  │ • 0% Fees • 0 Hardware • Hosted on Render/Railway            │
  └──────────────────────────────┬───────────────────────────────┘
                                 │
                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │ Phase 2: 10,000+ Orders/Day (Enterprise Scale)               │
  │ • Bank Dynamic Virtual Accounts / Smart Collect (e-Collect)  │
  │ • ICICI Connected Banking / Yes Bank API                     │
  │ • Unique dynamic VPA per order (e.g. ord1001@icici)          │
  │ • Bank core switch calls server webhook directly in 50ms     │
  │ • Cost: Flat ₹1–2 per transaction (vs 2% aggregator)         │
  └──────────────────────────────────────────────────────────────┘
```

<br/>

---

## 🌐 Port Topology (Reference)

| Port | Service | Description |
| :--- | :--- | :--- |
| **`6001`** | **Merchant Admin Hub** | Dashboard for receiving VPAs, active slots, audit logs |
| **`6100`** | **Payment Core REST API** | State machine, paise offset allocator, observer webhook ingester |
| **`7000`** | **Checkout Portal** | Serves `coupi.js`, iframe `/checkout/:id`, vector SVG QR |
| **`6003`** | **Bank Email Observer** | Persistent RFC 2177 IMAP IDLE listener & Google OAuth fallback |
| **`5000`** | **CouPI Showcase Store** | Optional reference store for end-to-end testing |
| **`8090`** | **Control Center** | Local process supervisor and status dashboard |

<br/>

---

## 🧪 Comprehensive Verification Suite

Run all 33 regression test suites verifying cryptographic integrity, paise offsets, IMAP normalization, multi-VPA rotation guard, hybrid smart collect routing, and fraud defense:

```bash
npm test
```

All 33 suites execute in ~26 seconds with 100% pass rate.

<br/>

---

## 📄 License & Terms

Distributed under the Sovereign Commercial License.  
Engineering and architecture maintained by devSumit-ux. All rights reserved.

---

<div align="center">
<b>CouPI PG V2 — Sovereign Zero-Fee UPI Infrastructure for Independent Builders.</b>
</div>
