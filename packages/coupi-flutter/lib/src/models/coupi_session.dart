/// Represents an active CouPI PG checkout session with allocated Paise Offset and UPI URI.
class CoupiCheckoutSession {
  final String sessionId;
  final String orderId;
  final double baseAmount;
  final double payableAmount;
  final int offsetPaise;
  final String vpa;
  final String payeeName;
  final String upiIntentUri;
  final DateTime expiresAt;
  final String? checkoutUrl;
  final Map<String, dynamic>? hybridRouting;

  CoupiCheckoutSession({
    required this.sessionId,
    required this.orderId,
    required this.baseAmount,
    required this.payableAmount,
    required this.offsetPaise,
    required this.vpa,
    required this.payeeName,
    required this.upiIntentUri,
    required this.expiresAt,
    this.checkoutUrl,
    this.hybridRouting,
  });

  factory CoupiCheckoutSession.fromJson(Map<String, dynamic> json) {
    final base = (json['baseAmount'] is num)
        ? (json['baseAmount'] as num).toDouble()
        : double.tryParse(json['baseAmount']?.toString() ?? '0') ?? 0.0;

    final payable = (json['payableAmount'] is num)
        ? (json['payableAmount'] as num).toDouble()
        : (json['amount'] is num)
            ? (json['amount'] as num).toDouble()
            : double.tryParse(json['payableAmount']?.toString() ?? json['amount']?.toString() ?? '0') ?? base;

    return CoupiCheckoutSession(
      sessionId: json['sessionId'] ?? json['id'] ?? json['paymentId'] ?? '',
      orderId: json['orderId'] ?? json['order_id'] ?? '',
      baseAmount: base,
      payableAmount: payable,
      offsetPaise: (json['offsetPaise'] as num?)?.toInt() ?? 0,
      vpa: json['vpa'] ?? json['payeeVpa'] ?? json['receivingAccount']?['upiId'] ?? '',
      payeeName: json['payeeName'] ?? json['receivingAccount']?['payeeName'] ?? 'Merchant Store',
      upiIntentUri: json['upiIntentUri'] ?? json['upiUri'] ?? '',
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt']) ?? DateTime.now().add(const Duration(minutes: 5))
          : DateTime.now().add(const Duration(minutes: 5)),
      checkoutUrl: json['checkoutUrl'],
      hybridRouting: json['hybridRouting'] is Map<String, dynamic> ? json['hybridRouting'] : null,
    );
  }
}
