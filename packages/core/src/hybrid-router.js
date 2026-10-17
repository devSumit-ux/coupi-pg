/**
 * @file packages/core/src/hybrid-router.js
 * Phase 2 Enterprise Hybrid Payment Router (Bank Smart Collect & Dynamic Virtual Accounts)
 *
 * Implements intelligent dual-rail transaction routing:
 * - Rail 1 (P2P UPI): 0% Aggregator Fee. Ideal for low-ticket retail items (< ₹2,000).
 *   Uses CouPI's high-concurrency Paise Offset Engine (₹0.00 - ₹0.99) on merchant VPAs.
 * - Rail 2 (Bank Smart Collect / Dynamic Virtual Accounts): Flat ₹1–₹2 per transaction.
 *   Direct corporate banking integration (ICICI Smart Collect, Yes Bank API, Axis EasyPay).
 *   Generates 1:1 dynamic virtual accounts / unique VPAs (e.g. ord1001.merch@icicibank)
 *   with instant 50ms bank switch webhook callbacks.
 */

export const PaymentRails = {
  P2P_UPI: 'P2P_UPI',
  BANK_SMART_COLLECT: 'BANK_SMART_COLLECT'
};

export class HybridPaymentRouter {
  /**
   * @param {object} [options]
   * @param {number} [options.highTicketThresholdPaise=200000] - ₹2,000.00 default threshold
   * @param {string} [options.defaultBank='ICICI'] - Default corporate banking provider
   * @param {string} [options.virtualPrefix='COUP'] - Virtual account prefix
   * @param {number} [options.flatBankFeeRupees=1.0] - Flat bank smart collect charge (₹1.00)
   */
  constructor(options = {}) {
    this.highTicketThresholdPaise = options.highTicketThresholdPaise ?? 200000; // ₹2,000.00
    this.defaultBank = options.defaultBank ?? 'ICICI';
    this.virtualPrefix = options.virtualPrefix ?? 'COUP';
    this.flatBankFeeRupees = options.flatBankFeeRupees ?? 1.0;
  }

  /**
   * Decides the optimal payment rail based on transaction amount, merchant volume tier, and flags.
   *
   * @param {object} params
   * @param {number} params.amountPaise
   * @param {string} [params.merchantTier='STANDARD'] - 'STANDARD' | 'GROWTH' | 'ENTERPRISE'
   * @param {string} [params.forceRail] - Force specific rail ('P2P_UPI' | 'BANK_SMART_COLLECT')
   * @returns {{ rail: string, reason: string }}
   */
  determineRail({ amountPaise, merchantTier = 'STANDARD', forceRail = null }) {
    if (forceRail && Object.values(PaymentRails).includes(forceRail)) {
      return {
        rail: forceRail,
        reason: 'EXPLICIT_MERCHANT_RAIL_SELECTION'
      };
    }

    if (merchantTier === 'ENTERPRISE') {
      return {
        rail: PaymentRails.BANK_SMART_COLLECT,
        reason: 'ENTERPRISE_VOLUME_TIER_DIRECT_BANK_ROUTING'
      };
    }

    if (amountPaise >= this.highTicketThresholdPaise) {
      return {
        rail: PaymentRails.BANK_SMART_COLLECT,
        reason: `HIGH_TICKET_TRANSACTION_EXCEEDS_THRESHOLD_₹${(this.highTicketThresholdPaise / 100).toFixed(2)}`
      };
    }

    return {
      rail: PaymentRails.P2P_UPI,
      reason: 'RETAIL_TRANSACTION_ZERO_FEE_P2P_ROUTING'
    };
  }

