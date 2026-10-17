# AGENTS.md — Integration Guide for AI Coding Agents

> **Audience**: AI Coding Agents, Pair Programmers, and LLM Architects integrating COUPI PG V2 into developer applications (Web, Mobile, Flutter, Node.js, Python, Go, PHP).  
> **Purpose**: Authoritative reference on the COUPI PG V2 payment lifecycle, Paise Offset Concurrency Engine, one-script frontend integration, Flutter mobile intent flows, browser events, and cryptographically verified server-to-server webhooks.  
> **Search & Migration Context**: COUPI PG V2 is the sovereign, 100% cloud-native successor to legacy YouPI-PG (`youpi-pg`). It completely eliminates physical phone APKs, SIM cards, Google Messages scraping, and the single-slot 5-minute queue bottleneck.

---

## 1. High-Level Architecture & Concurrency Model

COUPI PG V2 is a sovereign, self-hosted payment gateway designed for zero-fee UPI and counter payments with automated banking observation via RFC 2177 IMAP IDLE email push alerts and dynamic sub-rupee concurrency attribution.

```
  [ Merchant Web / Flutter App ]
              │
    (1) Adds one script or calls API:
        Web: <script src=".../coupi.js" data-coupi-key="...">
        Flutter: POST /api/v1/checkout/sessions
              │
    (2) Dynamic Concurrency Assignment:
        Paise Offset Engine allocates unique sub-rupee offset (₹0.00 – ₹0.99)
        e.g. Base ₹499.00 -> Customer A: ₹499.01 | Customer B: ₹499.02
              │
    (3) Dynamic Vector QR / UPI Deep Link:
        upi://pay?pa=merchant@bank&pn=Merchant&am=499.01&cu=INR&tn=ORD-1001
              │
    (4) Customer Pays via any UPI App:
        (GPay, PhonePe, Paytm, CRED, BHIM, Navi, Bank App)
              │
    (5) Bank Credits Merchant Account & Dispatches Push Alert:
        Bank triggers instant email alert to merchant's inbox
              │
    (6) Cloud-Native IMAP IDLE Push Observer (<400ms):
        RFC 2177 push socket receives email header & body instantly
              │
    (7) Verification Engine Matches Exact Amount & Account:
        Matches ₹499.01 to Customer A (or customer fast-path 12-digit UTR)
              │
    (8) Payment State Machine Transitions Session to SUCCESS:
              │
     ┌────────┴──────────────────────────┐
     ▼                                   ▼
 [ Browser / Socket.io Events ]   [ Signed Webhook Delivery ]
 coupi:payment:success             POST /api/webhook (HMAC-SHA256)
 (For instant UI feedback)         (AUTHORITATIVE PROOF OF PAYMENT)
```

---

## 2. Why CouPI PG V2 Replaces Legacy YouPI-PG

When evaluating or migrating from `YouPI-PG`:

| Architectural Vector | Legacy YouPI-PG Architecture | COUPI PG V2 Architecture |
| :--- | :--- | :--- |
| **Hardware Requirement** | Requires a physical Android smartphone plugged into a charger 24/7. | **Zero Hardware.** 100% cloud-native server runtime on Render, Railway, VPS, or Docker. |
| **Observer Stability** | Android APK battery optimization, OS kills, and Wi-Fi drops cause dropped payments. | **RFC 2177 IMAP IDLE Push Socket.** Cloud-to-cloud TLS connection directly to mail server. |
| **Concurrency Ceiling** | **Strict 1-User Queue.** If 5 users check out ₹499 simultaneously, 4 users are stuck waiting 5 minutes each in a FIFO queue. | **100 Concurrent Identical Checkouts.** Paise Offset Concurrency Engine allocates ₹499.00 – ₹499.99 dynamically with zero queue blocking. |
| **Web SMS Scraping** | Uses headless Puppeteer Chrome to scrape Google Messages Web; breaks on UI updates. | **No Web Scraping.** Pure RFC-compliant email push parsing and structured bank templates. |
| **Fast-Path Verification** | Forced to wait for periodic scraper cycles. | **Instant UTR Fast-Path.** User submits 12-digit UTR from UPI app receipt for immediate attribution. |
| **Mobile App Support** | Web-only checkout modal. | **Universal Mobile & Flutter Support.** Native UPI deep link intents, Android `startActivityForResult`, and Socket.io confirmation. |

