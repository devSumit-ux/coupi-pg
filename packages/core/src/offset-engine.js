import { PaymentStatus } from '@coupi/common';

/**
 * Sovereign Paise Offset Concurrency Engine for CouPI.
 * Eliminates the single-slot bottleneck by dynamically assigning unique
 * paise offsets (₹0.00 – ₹0.99) to concurrent sessions on identical base amounts.
 * Enables 100 concurrent payments per VPA on the same price without queuing.
 */
export class PaiseOffsetEngine {
  /**
   * @param {{
   *   sessionRepo: import('@coupi/db').PaymentSessionRepository,
   *   accountRepo: import('@coupi/db').ReceivingAccountRepository,
   *   maxOffsetPaise?: number,
   *   eventEmitter?: { emit: (event: string, payload: any) => void },
   *   auditRepo?: import('@coupi/db').AuditLogRepository
   * }} options
   */
  constructor(options) {
    this.sessionRepo = options.sessionRepo;
    this.accountRepo = options.accountRepo;
    this.maxOffsetPaise = options.maxOffsetPaise !== undefined ? options.maxOffsetPaise : 99;
    this.eventEmitter = options.eventEmitter || { emit: () => {} };
    this.auditRepo = options.auditRepo;
  }

  /**
   * Allocates an immediate active slot using paise offset on an active receiving account.
   * If a receiving account is saturated, round-robins to other available active accounts of the merchant.
   *
   * @param {string} sessionId
   * @param {string} receivingAccountId
   * @param {number} [activeDurationMs=600000] - Default 10-minute payment window
   * @returns {{ status: string, queuePosition: number, expiresAt: Date | null, offsetPaise: number, payableAmountPaise: bigint }}
   */
  allocateOffsetOrEnqueue(sessionId, receivingAccountId, activeDurationMs = 600000) {
    const session = this.sessionRepo.findById(sessionId);
    if (!session) {
      throw new Error(`Payment session not found: ${sessionId}`);
    }

    const baseAmountPaise = Number(session.amountPaise);
    const merchantId = session.merchantId;

    // Fetch candidate receiving accounts (start with preferred, then pool others)
    let candidateAccounts = [];
    if (this.accountRepo) {
      if (typeof this.accountRepo.findActiveForMerchant === 'function') {
        const active = this.accountRepo.findActiveForMerchant(merchantId);
        if (active) candidateAccounts.push(active);
      }
      if (typeof this.accountRepo.findByMerchantId === 'function') {
        const all = this.accountRepo.findByMerchantId(merchantId) || [];
        for (const a of all) {
          if (!candidateAccounts.some(c => c.id === a.id)) {
            candidateAccounts.push(a);
          }
        }
      }
    }
    if (candidateAccounts.length === 0 && receivingAccountId) {
      candidateAccounts = [{ id: receivingAccountId }];
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const expiresAt = new Date(now.getTime() + activeDurationMs);
    const expiresAtIso = expiresAt.toISOString();

    return this.sessionRepo.db.transaction(() => {
      // 1. Check if this session is already ACTIVE and not expired
      if (session.status === PaymentStatus.ACTIVE && session.expiresAt && session.expiresAt > now) {
        return {
          status: PaymentStatus.ACTIVE,
          queuePosition: 0,
          expiresAt: session.expiresAt,
          offsetPaise: Number(session.amountPaise) - baseAmountPaise,
          payableAmountPaise: session.amountPaise
        };
      }

      // 2. Iterate through candidate accounts to find an available paise offset
      for (const account of candidateAccounts) {
        const targetAccountId = account.id;

        // Query active/processing sessions for this account in the window
        const activeRows = this.sessionRepo.db.query(`
          SELECT id, amount_paise, status, expires_at
          FROM payment_sessions
          WHERE receiving_account_id = ?
            AND status IN ('ACTIVE', 'PROCESSING')
            AND id != ?
            AND amount_paise >= ?
            AND amount_paise <= ?
            AND (expires_at IS NULL OR expires_at > ?)
        `, [targetAccountId, sessionId, baseAmountPaise, baseAmountPaise + this.maxOffsetPaise, nowIso]);

        const occupiedOffsets = new Set();
        for (const r of activeRows) {
          const diff = Number(r.amount_paise) - baseAmountPaise;
          if (diff >= 0 && diff <= this.maxOffsetPaise) {
            occupiedOffsets.add(diff);
          }
        }

        // Find smallest available offset (0 .. maxOffsetPaise)
        let chosenOffset = -1;
        for (let offset = 0; offset <= this.maxOffsetPaise; offset++) {
          if (!occupiedOffsets.has(offset)) {
            chosenOffset = offset;
            break;
          }
        }

        if (chosenOffset !== -1) {
          // Found an available offset slot!
          const payableAmountPaise = baseAmountPaise + chosenOffset;

          this.sessionRepo.db.execute(`
            UPDATE payment_sessions
            SET receiving_account_id = ?,
                amount_paise = ?,
                status = ?,
                queue_position = 0,
                slot_acquired_at = ?,
                expires_at = ?,
                updated_at = ?
            WHERE id = ?
          `, [targetAccountId, payableAmountPaise, PaymentStatus.ACTIVE, nowIso, expiresAtIso, nowIso, sessionId]);

          // Update receiving account active marker
          this.sessionRepo.db.execute(`
            UPDATE payment_receiving_accounts
            SET is_slot_busy = 1, current_active_session_id = ?, updated_at = ?
            WHERE id = ?
          `, [sessionId, nowIso, targetAccountId]);

          this.eventEmitter.emit('SESSION.ACTIVATED', {
            sessionId,
            receivingAccountId: targetAccountId,
            offsetPaise: chosenOffset,
            payableAmountPaise: BigInt(payableAmountPaise),
            expiresAt
          });

          if (this.auditRepo) {
            this.auditRepo.log({
              merchantId,
              entityType: 'PAYMENT_SESSION',
              entityId: sessionId,
              action: 'PAISE_OFFSET_SLOT_ACTIVATED',
              actorType: 'SYSTEM',
              details: {
                receivingAccountId: targetAccountId,
                baseAmountPaise,
                offsetPaise: chosenOffset,
                payableAmountPaise,
                expiresAt: expiresAtIso
              }
            });
          }

          return {
            status: PaymentStatus.ACTIVE,
            queuePosition: 0,
            expiresAt,
            offsetPaise: chosenOffset,
            payableAmountPaise: BigInt(payableAmountPaise),
            receivingAccountId: targetAccountId
          };
        }
      }

      // 3. Fallback only if ALL 100 offsets across all accounts are simultaneously occupied
      const posRow = this.sessionRepo.db.queryOne(`
        SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_pos
        FROM payment_sessions
        WHERE receiving_account_id = ? AND status = ?
      `, [receivingAccountId, PaymentStatus.QUEUED]);

      const queuePosition = posRow ? posRow.next_pos : 1;

      this.sessionRepo.db.execute(`
        UPDATE payment_sessions
        SET status = ?, queue_position = ?, updated_at = ?
        WHERE id = ?
      `, [PaymentStatus.QUEUED, queuePosition, nowIso, sessionId]);

      return {
        status: PaymentStatus.QUEUED,
        queuePosition,
        expiresAt: null,
        offsetPaise: 0,
        payableAmountPaise: BigInt(baseAmountPaise),
        receivingAccountId
      };
    });
  }
}
