import 'package:flutter/material.dart';
import 'coupi_checkout_sheet.dart';
import 'coupi_client.dart';
import 'models/coupi_payment_result.dart';

/// Zero-boilerplate pre-packaged Flutter checkout button for CouPI PG V2.
///
/// Example:
/// ```dart
/// CoupiPayButton(
///   amount: 499.0,
///   orderId: "ORDER-1001",
///   gatewayUrl: "https://pay.yourdomain.com",
///   apiKey: "YOUR_MERCHANT_KEY",
///   customer: CoupiCustomer(name: "Aarav Sharma", phone: "9876543210"),
///   onPaymentSuccess: (result) {
///     print("Payment confirmed! UTR: ${result.utr}");
///   },
///   onPaymentFailed: (error) {
///     print("Payment failed: $error");
///   },
/// )
/// ```
class CoupiPayButton extends StatefulWidget {
  final double amount;
  final String orderId;
  final String gatewayUrl;
  final String apiKey;
  final CoupiCustomer? customer;
  final Map<String, dynamic>? metadata;
  final String? rail;
  final Function(CoupiPaymentResult result)? onPaymentSuccess;
  final Function(String error)? onPaymentFailed;
  final VoidCallback? onPaymentCancelled;
  final Widget? child;
  final ButtonStyle? style;

  const CoupiPayButton({
    Key? key,
    required this.amount,
    required this.orderId,
    required this.gatewayUrl,
    required this.apiKey,
    this.customer,
    this.metadata,
    this.rail,
    this.onPaymentSuccess,
    this.onPaymentFailed,
    this.onPaymentCancelled,
    this.child,
    this.style,
  }) : super(key: key);

  @override
  State<CoupiPayButton> createState() => _CoupiPayButtonState();
}

class _CoupiPayButtonState extends State<CoupiPayButton> {
  bool _isLoading = false;

  Future<void> _handlePaymentPress() async {
    if (_isLoading) return;

    setState(() => _isLoading = true);
    final client = CoupiClient(
      gatewayUrl: widget.gatewayUrl,
      apiKey: widget.apiKey,
    );

    try {
      final session = await client.createSession(
        orderId: widget.orderId,
        amount: widget.amount,
        customer: widget.customer,
        metadata: widget.metadata,
        rail: widget.rail,
      );

      if (!mounted) return;
      setState(() => _isLoading = false);

      final result = await CoupiCheckoutSheet.show(
        context: context,
        session: session,
        client: client,
      );

      if (result != null && result.status == 'SUCCESS') {
        widget.onPaymentSuccess?.call(result);
      } else {
        widget.onPaymentCancelled?.call();
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        widget.onPaymentFailed?.call(e.toString());
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.child != null) {
      return InkWell(
        onTap: _isLoading ? null : _handlePaymentPress,
        child: _isLoading
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : widget.child!,
      );
    }

    return ElevatedButton.icon(
      onPressed: _isLoading ? null : _handlePaymentPress,
      style: widget.style ??
          ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF2563EB),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            elevation: 2,
          ),
      icon: _isLoading
          ? const SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          : const Icon(Icons.flash_on, color: Colors.white),
      label: Text(
        _isLoading ? 'Initiating UPI...' : 'Pay ₹${widget.amount.toStringAsFixed(2)} with UPI',
        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
      ),
    );
  }
}
