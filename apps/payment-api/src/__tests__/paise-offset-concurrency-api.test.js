import { describe, test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { Database, runMigrations } from '@coupi/db';
import { startServer } from '../index.js';
import { PaymentStatus } from '@coupi/common';

describe('Payment API Sovereign Paise Offset Concurrency (HTTP)', () => {
  let serverInstance;
  let baseUrl;
  const PORT = 6197;

  before(async () => {
    const db = new Database({ inMemory: true });
    runMigrations(db);
    serverInstance = await startServer(PORT, db);
    baseUrl = `http://127.0.0.1:${PORT}`;
  });

  after(async () => {
    if (serverInstance?.close) {
      await serverInstance.close();
    }
  });

  async function postPayment(orderId, amount) {
    const res = await fetch(`${baseUrl}/api/v1/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderId,
        amount,
        currency: 'INR',
        autoActivate: true
      })
    });
    return { status: res.status, body: await res.json() };
  }

  test('three concurrent payments on identical cart amount (₹500.00) are ALL immediately ACTIVE with unique paise offsets', async () => {
    // 3 customers checkout simultaneously for ₹500
    const [p1, p2, p3] = await Promise.all([
      postPayment('CONCURRENT-ORD-1', '500.00'),
      postPayment('CONCURRENT-ORD-2', '500.00'),
      postPayment('CONCURRENT-ORD-3', '500.00')
    ]);

    assert.equal(p1.status, 201);
    assert.equal(p2.status, 201);
    assert.equal(p3.status, 201);

    // ZERO waiting in a queue! All 3 buyers receive instant ACTIVE payment slots!
    assert.equal(p1.body.status, PaymentStatus.ACTIVE);
    assert.equal(p2.body.status, PaymentStatus.ACTIVE);
    assert.equal(p3.body.status, PaymentStatus.ACTIVE);

    assert.equal(p1.body.queuePosition, 0);
    assert.equal(p2.body.queuePosition, 0);
    assert.equal(p3.body.queuePosition, 0);

    // Amounts should have unique paise allocations (e.g., ₹500.00, ₹500.01, ₹500.02)
    const amounts = new Set([p1.body.amount, p2.body.amount, p3.body.amount]);
    assert.equal(amounts.size, 3, 'All 3 concurrent sessions must have distinct payable amounts for 100% collision-free attribution');
  });

  test('direct observation attribution via IMAP IDLE push confirms specific offset session', async () => {
    const p = await postPayment('CONCURRENT-ORD-4', '350.00');
    assert.equal(p.body.status, PaymentStatus.ACTIVE);

    // Ingest bank email observation matching p's exact paise amount via /api/v1/pollers/events
    const ingestRes = await fetch(`${baseUrl}/api/v1/pollers/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'IMAP_IDLE',
        amountPaise: Number(p.body.amountPaise),
        bankReferenceNumber: 'UTR819203847192',
        senderVpa: 'payer@upi',
        receivingAccountId: '00000000-0000-0000-0000-000000000002',
        fingerprintHash: `fp_test_imap_${Date.now()}`,
        rawText: `A/c credited with INR ${p.body.amount} via UPI Ref UTR819203847192`,
        rawPayload: { subject: 'Credit alert', body: `A/c credited with INR ${p.body.amount}` }
      })
    });

    assert.equal(ingestRes.status, 200);
    const ingestData = await ingestRes.json();
    assert.equal(ingestData.accepted, true);
    assert.equal(ingestData.attribution.attributed, true);
    assert.equal(ingestData.attribution.paymentSessionId, p.body.paymentId);

    // Verify session status is updated to SUCCESS
    const getRes = await fetch(`${baseUrl}/api/v1/payments/${p.body.paymentId}`);
    const getData = await getRes.json();
    assert.equal(getData.status, 'SUCCESS');
  });
});
