import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'coupi_client.dart';
import 'models/coupi_payment_result.dart';
import 'models/coupi_session.dart';

/// Interactive modal bottom sheet providing native UPI intent launch,
/// clipboard UTR auto-capture, and real-time SSE payment status synchronization.
class CoupiCheckoutSheet extends StatefulWidget {
  final CoupiCheckoutSession session;
  final CoupiClient client;

  const CoupiCheckoutSheet({
    Key? key,
    required this.session,
    required this.client,
  }) : super(key: key);

  static Future<CoupiPaymentResult?> show({
    required BuildContext context,
    required CoupiCheckoutSession session,
    required CoupiClient client,
  }) {
    return showModalBottomSheet<CoupiPaymentResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => CoupiCheckoutSheet(session: session, client: client),
    );
  }

  @override
  State<CoupiCheckoutSheet> createState() => _CoupiCheckoutSheetState();
}

class _CoupiCheckoutSheetState extends State<CoupiCheckoutSheet>
    with WidgetsBindingObserver {
  final TextEditingController _utrController = TextEditingController();
  bool _isVerifying = false;
  String _statusNotice = 'Awaiting payment from your UPI app...';
  StreamSubscription<CoupiPaymentResult>? _streamSub;
  String? _lastCopiedUtr;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _startPaymentListener();
    // Launch installed UPI apps chooser immediately upon presentation
    _launchUpiApp();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkClipboardForUtr();
    }
  }

  /// Automatically inspects device clipboard when the customer switches back from GPay/PhonePe.
  Future<void> _checkClipboardForUtr() async {
    try {
      final clipboardData = await Clipboard.getData(Clipboard.kTextPlain);
      final text = clipboardData?.text?.trim() ?? '';

      // Check if clipboard contains a 12-digit Indian bank UTR reference
      if (RegExp(r'^\d{12}$').hasMatch(text) && text != _lastCopiedUtr) {
        _lastCopiedUtr = text;
        if (mounted) {
          setState(() {
            _utrController.text = text;
            _statusNotice = 'Detected UTR from clipboard! Verifying...';
          });
          _submitManualUtr();
        }
      }
    } catch (_) {}
  }

  void _startPaymentListener() {
    _streamSub = widget.client
        .listenPaymentStream(widget.session.sessionId)
        .listen((result) {
      if (mounted) {
        Navigator.of(context).pop(result);
      }
    }, onError: (_) {});
  }

  Future<void> _launchUpiApp() async {
    final uri = Uri.parse(widget.session.upiIntentUri);
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        setState(() {
          _statusNotice = 'No UPI application found. Please enter UTR manually.';
        });
      }
    } catch (e) {
      setState(() {
        _statusNotice = 'Error opening UPI intent: $e';
      });
    }
  }

  Future<void> _submitManualUtr() async {
    final utr = _utrController.text.trim();
    if (utr.length != 12) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid 12-digit UTR reference')),
      );
      return;
    }

    setState(() => _isVerifying = true);
    final ok = await widget.client.submitUtr(
      sessionId: widget.session.sessionId,
      utr: utr,
    );

    if (mounted) {
      setState(() => _isVerifying = false);
      if (ok) {
        Navigator.of(context).pop(CoupiPaymentResult(
          status: 'SUCCESS',
          orderId: widget.session.orderId,
          sessionId: widget.session.sessionId,
          amount: widget.session.payableAmount,
          amountPaise: (widget.session.payableAmount * 100).round(),
          utr: utr,
        ));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Verification pending. Checking banking network...')),
        );
      }
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _streamSub?.cancel();
    _utrController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(24, 20, 24, 24 + bottomInset),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                widget.session.payeeName,
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.green.shade50,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: Colors.green.shade200),
                ),
                child: const Text(
                  '0% UPI Direct',
                  style: TextStyle(color: Colors.green, fontSize: 11, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              '₹${widget.session.payableAmount.toStringAsFixed(2)}',
              style: const TextStyle(
                fontSize: 34,
                fontWeight: FontWeight.w900,
                color: Color(0xFF0F172A),
              ),
            ),
          ),
          if (widget.session.offsetPaise > 0)
            Center(
              child: Text(
                'Includes ₹${(widget.session.offsetPaise / 100).toStringAsFixed(2)} unique concurrency offset',
                style: TextStyle(color: Colors.grey.shade600, fontSize: 12),
              ),
            ),
          const SizedBox(height: 12),
          Text(
            _statusNotice,
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey.shade700, fontSize: 13),
          ),
          const SizedBox(height: 20),
          ElevatedButton.icon(
            onPressed: _launchUpiApp,
            icon: const Icon(Icons.flash_on, color: Colors.white),
            label: const Text(
              'Open UPI App (GPay / PhonePe / Paytm / BHIM)',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF2563EB),
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 12),
          const Text(
            'Paid already? Enter or paste 12-digit UTR from receipt:',
            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _utrController,
                  keyboardType: TextInputType.number,
                  maxLength: 12,
                  decoration: InputDecoration(
                    hintText: 'e.g. 429810238194',
                    counterText: '',
                    isDense: true,
                    contentPadding: const EdgeInsets.all(12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                onPressed: _isVerifying ? null : _submitManualUtr,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF0F172A),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                child: _isVerifying
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Text('Verify', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