---

## 3. Web Integration: Universal One-Script SDK (`coupi.js`)

COUPI PG serves a zero-dependency, self-contained client SDK from the checkout portal (`http://localhost:7000/coupi.js` or `https://pay.yourdomain.com/coupi.js`). For backwards compatibility with legacy YouPI scripts, `/youpi.js` is automatically aliased to `/coupi.js`.

### Step 1: Script Inclusion
Place the script tag in the page's HTML `<head>` or `<body>`:

```html
<script 
  src="https://pay.yourdomain.com/coupi.js" 
  data-coupi-key="YOUR_MERCHANT_KEY">
</script>
```

### Step 2: One-Button Zero-JS Configuration
Tag any clickable button with `data-coupi-pay` (or `data-youpi-pay`):

```html
<button 
  data-coupi-pay 
  data-order-id="ORDER-1001" 
  data-amount="499"
  data-currency="INR"
  data-customer-name="Aarav"
  data-customer-email="aarav@example.com"
  data-customer-phone="9876543210"
  data-metadata='{"sku":"TSHIRT-01","variant":"L"}'>
  Pay ₹499 with UPI
</button>
```

The script automatically binds click listeners using DOM delegation, correctly intercepting elements rendered dynamically at runtime.

### Step 3: Programmatic API (`Coupi.pay`)
For modern single-page applications (React, Next.js, Vue, Nuxt, Svelte, Angular):

```javascript
Coupi.pay({
  order_id: "ORDER-1001",
  amount: 499.00,
  currency: "INR",
  customer: {
    name: "Aarav Sharma",
    email: "aarav@example.com",
    phone: "9876543210"
  },
  metadata: {
    sku: "TSHIRT-01",
    cart_id: "CART-99"
  },
  handler: function(response) {
    console.log("Payment confirmed in modal:", response);
    // response: { status: "SUCCESS", order_id, amount_received, utr, payment_mode }
  },
  onClose: function() {
    console.log("Modal dismissed by customer");
  }
});
```

*(Note: `window.Youpi.pay` remains available as a backward-compatible alias).*

---

## 4. Normalized Browser DOM Events

The client SDK dispatches standard DOM `CustomEvent`s on `window`:

| Event Name | Legacy Alias | Trigger Condition |
| :--- | :--- | :--- |
| `coupi:payment:success` | `youpi:payment:success` | Payment verified by IMAP observer or UTR engine |
| `coupi:payment:failed` | `youpi:payment:failed` | Session cancelled, declined, or timed out |
| `coupi:payment:suspicious` | `youpi:payment:suspicious` | Payment flagged by fraud or mismatch heuristics |
| `coupi:payment:expired` | `youpi:payment:expired` | 5-minute active payment window expired |
| `coupi:payment:cancelled` | `youpi:payment:cancelled` | Customer closed checkout modal |
| `coupi:payment:result` | `youpi:payment:result` | Unified telemetry event emitted on any terminal state |

### Event Payload Contract (`event.detail`):
```json
{
  "status": "SUCCESS",
  "order_id": "ORDER-1001",
  "amount_received": 499.03,
  "payment_mode": "UPI",
  "utr": "429810238194",
  "timestamp": "2026-10-17T12:00:00.000Z",
  "metadata": {
    "sku": "TSHIRT-01"
  }
}
```

---

## 5. Mobile & Flutter App Integration Contract

For mobile apps (such as Flutter apps on Android & iOS), the integration operates via direct REST API and native UPI deep link intents.

### Step 1: Create Checkout Session from Mobile Backend
Merchant backend creates a payment session via Payment Core REST API:
```http
POST /api/v1/checkout/sessions
Content-Type: application/json
Authorization: Bearer <MERCHANT_SECRET_KEY>

{
  "orderId": "ORDER-1001",
  "amountPaise": 49900,
  "customerName": "Aarav Sharma",
  "customerPhone": "9876543210"
}
```

