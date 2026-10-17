import { describe, test } from 'node:test';
import assert from 'node:assert';
import { HybridPaymentRouter, PaymentRails } from '../hybrid-router.js';

describe('HybridPaymentRouter Unit Tests', () => {
  const router = new HybridPaymentRouter({
    highTicketThresholdPaise: 200000, // ₹2,000.00
    flatBankFeeRupees: 1.0
  });

  test('routes retail amounts (< ₹2,000) to zero-fee P2P UPI', () => {
    const result = router.route({
      merchantId: 'merch_42',
      orderId: 'ORD-1001',
      amountPaise: 49900 // ₹499.00
    });

    assert.strictEqual(result.rail, PaymentRails.P2P_UPI);
    assert.strictEqual(result.savings.coupiCostRupees, '0.00');
    assert.ok(Number(result.savings.aggregatorCutRupees) > 0);
    assert.strictEqual(result.virtualAccount, null);
  });

  test('routes high-ticket amounts (>= ₹2,000) to Bank Smart Collect dynamic virtual accounts', () => {
    const result = router.route({
      merchantId: 'merch_42',
      orderId: 'ORD-9999',
      amountPaise: 1000000 // ₹10,000.00
    });

    assert.strictEqual(result.rail, PaymentRails.BANK_SMART_COLLECT);
    assert.ok(result.virtualAccount);
    assert.ok(result.virtualAccount.virtualVpa.includes('icicibank'));
    assert.strictEqual(result.savings.coupiCostRupees, '1.00');
    // On ₹10,000, 2% + 18% GST is ₹236.00. Net savings with CouPI is ₹235.00!
    assert.strictEqual(result.savings.aggregatorCutRupees, '236.00');
    assert.strictEqual(result.savings.netSavingsRupees, '235.00');
    assert.ok(result.upiIntentUri.includes('icicibank'));
  });

  test('routes enterprise tier merchants to Bank Smart Collect regardless of amount', () => {
    const result = router.route({
      merchantId: 'merch_enterprise',
      orderId: 'ORD-ENT-1',
      amountPaise: 50000, // ₹500
      merchantTier: 'ENTERPRISE'
    });

    assert.strictEqual(result.rail, PaymentRails.BANK_SMART_COLLECT);
    assert.strictEqual(result.reason, 'ENTERPRISE_VOLUME_TIER_DIRECT_BANK_ROUTING');
  });

  test('respects forceRail override', () => {
    const result = router.route({
      merchantId: 'merch_42',
      orderId: 'ORD-FORCE',
      amountPaise: 50000,
      forceRail: PaymentRails.BANK_SMART_COLLECT
    });

    assert.strictEqual(result.rail, PaymentRails.BANK_SMART_COLLECT);
    assert.strictEqual(result.reason, 'EXPLICIT_MERCHANT_RAIL_SELECTION');
  });
});
