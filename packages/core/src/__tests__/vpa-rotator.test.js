import { describe, test } from 'node:test';
import assert from 'node:assert';
import { Database, runMigrations } from '@coupi/db';
import { VpaRotatorEngine } from '../vpa-rotator.js';

describe('VpaRotatorEngine Unit Tests', () => {
  function createTestDb() {
    const db = new Database({ inMemory: true });
    const { defaultMerchant } = runMigrations(db);

    db.execute('DELETE FROM payment_receiving_accounts WHERE merchant_id = ?', [defaultMerchant.id]);

    // Insert a test customer
    db.execute(`
      INSERT INTO customers (id, name, email, mobile_number)
      VALUES ('c_1', 'Test Customer', 'c1@test.com', '9876543210')
    `);

    // Insert two receiving accounts for defaultMerchant (acc_1 active, acc_2 inactive)
    db.execute(`
      INSERT INTO payment_receiving_accounts (id, merchant_id, upi_id, payee_name, is_merchant_enabled, is_active)
      VALUES 
        ('acc_1', ?, 'merchant_1@bank', 'Merchant Primary', 1, 1),
        ('acc_2', ?, 'merchant_2@bank', 'Merchant Secondary', 1, 0)
    `, [defaultMerchant.id, defaultMerchant.id]);

    return { db, merchantId: defaultMerchant.id };
  }

  test('selects active account when capacity is available', () => {
    const { db, merchantId } = createTestDb();
    const rotator = new VpaRotatorEngine(db);

    const result = rotator.getOptimalReceivingAccount(merchantId, 50000); // ₹500
    assert.strictEqual(result.account.id, 'acc_1');
    assert.strictEqual(result.rotated, false);
    assert.strictEqual(result.metrics.txCount, 0);
  });

  test('auto-rotates to VPA #2 when VPA #1 reaches transaction count ceiling', () => {
    const { db, merchantId } = createTestDb();
    const rotator = new VpaRotatorEngine(db, { defaultDailyTxLimit: 2 });

    // Seed 2 successful transactions for acc_1 today
    const today = new Date().toISOString();
    db.execute(`
      INSERT INTO payment_sessions (id, merchant_id, order_id, customer_id, receiving_account_id, amount_paise, status, completed_at)
      VALUES 
        ('s_1', ?, 'ORD-1', 'c_1', 'acc_1', 10000, 'SUCCESS', ?),
        ('s_2', ?, 'ORD-2', 'c_1', 'acc_1', 10000, 'SUCCESS', ?)
    `, [merchantId, today, merchantId, today]);

    const result = rotator.getOptimalReceivingAccount(merchantId, 10000);
    assert.strictEqual(result.rotated, true);
    assert.strictEqual(result.account.id, 'acc_2');
    assert.strictEqual(result.previousAccountId, 'acc_1');
    assert.strictEqual(result.reason, 'DAILY_LIMIT_GUARD_ROTATION');

    // Verify DB state updated atomically
    const acc1 = db.queryOne('SELECT is_active FROM payment_receiving_accounts WHERE id = ?', ['acc_1']);
    const acc2 = db.queryOne('SELECT is_active FROM payment_receiving_accounts WHERE id = ?', ['acc_2']);
    assert.strictEqual(acc1.is_active, 0);
    assert.strictEqual(acc2.is_active, 1);
  });

  test('auto-rotates when incoming transaction exceeds daily volume ceiling', () => {
    const { db, merchantId } = createTestDb();
    // Daily limit of ₹1,000 (100,000 paise)
    const rotator = new VpaRotatorEngine(db, { defaultDailyLimitPaise: 100000 });

    const today = new Date().toISOString();
    db.execute(`
      INSERT INTO payment_sessions (id, merchant_id, order_id, customer_id, receiving_account_id, amount_paise, status, completed_at)
      VALUES ('s_1', ?, 'ORD-1', 'c_1', 'acc_1', 80000, 'SUCCESS', ?)
    `, [merchantId, today]);

    // Requesting ₹300 (30,000 paise) would push acc_1 to 110,000 (over 100,000 limit)
    const result = rotator.getOptimalReceivingAccount(merchantId, 30000);
    assert.strictEqual(result.rotated, true);
    assert.strictEqual(result.account.id, 'acc_2');
  });
});
