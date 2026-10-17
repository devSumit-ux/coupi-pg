import 'dart:async';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'models/coupi_payment_result.dart';
import 'models/coupi_session.dart';

/// Direct HTTP & Server-Sent Events client for CouPI PG V2.
class CoupiClient {
  final String gatewayUrl;
  final String apiKey;
  final http.Client _httpClient;

  CoupiClient({
    required this.gatewayUrl,
    required this.apiKey,
    http.Client? httpClient,
  }) : _httpClient = httpClient ?? http.Client();

  String get _cleanBaseUrl => gatewayUrl.endsWith('/')
      ? gatewayUrl.substring(0, gatewayUrl.length - 1)
      : gatewayUrl;

  /// Creates a checkout session with dynamic Paise Offset and vector UPI Intent.
  Future<CoupiCheckoutSession> createSession({
    required String orderId,
    required double amount,
    CoupiCustomer? customer,
    Map<String, dynamic>? metadata,
    String? rail,
  }) async {
    final amountPaise = (amount * 100).round();
    final url = Uri.parse('$_cleanBaseUrl/api/v1/payments');

    final response = await _httpClient.post(
      url,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'Authorization': 'Bearer $apiKey',
      },
      body: jsonEncode({
        'orderId': orderId,
        'amountPaise': amountPaise,
        'currency': 'INR',
        'method': 'UPI',
        'rail': rail,
        if (customer != null) 'customer': customer.toJson(),
        if (metadata != null) 'metadata': metadata,
      }),
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final json = jsonDecode(response.body);
      return CoupiCheckoutSession.fromJson(json);
    } else {
      throw Exception('Failed to create CouPI session: [${response.statusCode}] ${response.body}');
    }
  }

  /// Submits the 12-digit UTR fast-path reference from the customer's UPI app receipt.
  Future<bool> submitUtr({
    required String sessionId,
    required String utr,
  }) async {
    final url = Uri.parse('$_cleanBaseUrl/api/v1/checkout/$sessionId/submit-utr');
    final response = await _httpClient.post(
      url,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'utr': utr.trim()}),
    );

    return response.statusCode == 200;
  }

  /// Opens an SSE connection listening to payment confirmation events.
  Stream<CoupiPaymentResult> listenPaymentStream(String sessionId) {
    final controller = StreamController<CoupiPaymentResult>();
    final url = Uri.parse('$_cleanBaseUrl/api/v1/sessions/$sessionId/stream');

    final request = http.Request('GET', url);
    request.headers['Accept'] = 'text/event-stream';

    _httpClient.send(request).then((response) {
      response.stream
          .transform(utf8.decoder)
          .transform(const LineSplitter())
          .listen(
        (line) {
          if (line.startsWith('data:')) {
            final raw = line.substring(5).trim();
            try {
              final json = jsonDecode(raw);
              if (json['status'] == 'SUCCESS' || json['event'] == 'SUCCESS') {
                controller.add(CoupiPaymentResult.fromJson(json));
                controller.close();
              }
            } catch (_) {}
          }
        },
        onError: (err) {
          if (!controller.isClosed) controller.addError(err);
        },
        onDone: () {
          if (!controller.isClosed) controller.close();
        },
        cancelOnError: true,
      );
    }).catchError((err) {
      if (!controller.isClosed) controller.addError(err);
    });

    return controller.stream;
  }

  void dispose() {
    _httpClient.close();
  }
}
