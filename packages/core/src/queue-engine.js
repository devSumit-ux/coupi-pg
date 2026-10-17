import { PaymentStatus } from '@coupi/common';
import { PaiseOffsetEngine } from './offset-engine.js';

export class QueueEngine {
  /**
   * @param {{
   *   sessionRepo: import('@coupi/db').PaymentSessionRepository,
   *   accountRepo: import('@coupi/db').ReceivingAccountRepository,
   *   eventEmitter?: { emit: (event: string, payload: any) => void },
   *   auditRepo?: import('@coupi/db').AuditLogRepository,
   *   strictSingleSlot?: boolean,
   *   maxOffsetPaise?: number
   * }} options
   */
  constructor(options) {
    this.sessionRepo = options.sessionRepo;
    this.accountRepo = options.accountRepo;
    this.eventEmitter = options.eventEmitter || { emit: () => {} };
    this.auditRepo = options.auditRepo;
    this.strictSingleSlot = Boolean(options.strictSingleSlot || process.env.STRICT_SINGLE_SLOT === 'true');

    this.offsetEngine = new PaiseOffsetEngine({
      sessionRepo: this.sessionRepo,
      accountRepo: this.accountRepo,
      eventEmitter: this.eventEmitter,
      auditRepo: this.auditRepo,
      maxOffsetPaise: options.maxOffsetPaise
    });
  }

  /**
   * Attempts to acquire an active slot via Paise Offset (non-blocking) or places into single-slot queue if strict single slot is enforced.
   * @param {string} sessionId
   * @param {string} receivingAccountId
   * @param {number} [activeDurationMs=300000]
   * @param {boolean} [forceSingleSlot=false]
   * @returns {{ status: string, queuePosition: number, expiresAt: Date | null, offsetPaise?: number, payableAmountPaise?: bigint }}
   */
  enqueueOrActivate(sessionId, receivingAccountId, activeDurationMs = 300000, forceSingleSlot = false) {
    if (this.strictSingleSlot || forceSingleSlot) {
      const result = this.sessionRepo.acquireSlotAtomic(sessionId, receivingAccountId, activeDurationMs);

      if (result.status === PaymentStatus.ACTIVE) {
        this.eventEmitter.emit('SESSION.ACTIVATED', {
          sessionId,
          receivingAccountId,
          expiresAt: result.expiresAt
        });

        if (this.auditRepo) {
          this.auditRepo.log({
            entityType: 'PAYMENT_SESSION',
            entityId: sessionId,
            action: 'PAYMENT_SLOT_ACTIVATED',
            actorType: 'SYSTEM',
            details: { receivingAccountId, expiresAt: result.expiresAt?.toISOString() }
          });
        }
      } else {
        this.eventEmitter.emit('SESSION.QUEUED', {
          sessionId,
          receivingAccountId,
          queuePosition: result.queuePosition
        });

        if (this.auditRepo) {
          this.auditRepo.log({
            entityType: 'PAYMENT_SESSION',
            entityId: sessionId,
            action: 'PAYMENT_ENQUEUED',
            actorType: 'SYSTEM',
            details: { receivingAccountId, queuePosition: result.queuePosition }
          });
        }
      }

      return result;
    }

    // Default Sovereign Mode: Paise Offset Concurrency Engine
    return this.offsetEngine.allocateOffsetOrEnqueue(sessionId, receivingAccountId, activeDurationMs);
  }

  /**
   * Promotes the next queued session for a receiving account if the slot is free.
   * @param {string} receivingAccountId
   * @param {number} [activeDurationMs=300000]
   * @returns {any | null} The newly activated session or null if queue is empty or slot is busy
   */
  promoteNext(receivingAccountId, activeDurationMs = 300000) {
    const nextQueued = this.sessionRepo.getNextQueuedSession(receivingAccountId);
    if (!nextQueued) {
      return null;
    }

    if (!this.strictSingleSlot) {
      const offsetRes = this.offsetEngine.allocateOffsetOrEnqueue(nextQueued.id, receivingAccountId, activeDurationMs);
      if (offsetRes.status === PaymentStatus.ACTIVE) {
        this.sessionRepo.reindexQueue(receivingAccountId);
        return this.sessionRepo.findById(nextQueued.id);
      }
    }

    // Fallback: Check if single slot is currently occupied
    const active = this.sessionRepo.findCurrentActiveOrProcessing(receivingAccountId);
    if (active) {
      return null;
    }

    const res = this.sessionRepo.acquireSlotAtomic(nextQueued.id, receivingAccountId, activeDurationMs);
    if (res.status === PaymentStatus.ACTIVE) {
      this.sessionRepo.reindexQueue(receivingAccountId);
      const activatedSession = this.sessionRepo.findById(nextQueued.id);

      this.eventEmitter.emit('SESSION.ACTIVATED', {
        sessionId: nextQueued.id,
        receivingAccountId,
        expiresAt: activatedSession.expiresAt
      });

      this.eventEmitter.emit('QUEUE.PROMOTED', {
        receivingAccountId,
        promotedSessionId: nextQueued.id
      });

      if (this.auditRepo) {
        this.auditRepo.log({
          merchantId: activatedSession.merchantId,
          entityType: 'PAYMENT_SESSION',
          entityId: nextQueued.id,
          action: 'QUEUE_PROMOTION_TO_ACTIVE',
          actorType: 'SYSTEM',
          details: { receivingAccountId, expiresAt: activatedSession.expiresAt?.toISOString() }
        });
      }

      return activatedSession;
    }

    return null;
  }

  /**
   * Calculates estimated wait time in seconds for a queued session.
   * @param {string} receivingAccountId
   * @param {number} queuePosition
   * @returns {number} Estimated seconds until activation
   */
  calculateEstimatedWaitSeconds(receivingAccountId, queuePosition) {
    if (queuePosition <= 0) return 0;

    let currentSlotRemaining = 0;
    const currentActive = this.sessionRepo.findCurrentActiveOrProcessing(receivingAccountId);

    if (currentActive) {
      const now = Date.now();
      if (currentActive.status === PaymentStatus.PROCESSING && currentActive.processingExpiresAt) {
        currentSlotRemaining = Math.max(0, Math.ceil((currentActive.processingExpiresAt.getTime() - now) / 1000));
      } else if (currentActive.status === PaymentStatus.ACTIVE && currentActive.expiresAt) {
        currentSlotRemaining = Math.max(0, Math.ceil((currentActive.expiresAt.getTime() - now) / 1000));
      }
    }

    const CYCLE_DURATION_SECONDS = 330;
    const precedingQueuedWait = (queuePosition - 1) * CYCLE_DURATION_SECONDS;

    return currentSlotRemaining + precedingQueuedWait;
  }
}
