# Flutter & Mobile App Integration Guide

> **COUPI PG V2 Mobile Reference**  
> Complete implementation guide for integrating sovereign, zero-fee UPI payments into Flutter (Android & iOS) and React Native mobile applications.

---

## 1. Architectural Overview

Mobile applications interact with COUPI PG through a clean separation of concerns:
1. **Merchant Mobile Backend:** Authenticates with COUPI Payment Core API to initiate a payment session.
2. **Mobile Client (Flutter / React Native):** Receives the dynamic payment session with the allocated payable amount and generated `upi://` URI.
3. **Native UPI Intent Launcher:** Launches installed UPI apps (GPay, PhonePe, Paytm, CRED, BHIM) via Android Intent or iOS deep link.
4. **Realtime Payment Listener:** Listens for payment confirmation via Server-Sent Events (SSE) or Socket.io.
5. **UTR Receipt Fallback:** Allows the user to paste or submit their 12-digit UTR bank reference number for instant verification.

```
 [ Mobile App (Flutter) ]       [ Merchant Backend ]       [ COUPI Core API ]
           │                            │                         │
           │── 1. Tap "Pay with UPI" ──>│                         │
           │                            │── 2. Create Session ───>│
           │                            │   (Base: ₹499.00)       │
           │                            │<── 3. Return Session ───│
           │                            │   (Payable: ₹499.03,    │
           │<── 4. Deliver Intent URI ──│    upi://pay?...)       │
           │                            │                         │
           │── 5. Launch Native UPI Intent (PhonePe/GPay)         │
           │      (Customer approves ₹499.03)                     │
           │                                                      │
           │── 6. Listen to SSE Stream: /sessions/:id/stream ────>│
           │<── 7. Receive SUCCESS Event (Push from IMAP Engine) ─│
           │                                                      │
           ▼                                                      ▼
  Navigate to Success Screen                             Verified Webhook to
                                                         Merchant Backend
```

---

## 2. Flutter Implementation Step-by-Step

### Step 1: Add Dependencies
In your Flutter project's `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  http: ^1.2.0
  url_launcher: ^6.3.0
  flutter_spinkit: ^5.2.0
```

### Step 2: Configure Android App Queries (`AndroidManifest.xml`)
On Android 11+ (API Level 30+), apps must declare the intent queries they launch. Add this inside the `<manifest>` tag in `android/app/src/main/AndroidManifest.xml`:

```xml
<queries>
    <intent>
        <action android:name="android.intent.action.VIEW" />
        <data android:scheme="upi" />
    </intent>
</queries>
```

---

### Step 3: Checkout Service Implementation

Create `coupi_service.dart`:

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class CoupiSession {
  final String sessionId;
  final double payableAmount;
  final String upiIntentUri;
  final String expiresAt;

  CoupiSession({
    required this.sessionId,
    required this.payableAmount,
    required this.upiIntentUri,
    required this.expiresAt,
  });

  factory CoupiSession.fromJson(Map<String, dynamic> json) {
    return CoupiSession(
      sessionId: json['sessionId'] ?? json['id'],
      payableAmount: (json['payableAmount'] as num).toDouble(),
      upiIntentUri: json['upiIntentUri'] ?? json['upiUri'],
      expiresAt: json['expiresAt'],
    );
  }
}

class CoupiPaymentService {
  final String gatewayBaseUrl;
  final String merchantApiKey;

  CoupiPaymentService({
    required this.gatewayBaseUrl,
    required this.merchantApiKey,
  });

  Future<CoupiSession> createSession({
    required String orderId,
    required int amountPaise,
    required String customerName,
    required String customerPhone,
  }) async {
    final response = await http.post(
      Uri.parse('$gatewayBaseUrl/api/v1/checkout/sessions'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $merchantApiKey',
      },
      body: jsonEncode({
        'orderId': orderId,
        'amountPaise': amountPaise,
        'customerName': customerName,
        'customerPhone': customerPhone,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body);
      return CoupiSession.fromJson(data);
    } else {
      throw Exception('Failed to create payment session: ${response.body}');
    }
  }

  Future<bool> submitUtr({
    required String sessionId,
    required String utr,
  }) async {
    final response = await http.post(
      Uri.parse('$gatewayBaseUrl/api/v1/sessions/$sessionId/utr'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'utr': utr.trim()}),
    );

    return response.statusCode == 200;
  }
}
```

---

### Step 4: Launching UPI Intent & Realtime Listening

Create `coupi_checkout_screen.dart`:

