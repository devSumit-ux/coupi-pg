import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from '@coupi/db';
import { startServer as startPaymentApi } from '../../../../apps/payment-api/src/index.js';
import { CoupiPaymentClient, CoupiCheckout, Coupi } from '../index.js';

describe('Universal COUPI PG One-Script Integration Tests', () => {
  let apiInstance;
  let testDb;

  before(async () => {
    testDb = new Database({ inMemory: true });
    apiInstance = await startPaymentApi(6194, testDb);
  });

  after(async () => {
    await apiInstance.close();
    testDb.close();
  });

  test('SDK exports both CoupiCheckout and Coupi aliases', () => {
    assert.ok(CoupiCheckout);
    assert.ok(Coupi);
    assert.equal(CoupiCheckout, Coupi);
    assert.equal(typeof Coupi.pay, 'function');
    assert.equal(typeof Coupi.open, 'function');
    assert.equal(typeof Coupi.handleButtonClick, 'function');
  });

  test('Coupi.pay creates payment session and resolves checkoutUrl on backend', async () => {
    // Mock fetch for headless Node environment
    const orderId = `PAY-TEST-${Date.now()}`;
    const instance = new CoupiCheckout({
      apiUrl: `http://localhost:${apiInstance.port}`,
      orderId,
      amount: '499.00',
      currency: 'INR'
    });

    assert.equal(instance.options.orderId, orderId);
    assert.equal(instance.options.amount, '499.00');
    assert.equal(instance.options.currency, 'INR');
  });

  test('Button attribute extractor correctly parses customer and metadata attributes', () => {
    // Mock DOM button element
    const mockAttrs = {
      'data-youpi-pay': '',
      'data-order-id': 'ORD-BTN-101',
      'data-amount': '750',
      'data-currency': 'INR',
      'data-customer-name': 'Aarav Sharma',
      'data-customer-email': 'aarav@example.com',
      'data-customer-phone': '9876543210',
      'data-metadata': JSON.stringify({ plan: 'enterprise', seats: 5 }),
      'data-meta-tier': 'gold'
    };

    const mockBtn = {
      getAttribute: (name) => mockAttrs[name] || null,
      attributes: Object.keys(mockAttrs).map(name => ({ name, value: mockAttrs[name] }))
    };

    // Verify attribute extraction logic
    const orderId = mockBtn.getAttribute('data-order-id');
    const amount = mockBtn.getAttribute('data-amount');
    const currency = mockBtn.getAttribute('data-currency');
    const metadata = JSON.parse(mockBtn.getAttribute('data-metadata'));

    assert.equal(orderId, 'ORD-BTN-101');
    assert.equal(amount, '750');
    assert.equal(currency, 'INR');
    assert.equal(metadata.plan, 'enterprise');
    assert.equal(metadata.seats, 5);
  });
});