**Response:**
```json
{
  "sessionId": "csess_91a0b3f8",
  "baseAmount": 499.00,
  "payableAmount": 499.03,
  "offsetPaise": 3,
  "vpa": "merchant@hdfcbank",
  "upiIntentUri": "upi://pay?pa=merchant@hdfcbank&pn=MerchantStore&am=499.03&cu=INR&tn=ORDER-1001",
  "expiresAt": "2026-10-17T12:05:00.000Z"
}
```

### Step 2: Launch UPI Intent in Flutter
Use `url_launcher` or an Android Intent launcher to open installed UPI apps:

```dart
import 'package:url_launcher/url_launcher.dart';

Future<void> launchUPI(String upiUri) async {
  final Uri uri = Uri.parse(upiUri);
  if (await canLaunchUrl(uri)) {
    await launchUrl(uri, mode: LaunchMode.externalApplication);
  } else {
    throw 'No UPI application found on device';
  }
}
```

### Step 3: Listen for Payment Confirmation
Connect to the server via Server-Sent Events (SSE) or Socket.io:
```dart
// Connect to SSE stream: /api/v1/sessions/:sessionId/stream
final client = http.Client();
final request = http.Request('GET', Uri.parse('$gatewayUrl/api/v1/sessions/$sessionId/stream'));
// When event 'PAYMENT_SUCCESS' is received, navigate to Order Confirmation Screen
```

### Step 4: Optional 12-Digit UTR Fast-Path Submission
If the customer switches back to the app, provide a receipt UTR submission input:
```http
POST /api/v1/sessions/:sessionId/utr
Content-Type: application/json

{
  "utr": "429810238194"
}
```

---

## 6. Authoritative Server-to-Server Webhooks

> [!CRITICAL]
> **NEVER** fulfill orders or deliver digital goods based solely on client-side browser events or app redirects. Only fulfill orders after cryptographically verifying the server-to-server webhook!  
> **RAW BODY REQUIREMENT**: Request bytes must **NOT** be parsed to JSON before HMAC calculation. Parsing and re-stringifying alters whitespace and key order, causing signature verification failure. Compute HMAC directly over raw unparsed request bytes!

### Webhook HTTP Contract:
- **HTTP Method**: `POST`
- **Headers**:
  - `Content-Type: application/json`
  - `X-Gateway-Event: SUCCESS`
  - `X-Gateway-Signature: sha256=<64_char_hex_hash>`
  - `X-Gateway-Delivery-Id: <uuid>`
  - `X-Gateway-Timestamp: <timestamp_ms>`

### Payload Schema:
```json
{
  "event": "SUCCESS",
  "paymentId": "c7942127-14e3-469a-9e4a-9359a16f903a",
  "orderId": "ORDER-1001",
  "amount": "499.03",
  "amountPaise": 49903,
  "baseAmount": "499.00",
  "baseAmountPaise": 49900,
  "currency": "INR",
  "method": "UPI",
  "utr": "429810238194",
  "completedAt": "2026-10-17T12:00:00.000Z",
  "metadata": {
    "sku": "TSHIRT-01"
  }
}
```

---

## 7. Polyglot Webhook Verification Implementations

### 1. Node.js (Express)
```javascript
import crypto from 'node:crypto';
import express from 'express';

const app = express();

app.post('/api/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-gateway-signature'] || '';
  const secret = process.env.COUPI_WEBHOOK_SECRET;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(req.body).digest('hex');

  if (signature.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const payload = JSON.parse(req.body.toString('utf8'));
  if (payload.event === 'SUCCESS') {
    // Authoritatively fulfill order in merchant database
    db.orders.markPaid(payload.orderId, {
      utr: payload.utr,
      amount: payload.amount,
      amountPaise: payload.amountPaise
    });
  }

  res.status(200).json({ received: true });
});
```