```dart
import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:url_launcher/url_launcher.dart';
import 'coupi_service.dart';

class CoupiCheckoutScreen extends StatefulWidget {
  final CoupiSession session;
  final String gatewayBaseUrl;

  const CoupiCheckoutScreen({
    Key? key,
    required this.session,
    required this.gatewayBaseUrl,
  }) : super(key: key);

  @override
  State<CoupiCheckoutScreen> createState() => _CoupiCheckoutScreenState();
}

class _CoupiCheckoutScreenState extends State<CoupiCheckoutScreen> {
  final TextEditingController _utrController = TextEditingController();
  bool _isChecking = false;
  String _statusMessage = 'Awaiting payment confirmation...';
  StreamSubscription? _sseSubscription;

  @override
  void initState() {
    super.initState();
    _startListeningToPaymentStream();
    // Automatically launch UPI app chooser on entry
    _launchUpiIntent();
  }

  Future<void> _launchUpiIntent() async {
    final Uri upiUri = Uri.parse(widget.session.upiIntentUri);
    try {
      final launched = await launchUrl(
        upiUri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        setState(() {
          _statusMessage = 'Could not open UPI app. Please copy UPI link or enter UTR.';
        });
      }
    } catch (e) {
      debugPrint('Error launching UPI URI: $e');
    }
  }

  void _startListeningToPaymentStream() {
    final sseUrl = Uri.parse(
      '${widget.gatewayBaseUrl}/api/v1/sessions/${widget.session.sessionId}/stream',
    );

    final request = http.Request('GET', sseUrl);
    request.headers['Accept'] = 'text/event-stream';

    final client = http.Client();
    client.send(request).then((response) {
      _sseSubscription = response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen((line) {
        if (line.startsWith('data:')) {
          final rawData = line.substring(5).trim();
          try {
            final data = jsonDecode(rawData);
            if (data['status'] == 'SUCCESS') {
              _onPaymentSuccess(data['utr'] ?? '');
            }
          } catch (_) {}
        }
      });
    }).catchError((err) {
      debugPrint('SSE Stream Error: $err');
    });
  }

  void _onPaymentSuccess(String utr) {
    if (!mounted) return;
    _sseSubscription?.cancel();
    Navigator.of(context).pop({'status': 'SUCCESS', 'utr': utr});
  }

  Future<void> _submitManualUtr() async {
    final utr = _utrController.text.trim();
    if (utr.length != 12) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid 12-digit UTR number')),
      );
      return;
    }

    setState(() => _isChecking = true);
    final service = CoupiPaymentService(
      gatewayBaseUrl: widget.gatewayBaseUrl,
      merchantApiKey: '',
    );

    final success = await service.submitUtr(
      sessionId: widget.session.sessionId,
      utr: utr,
    );

    if (mounted) {
      setState(() => _isChecking = false);
      if (success) {
        _onPaymentSuccess(utr);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Verification pending. Please check again shortly.')),
        );
      }
    }
  }

  @override
  void dispose() {
    _sseSubscription?.cancel();
    _utrController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('UPI Direct Payment'),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '₹${widget.session.payableAmount.toStringAsFixed(2)}',
              style: const TextStyle(fontSize: 36, fontWeight: FontWeight.bold),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              _statusMessage,
              style: const TextStyle(color: Colors.grey, fontSize: 14),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            ElevatedButton.icon(
              onPressed: _launchUpiIntent,
              icon: const Icon(Icons.payment),
              label: const Text('Re-open UPI App (GPay / PhonePe / Paytm)'),
              style: ElevatedButton.styleFrom(padding: const EdgeInsets.all(16)),
            ),
            const SizedBox(height: 32),
            const Divider(),
            const SizedBox(height: 16),
            const Text(
              'Paid already? Enter the 12-digit UPI Ref / UTR from your receipt for instant activation:',
              style: TextStyle(fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _utrController,
              keyboardType: TextInputType.number,
              maxLength: 12,
              decoration: const InputDecoration(
                border: OutlineInputBorder(),
                labelText: '12-Digit UTR (e.g. 429810238194)',
                counterText: '',
              ),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: _isChecking ? null : _submitManualUtr,
              child: _isChecking
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Text('Verify UTR'),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 3. Best Practices for Mobile UPI

1. **Auto-Clipboard Detection:** When the customer returns to your mobile app after approving the payment in GPay or PhonePe, check the device clipboard via `Clipboard.getData('text/plain')`. If it contains a 12-digit number, auto-populate the UTR field.
2. **Handle App Backgrounding Gracefully:** On mobile, users switch between your app and the UPI app. Ensure your payment polling or SSE socket reconnects automatically when the app resumes lifecycle state (`AppLifecycleState.resumed`).
3. **Never Fulfill on Client Confirmation:** Always await your backend receiving the authoritative HMAC-SHA256 server-to-server webhook before releasing digital items or updating user balances.
