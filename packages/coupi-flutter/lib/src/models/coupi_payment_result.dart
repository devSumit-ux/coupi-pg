/// Represents the verified result of a completed CouPI PG payment session.
class CoupiPaymentResult {
  final String status;
  final String orderId;
  final String sessionId;
  final double amount;
  final int amountPaise;
  final String? utr;
  final String paymentMode;
  final DateTime timestamp;
  final Map<String, dynamic>? metadata;

  CoupiPaymentResult({
    required this.status,
    required this.orderId,
    required this.sessionId,
    required this.amount,
    required this.amountPaise,
    this.utr,
    this.paymentMode = 'UPI',
    DateTime? timestamp,
    this.metadata,
  }) : timestamp = timestamp ?? DateTime.now();

  factory CoupiPaymentResult.fromJson(Map<String, dynamic> json) {
    return CoupiPaymentResult(
      status: json['status'] ?? 'SUCCESS',
      orderId: json['orderId'] ?? json['order_id'] ?? '',
      sessionId: json['sessionId'] ?? json['session_id'] ?? json['paymentId'] ?? '',
      amount: (json['amount'] is num)
          ? (json['amount'] as num).toDouble()
          : double.tryParse(json['amount']?.toString() ?? '0') ?? 0.0,
      amountPaise: (json['amountPaise'] is num)
          ? (json['amountPaise'] as num).toInt()
          : int.tryParse(json['amountPaise']?.toString() ?? '0') ?? 0,
      utr: json['utr'] ?? json['bankRefNumber'] ?? json['approvalRefNo'],
      paymentMode: json['paymentMode'] ?? json['payment_mode'] ?? 'UPI',
      timestamp: json['timestamp'] != null
          ? DateTime.tryParse(json['timestamp']) ?? DateTime.now()
          : DateTime.now(),
      metadata: json['metadata'] is Map<String, dynamic> ? json['metadata'] : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'status': status,
    'orderId': orderId,
    'sessionId': sessionId,
    'amount': amount,
    'amountPaise': amountPaise,
    'utr': utr,
    'paymentMode': paymentMode,
    'timestamp': timestamp.toIso8601String(),
    'metadata': metadata,
  };
}

/// Customer profile representation for WhatsApp / mobile authentication
class CoupiCustomer {
  final String name;
  final String phone;
  final String? email;

  CoupiCustomer({
    required this.name,
    required this.phone,
    this.email,
  });

  Map<String, dynamic> toJson() => {
    'name': name,
    'phone': phone,
    'email': email,
  };
}