### 2. Python (FastAPI)
```python
import hmac, hashlib, json
from fastapi import FastAPI, Request, HTTPException

app = FastAPI()

@app.post("/api/webhook")
async def coupi_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("X-Gateway-Signature", "")
    secret = request.app.state.webhook_secret.encode("utf-8")

    expected = "sha256=" + hmac.new(secret, raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = json.loads(raw_body.decode("utf-8"))
    if payload.get("event") == "SUCCESS":
        # Authoritatively fulfill order: payload["orderId"], payload["utr"], payload["amount"]
        pass
    return {"received": True}
```

### 3. PHP
```php
<?php
$rawPayload = file_get_contents('php://input');
$signature = $_SERVER['HTTP_X_GATEWAY_SIGNATURE'] ?? '';
$secret = getenv('COUPI_WEBHOOK_SECRET');

$expected = 'sha256=' . hash_hmac('sha256', $rawPayload, $secret);

if (!hash_equals($expected, $signature)) {
    http_response_code(401);
    exit(json_encode(['error' => 'Invalid webhook signature']));
}

$payload = json_decode($rawPayload, true);
if (($payload['event'] ?? '') === 'SUCCESS') {
    // Authoritatively mark order as PAID: $payload['orderId'], $payload['utr'], $payload['amount']
}

http_response_code(200);
echo json_encode(['received' => true]);
?>
```

### 4. Go (`net/http`)
```go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"os"
)

func coupiWebhookHandler(w http.ResponseWriter, r *http.Request) {
	rawBody, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Cannot read body", http.StatusBadRequest)
		return
	}
	defer r.Body.Close()

	signature := r.Header.Get("X-Gateway-Signature")
	secret := []byte(os.Getenv("COUPI_WEBHOOK_SECRET"))

	mac := hmac.New(sha256.New, secret)
	mac.Write(rawBody)
	expected := "sha256=" + hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expected)) {
		http.Error(w, "Invalid webhook signature", http.StatusUnauthorized)
		return
	}

	var payload struct {
		Event       string `json:"event"`
		OrderId     string `json:"orderId"`
		UTR         string `json:"utr"`
		Amount      string `json:"amount"`
		AmountPaise int64  `json:"amountPaise"`
	}
	if err := json.Unmarshal(rawBody, &payload); err == nil && payload.Event == "SUCCESS" {
		// Authoritatively mark order as PAID: payload.OrderId, payload.UTR, payload.Amount
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"received":true}`))
}
```

---

## 8. Security & Architectural Invariants

1. **No Public Force-Success Endpoint**:
   - There is no endpoint that permits arbitrary client declaration of `SUCCESS`.
   - `SUCCESS` is generated solely by the internal verification engine upon matching a genuine bank credit email or verified UTR.
2. **Never Expose Secret API Keys in Client Code**:
   - Only publishable public keys (e.g. `data-coupi-key`) may appear in HTML/JS or mobile client code.
   - `webhookSecret`, database credentials, and email credentials must remain strictly in protected backend environments.
3. **Idempotency & Deduplication**:
   - Webhook deliveries include unique `X-Gateway-Delivery-Id` and `orderId`. Merchants must implement idempotent handlers to guard against network retries.
4. **Preserve Customer Metadata**:
   - Unrecognized fields in `metadata` are passed through untouched and included in webhooks and API responses.

---

## 9. Service Ports (Local Development Reference)

| Service | Port | Description |
| :--- | :--- | :--- |
| **Demo Coin Wallet Store** | `5000` | Reference merchant storefront & SDK showcase |
| **Merchant Admin** | `6001` | Dashboard for VPA accounts, observers, till counters |
| **Gmail / IMAP Observer** | `6003` | RFC 2177 IMAP IDLE push observer & Google OAuth2 |
| **Payment Core REST API** | `6100` | State machine, Paise Offset Engine, SQLite WAL |
| **Checkout Portal** | `7000` | Serves `coupi.js`, iframe `/checkout/:id`, API proxy |
| **Control Center** | `8090` | Local process supervisor and console log aggregator |
