# coupi_flutter

Official Flutter SDK for **CouPI PG V2** — Sovereign, zero-fee UPI payment gateway for mobile apps.

Bypass the standard 2% + 18% GST aggregator fees of Razorpay, Cashfree, and PayU. Settle customer payments directly into your bank account over NPCI rails.

---

## Features

- **⚡ Zero-Boilerplate Widget**: Drop `<CoupiPayButton />` anywhere with a single line of code.
- **📱 Native UPI Intent Launcher**: 1-tap launch into Google Pay, PhonePe, Paytm, CRED, BHIM, and bank apps.
- **📋 Automatic Clipboard Detection**: Automatically detects 12-digit UTR from the clipboard when the user returns from their UPI app.
- **🔄 Real-Time SSE Stream**: Instant payment confirmation pushed from cloud bank email push observer in `< 400ms`.
- **🛡️ Concurrency Ready**: Fully supports CouPI's Paise Offset Engine (₹0.00 – ₹0.99) for simultaneous buyers.

---

## Installation

Add `coupi_flutter` to your `pubspec.yaml`:

```yaml
dependencies:
  coupi_flutter: ^1.0.0
```

### Android 11+ App Queries Configuration
Add the `<queries>` element inside `<manifest>` in `android/app/src/main/AndroidManifest.xml`:

```xml
<queries>
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <data android:scheme="upi" />
    </intent>
</queries>
```

---

## Usage

```dart
import 'package:flutter/material.dart';
import 'package:coupi_flutter/coupi_flutter.dart';

class CheckoutPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return CoupiPayButton(
      amount: 499.0,
      orderId: "ORDER-1001",
      gatewayUrl: "https://pay.yourdomain.com",
      apiKey: "YOUR_MERCHANT_KEY",
      customer: CoupiCustomer(
        name: "Aarav Sharma",
        phone: "9876543210",
        email: "aarav@example.com",
      ),
      onPaymentSuccess: (CoupiPaymentResult result) {
        print("Payment Confirmed! Bank UTR: ${result.utr}");
      },
      onPaymentFailed: (String error) {
        print("Payment Failed: $error");
      },
      onPaymentCancelled: () {
        print("Customer dismissed checkout");
      },
    );
  }
}
```

---

## Authoritative Webhook Security

> **Important**: Never fulfill orders or grant digital entitlements solely based on mobile client callbacks. Fulfill orders authoritatively in your backend database only after cryptographically verifying the HMAC-SHA256 server-to-server webhook emitted by CouPI PG!
