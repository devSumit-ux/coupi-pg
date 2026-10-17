import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  Database,
  runMigrations,
  PaymentSessionRepository,
  ReceivingAccountRepository,
  ObservationRepository
} from '@coupi/db';
import { PaiseOffsetEngine } from '../offset-engine.js';
import { AttributionEngine } from '../attribution-engine.js';
import { PaymentStatus, toPaise } from '@coupi/common';

describe('PaiseOffsetEngine & High-Concurrency Verification', () => {
  let db;
  let sessionRepo;
  let accountRepo;
  let obsRepo;
  let offsetEngine;
  let attributionEngine;
  const merchantId = '00000000-0000-0000-0000-000000000001';
  const receivingAccountId = '00000000-0000-0000-0000-000000000002';

  beforeEach(() => {
    db = new Database({ inMemory: true });
    runMigrations(db);
    sessionRepo = new PaymentSessionRepository(db);
    accountRepo = new ReceivingAccountRepository(db);
    obsRepo = new ObservationRepository(db);

    offsetEngine = new PaiseOffsetEngine({
      sessionRepo,
      accountRepo
    });

    attributionEngine = new AttributionEngine({
      sessionRepo,
      obsRepo
    });
  });

  test('enables concurrent active sessions on identical base amounts with unique paise offsets', () => {
    const basePaise = toPaise('500'); // 50000 paise = ₹500.00

    // Session 1: Buyer A buying ₹500 item
    const s1 = sessionRepo.create({
      merchantId,
      receivingAccountId,
      orderId: 'ORD-101',
      amountPaise: basePaise
    });

    // Session 2: Buyer B buying ₹500 item at the exact same time
    const s2 = sessionRepo.create({
      merchantId,
      receivingAccountId,
      orderId: 'ORD-102',
      amountPaise: basePaise
    });

    // Session 3: Buyer C buying ₹500 item at the exact same time
    const s3 = sessionRepo.create({
      merchantId,
      receivingAccountId,
      orderId: 'ORD-103',
      amountPaise: basePaise
    });

    // Allocate slots for all three simultaneously
    const res1 = offsetEngine.allocateOffsetOrEnqueue(s1.id, receivingAccountId);
    const res2 = offsetEngine.allocateOffsetOrEnqueue(s2.id, receivingAccountId);
    const res3 = offsetEngine.allocateOffsetOrEnqueue(s3.id, receivingAccountId);

    // ZERO users queued! ALL three are ACTIVE!
    assert.equal(res1.status, PaymentStatus.ACTIVE);
    assert.equal(res1.queuePosition, 0);
    assert.equal(res1.offsetPaise, 0);
    assert.equal(res1.payableAmountPaise, 50000n); // ₹500.00

    assert.equal(res2.status, PaymentStatus.ACTIVE);
    assert.equal(res2.queuePosition, 0);
    assert.equal(res2.offsetPaise, 1);
    assert.equal(res2.payableAmountPaise, 50001n); // ₹500.01

    assert.equal(res3.status, PaymentStatus.ACTIVE);
    assert.equal(res3.queuePosition, 0);
    assert.equal(res3.offsetPaise, 2);
    assert.equal(res3.payableAmountPaise, 50002n); // ₹500.02

    // Verify database state matches
    const reloadS1 = sessionRepo.findById(s1.id);
    const reloadS2 = sessionRepo.findById(s2.id);
    const reloadS3 = sessionRepo.findById(s3.id);

    assert.equal(reloadS1.status, PaymentStatus.ACTIVE);
    assert.equal(reloadS2.status, PaymentStatus.ACTIVE);
    assert.equal(reloadS3.status, PaymentStatus.ACTIVE);

    assert.equal(reloadS1.amountPaise, 50000n);
    assert.equal(reloadS2.amountPaise, 50001n);
    assert.equal(reloadS3.amountPaise, 50002n);
  });

  test('deterministic attribution matches exact paise offset when bank credit arrives', () => {
    const basePaise = toPaise('250'); // 25000 paise = ₹250.00

    const s1 = sessionRepo.create({
      merchantId,
      receivingAccountId,
      orderId: 'ORD-A',
      amountPaise: basePaise
    });
    const s2 = sessionRepo.create({
      merchantId,
      receivingAccountId,
      orderId: 'ORD-B',
      amountPaise: basePaise
    });

    offsetEngine.allocateOffsetOrEnqueue(s1.id, receivingAccountId);
    offsetEngine.allocateOffsetOrEnqueue(s2.id, receivingAccountId);

    // Bank alert arrives for Buyer B: ₹250.01 (25001 paise) via IMAP IDLE
    const obsResult = attributionEngine.processObservation({
      receivingAccountId,
      source: 'IMAP_IDLE',
      amountPaise: 25001n,
      observedAt: new Date(),
      bankReferenceNumber: 'UTR492817264819',
      senderVpa: 'buyer.b@okaxis',
      fingerprintHash: 'fp_offset_test_1',
      rawPayload: {}
    });

    // Must attribute specifically to ORD-B (s2)
    assert.equal(obsResult.attributed, true);
    assert.equal(obsResult.paymentSessionId, s2.id);

    const s2Updated = sessionRepo.findById(s2.id);
    assert.equal(s2Updated.status, PaymentStatus.SUCCESS);

    // s1 must remain ACTIVE and untouched
    const s1Updated = sessionRepo.findById(s1.id);
    assert.equal(s1Updated.status, PaymentStatus.ACTIVE);
  });

  test('different base amounts do not compete for the same offset', () => {
    const s1 = sessionRepo.create({
      merchantId,
      receivingAccountId,
      orderId: 'ORD-100',
      amountPaise: toPaise('100')
    });
    const s2 = sessionRepo.create({
      merchantId,
      receivingAccountId,
      orderId: 'ORD-200',
      amountPaise: toPaise('200')
    });

    const res1 = offsetEngine.allocateOffsetOrEnqueue(s1.id, receivingAccountId);
    const res2 = offsetEngine.allocateOffsetOrEnqueue(s2.id, receivingAccountId);

    // Both get offset 0 because base amounts differ
    assert.equal(res1.offsetPaise, 0);
    assert.equal(res1.payableAmountPaise, 10000n);

    assert.equal(res2.offsetPaise, 0);
    assert.equal(res2.payableAmountPaise, 20000n);
  });
});