  /**
   * Generates a 1:1 Dynamic Virtual Account and Virtual VPA for Smart Collect.
   *
   * @param {string} merchantId
   * @param {string} orderId
   * @param {string} [bankName]
   * @returns {{
   *   virtualVpa: string,
   *   virtualAccountNumber: string,
   *   ifsc: string,
   *   beneficiaryName: string,
   *   bankName: string
   * }}
   */
  generateVirtualAccount(merchantId, orderId, bankName = null) {
    const bank = (bankName || this.defaultBank).toUpperCase();
    const cleanOrder = String(orderId).replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
    const cleanMerchant = String(merchantId).replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase();

    let ifsc = 'ICIC0000104';
    let handle = 'icicibank';

    if (bank === 'YESBANK') {
      ifsc = 'YESB0000001';
      handle = 'yesbank';
    } else if (bank === 'AXIS') {
      ifsc = 'UTIB0000001';
      handle = 'axisbank';
    }

    const virtualAccountNumber = `${this.virtualPrefix}${cleanOrder}`;
    const virtualVpa = `${cleanOrder.toLowerCase()}.${cleanMerchant}@${handle}`;

    return {
      virtualVpa,
      virtualAccountNumber,
      ifsc,
      beneficiaryName: `CouPI Gateway · ${cleanOrder}`,
      bankName: bank
    };
  }

  /**
   * Calculates financial savings compared to traditional 2.0% + 18% GST aggregators.
   *
   * @param {number} amountPaise
   * @param {string} rail
   * @returns {{
   *   amountRupees: string,
   *   aggregatorCutRupees: string,
   *   coupiCostRupees: string,
   *   netSavingsRupees: string,
   *   savingsRatioPercent: string
   * }}
   */
  calculateSavings(amountPaise, rail) {
    const amountRupees = amountPaise / 100;

    // Standard aggregator fee: 2% + 18% GST = 2.36% effective
    const aggregatorBaseFee = amountRupees * 0.02;
    const gstOnFee = aggregatorBaseFee * 0.18;
    const totalAggregatorCut = aggregatorBaseFee + gstOnFee;

    // CouPI Cost: ₹0 for P2P UPI, flat ₹1 for Bank Smart Collect
    const coupiCost = rail === PaymentRails.P2P_UPI ? 0.0 : this.flatBankFeeRupees;
    const netSavings = Math.max(0, totalAggregatorCut - coupiCost);
    const savingsRatio = totalAggregatorCut > 0 ? (netSavings / totalAggregatorCut) * 100 : 100;

    return {
      amountRupees: amountRupees.toFixed(2),
      aggregatorCutRupees: totalAggregatorCut.toFixed(2),
      coupiCostRupees: coupiCost.toFixed(2),
      netSavingsRupees: netSavings.toFixed(2),
      savingsRatioPercent: savingsRatio.toFixed(1)
    };
  }

  /**
   * Routes an incoming checkout request through the hybrid engine.
   *
   * @param {object} params
   * @param {string} params.merchantId
   * @param {string} params.orderId
   * @param {number} params.amountPaise
   * @param {string} [params.merchantTier='STANDARD']
   * @param {string} [params.forceRail]
   * @returns {object} Full routing packet
   */
  route({ merchantId, orderId, amountPaise, merchantTier = 'STANDARD', forceRail = null }) {
    const decision = this.determineRail({ amountPaise, merchantTier, forceRail });
    const savings = this.calculateSavings(amountPaise, decision.rail);

    let virtualAccount = null;
    let upiIntentUri = null;

    if (decision.rail === PaymentRails.BANK_SMART_COLLECT) {
      virtualAccount = this.generateVirtualAccount(merchantId, orderId);
      const rupees = (amountPaise / 100).toFixed(2);
      upiIntentUri = `upi://pay?pa=${encodeURIComponent(virtualAccount.virtualVpa)}&pn=${encodeURIComponent(virtualAccount.beneficiaryName)}&am=${rupees}&cu=INR&tn=${encodeURIComponent(orderId)}`;
    }

    return {
      rail: decision.rail,
      reason: decision.reason,
      amountPaise,
      amountRupees: (amountPaise / 100).toFixed(2),
      savings,
      virtualAccount,
      upiIntentUri
    };
  }
}
