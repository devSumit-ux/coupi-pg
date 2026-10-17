import 'package:flutter/material.dart';
import 'package:coupi_flutter/coupi_flutter.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CouPI Flutter Demo',
      theme: ThemeData(primarySwatch: Colors.blue),
      home: const CheckoutDemoPage(),
    );
  }
}

class CheckoutDemoPage extends StatelessWidget {
  const CheckoutDemoPage({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('CouPI PG Demo')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                'Premium Subscription',
                style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              const Text(
                '₹499.00 / year (0% Aggregator Fees)',
                style: TextStyle(fontSize: 16, color: Colors.grey),
              ),
              const SizedBox(height: 32),
              // 2-Line Zero-Boilerplate CouPI Pay Button:
              CoupiPayButton(
                amount: 499.0,
                orderId: 'ORDER-1001',
                gatewayUrl: 'http://localhost:6100',
                apiKey: '00000000-0000-0000-0000-000000000001',
                customer: CoupiCustomer(
                  name: 'Aarav Sharma',
                  phone: '9876543210',
                  email: 'aarav@example.com',
                ),
                onPaymentSuccess: (result) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      backgroundColor: Colors.green,
                      content: Text('Payment Verified! Bank UTR: ${result.utr}'),
                    ),
                  );
                },
                onPaymentFailed: (error) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      backgroundColor: Colors.red,
                      content: Text('Payment Failed: $error'),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
