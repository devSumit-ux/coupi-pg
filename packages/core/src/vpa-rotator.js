/**
 * @file packages/core/src/vpa-rotator.js
 * Multi-VPA Auto-Rotation & Daily Limit Guard Engine
 *
 * Enforces NPCI retail UPI transaction boundaries:
 * - Ceiling 1: ₹1,00,000.00 / day default (or custom configured threshold, e.g. ₹90,000.00 safety guard)
 * - Ceiling 2: Maximum 20 successful P2P transactions / day per individual VPA
 *
 * When an active VPA approaches or reaches its ceiling, this engine automatically
 * and atomically rotates incoming checkouts to the next available enabled receiving VPA,
 * preventing payment rejections, bank throttles, and queue pileups.
 */

export class VpaRotatorEngine {
  /**
   * @param {import('@coupi/db').Database} db
   * @param {object} [options]
   * @param {number} [options.defaultDailyLimitPaise=9000000] - Default ₹90,000.00 safety margin
   * @param {number} [options.defaultDailyTxLimit=20] - Default 20 transactions per day
   */
  constructor(db, options = {}) {
    this.db = db;
    this.defaultDailyLimitPaise = options.defaultDailyLimitPaise ?? 9000000; // ₹90,000 (safety under ₹1L)
    this.defaultDailyTxLimit = options.defaultDailyTxLimit ?? 20;
  }

  /**
   * Calculates today's transaction volume and count for a given receiving account.
   * Uses UTC / system date comparison on completed successful sessions.
   *
   * @param {string} receivingAccountId
   * @returns {{ totalVolumePaise: number, txCount: number }}
   */
  getDailyMetrics(receivingAccountId) {
    const today = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
    const row = this.db.queryOne(`
      SELECT 
        COALESCE(SUM(amount_paise), 0) AS total_volume_paise,
        COUNT(*) AS tx_count
      FROM payment_sessions
      WHERE receiving_account_id = ?
        AND status = 'SUCCESS'
        AND completed_at IS NOT NULL
        AND SUBSTR(completed_at, 1, 10) = ?
    `, [receivingAccountId, today]);

    return {
      totalVolumePaise: Number(row?.total_volume_paise || 0),
      txCount: Number(row?.tx_count || 0)
    };
  }

  /**
   * Evaluates if a receiving account has remaining capacity for a new transaction.
   *
   * @param {object} account
   * @param {number} requestedAmountPaise
   * @returns {{ hasCapacity: boolean, reason?: string, metrics: { totalVolumePaise: number, txCount: number, limitPaise: number, maxTx: number } }}
   */
  evaluateAccountCapacity(account, requestedAmountPaise = 0) {
    const metrics = this.getDailyMetrics(account.id);
    const limitPaise = Math.min(
      account.daily_limit_paise ?? Infinity,
      this.defaultDailyLimitPaise
    );
    const maxTx = Math.min(
      account.daily_tx_limit ?? Infinity,
      this.defaultDailyTxLimit
    );

    // Check transaction count ceiling
    if (metrics.txCount >= maxTx) {
      return {
        hasCapacity: false,
        reason: 'DAILY_TX_LIMIT_REACHED',
        metrics: { ...metrics, limitPaise, maxTx }
      };
    }

    // Check volume ceiling (including incoming requested amount)
    if (metrics.totalVolumePaise + requestedAmountPaise > limitPaise) {
      return {
        hasCapacity: false,
        reason: 'DAILY_VOLUME_LIMIT_REACHED',
        metrics: { ...metrics, limitPaise, maxTx }
      };
    }

    return {
      hasCapacity: true,
      metrics: { ...metrics, limitPaise, maxTx }
    };
  }

  /**
   * Selects or rotates to the optimal receiving account for a merchant checkout.
   * If the currently active VPA is full, atomically promotes the next eligible VPA.
   *
   * @param {string} merchantId
   * @param {number} [requestedAmountPaise=0]
   * @returns {{
   *   account: object,
   *   rotated: boolean,
   *   previousAccountId?: string,
   *   reason?: string,
   *   metrics: object
   * }}
   */
  getOptimalReceivingAccount(merchantId, requestedAmountPaise = 0) {
    // 1. Fetch all enabled accounts for this merchant
    const accounts = this.db.query(`
      SELECT * FROM payment_receiving_accounts 
      WHERE merchant_id = ? AND is_merchant_enabled = 1
      ORDER BY is_active DESC, created_at ASC
    `, [merchantId]);

    if (!accounts || accounts.length === 0) {
      throw new Error(`No enabled receiving accounts found for merchant ${merchantId}`);
    }

    const currentActive = accounts.find(a => Boolean(a.is_active));
    
    // If we have an active account and it has capacity, use it immediately
    if (currentActive) {
      const evaluation = this.evaluateAccountCapacity(currentActive, requestedAmountPaise);
      if (evaluation.hasCapacity) {
        return {
          account: currentActive,
          rotated: false,
          metrics: evaluation.metrics
        };
      }
    }

    // Current active account has hit a ceiling or there is no active account.
    // Scan other enabled accounts for the first one with remaining capacity.
    for (const candidate of accounts) {
      if (currentActive && candidate.id === currentActive.id) continue;

      const evaluation = this.evaluateAccountCapacity(candidate, requestedAmountPaise);
      if (evaluation.hasCapacity) {
        // Found an eligible candidate with capacity! Atomically rotate.
        this.rotateActiveAccount(merchantId, candidate.id);
        candidate.is_active = 1;

        return {
          account: candidate,
          rotated: true,
          previousAccountId: currentActive?.id,
          reason: currentActive ? 'DAILY_LIMIT_GUARD_ROTATION' : 'INITIAL_ACTIVATION',
          metrics: evaluation.metrics
        };
      }
    }

    // Fallback: All accounts have saturated their daily thresholds!
    // Pick the account with the lowest volume utilization to minimize rejection risk.
    let bestAccount = accounts[0];
    let lowestVolume = Infinity;
    let bestMetrics = null;

    for (const candidate of accounts) {
      const m = this.getDailyMetrics(candidate.id);
      if (m.totalVolumePaise < lowestVolume) {
        lowestVolume = m.totalVolumePaise;
        bestAccount = candidate;
        bestMetrics = m;
      }
    }

    if (!bestAccount.is_active) {
      this.rotateActiveAccount(merchantId, bestAccount.id);
      bestAccount.is_active = 1;
    }

    return {
      account: bestAccount,
      rotated: currentActive ? bestAccount.id !== currentActive.id : false,
      previousAccountId: currentActive?.id,
      reason: 'ALL_ACCOUNTS_NEAR_CEILING_LOWEST_UTILIZATION_ASSIGNED',
      metrics: bestMetrics || this.getDailyMetrics(bestAccount.id)
    };
  }

  /**
   * Atomically rotates active status to targeted account in SQLite / DB.
   *
   * @param {string} merchantId
   * @param {string} targetAccountId
   */
  rotateActiveAccount(merchantId, targetAccountId) {
    const now = new Date().toISOString();
    this.db.transaction(() => {
      this.db.execute(`
        UPDATE payment_receiving_accounts 
        SET is_active = 0, updated_at = ? 
        WHERE merchant_id = ?
      `, [now, merchantId]);

      this.db.execute(`
        UPDATE payment_receiving_accounts 
        SET is_active = 1, updated_at = ? 
        WHERE id = ? AND merchant_id = ?
      `, [now, targetAccountId, merchantId]);
    });
  }
}
