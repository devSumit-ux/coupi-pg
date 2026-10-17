# COUPI PG V2 — Developer Integration Guide

> **Official Developer Integration Reference**  
> Complete implementation guide for integrating sovereign, zero-fee UPI checkouts into Web, React, Next.js, and Mobile applications.

---

## 1. Quick Start (5-Minute Universal Web Integration)

### Step 1: Add the Script
Include the official script in your HTML:

```html
<script 
  src="https://pay.yourdomain.com/coupi.js" 
  data-coupi-key="YOUR_MERCHANT_KEY">
</script>
```

*(For local development, use `http://localhost:7000/coupi.js`)*

### Step 2: Add Your Payment Button
Add the `data-coupi-pay` attribute to any button:

```html
<button 
  data-coupi-pay 
  data-order-id="ORDER-1001" 
  data-amount="499">
  Pay ₹499
</button>
```

When clicked, the script displays the checkout modal (or mobile sheet on mobile devices) with a dynamic single-use Vector SVG QR code and native UPI intent.

---

## 2. Button Attributes Reference

| Attribute | Required | Description | Example |
| :--- | :---: | :--- | :--- |
| `data-coupi-pay` | **Yes** | Flags element as a checkout trigger | *(boolean)* |
| `data-amount` | **Yes** | Amount in INR | `"499.00"` |
| `data-order-id` | Optional | Merchant order ID (auto-generated if omitted) | `"ORD-9988"` |
| `data-currency` | Optional | Currency (defaults to `INR`) | `"INR"` |
| `data-name` | Optional | Brand / Store display name | `"Acme Store"` |
| `data-description` | Optional | Order description in checkout | `"Digital Coins"` |
| `data-customer-name` | Optional | Customer full name | `"Aarav Sharma"` |
| `data-customer-email` | Optional | Customer email | `"aarav@example.com"` |
| `data-customer-phone` | Optional | Customer mobile number | `"9876543210"` |
| `data-metadata` | Optional | JSON string of custom developer metadata | `'{"plan":"pro"}'` |
| `data-success-url` | Optional | Redirect URL on payment success | `"/order-success"` |
| `data-failed-url` | Optional | Redirect URL on payment failure | `"/order-failed"` |
| `data-suspicious-url`| Optional | Redirect URL if flagged as suspicious | `"/order-suspicious"` |
| `data-expired-url` | Optional | Redirect URL on session expiry | `"/order-expired"` |
| `data-cancelled-url`| Optional | Redirect URL on user cancellation | `"/order-cancelled"` |

*(Note: Legacy `data-youpi-pay` and `data-youpi-key` attributes are fully supported as backwards-compatible aliases).*

---

## 3. Programmatic Usage (`Coupi.pay`)

For Single Page Applications (React, Vue, Angular, Svelte, Next.js):

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
    sku: "SUBSCRIPTION-YEARLY",
    user_id: "usr_42"
  },
  handler: function(response) {
    console.log("Payment Confirmed:", response);
    // { status: "SUCCESS", order_id: "ORDER-1001", amount_received: 499.03, utr: "429810238194", payment_mode: "UPI" }
  },
  onFailed: function(response) {
    console.warn("Payment Failed:", response.reason);
  },
  onClose: function() {
    console.log("Customer closed the checkout modal");
  }
});
```

---

## 4. Concurrency: The Paise Offset Model

COUPI PG V2 incorporates a **Paise Offset Concurrency Engine**. When multiple customers checkout for the same base amount simultaneously, the gateway assigns a fractional sub-rupee offset (e.g., ₹499.01, ₹499.02).

- **Customer Display:** The modal clearly presents the exact payable amount (e.g. ₹499.03) and encodes this directly into the UPI intent and vector QR code.
- **Fast-Path Verification:** Customers can also paste the 12-digit UTR from their bank receipt into the modal for instant attribution.
- **Zero Queue Delays:** Up to 100 simultaneous checkouts per price point without blocking.

---

## 5. Frontend Browser Payment Events

The script emits standard DOM `CustomEvent`s on `window`:

```javascript
// 1. Success Event
window.addEventListener('coupi:payment:success', (e) => {
  const { order_id, amount_received, utr, payment_mode } = e.detail;
  console.log(`Order ${order_id} verified! Bank UTR: ${utr}`);
});

// 2. Failed Event
window.addEventListener('coupi:payment:failed', (e) => {
  console.log(`Order ${e.detail.order_id} failed: ${e.detail.reason}`);
});

// 3. Suspicious / Security Review Event
window.addEventListener('coupi:payment:suspicious', (e) => {
  console.warn(`Order ${e.detail.order_id} held for security review.`);
});

// 4. Session Expired Event
window.addEventListener('coupi:payment:expired', (e) => {
  console.log(`Order ${e.detail.order_id} active window expired.`);
});

// 5. Cancelled Event
window.addEventListener('coupi:payment:cancelled', (e) => {
  console.log(`Order ${e.detail.order_id} cancelled by customer.`);
});
```

*(Note: `youpi:payment:*` event listeners are also triggered for backward compatibility).*

> [!WARNING]
> Browser events are strictly for user interface updates. **Never** mark orders fulfilled or ship products based solely on client-side events. Only fulfill orders after cryptographically verifying the server-to-server webhook!

---

## 6. Authoritative Backend Webhooks

The authoritative proof of payment is the **HMAC-SHA256 signed server-to-server webhook**.

### Webhook Delivery Format:
- **Headers**:
  - `Content-Type: application/json`
  - `X-Gateway-Event: SUCCESS`
  - `X-Gateway-Signature: sha256=<hex_hmac_sha256>`
  - `X-Gateway-Delivery-Id: <uuid>`
  - `X-Gateway-Timestamp: <timestamp_ms>`
- **Payload**:
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
    "metadata": { "sku": "SUBSCRIPTION-YEARLY" }
  }
  ```

### Verification Security Invariants:
- **Raw Body Required**: Consumers **MUST** compute the HMAC over raw, unparsed request bytes. Never parse JSON before HMAC calculation.
- **Constant-Time Comparison**: Protect against timing side-channel attacks by always using constant-time comparison functions:
  - Node.js: `crypto.timingSafeEqual`
  - Python: `hmac.compare_digest`
  - PHP: `hash_equals`
  - Go: `hmac.Equal`

---

## 7. Mobile App Integration (Flutter / React Native)

For native mobile applications, see the comprehensive [Flutter & Mobile App Integration Guide](file:///home/sumitxdev/Desktop/coupi/docs/FLUTTER_MOBILE_INTEGRATION.md).
