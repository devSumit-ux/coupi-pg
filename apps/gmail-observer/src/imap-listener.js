import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { PaymentObserverClient } from '@coupi/observer-sdk';
import { BankEmailParser } from './parser.js';

export class ImapIdleListener {
  /**
   * @param {{
   *   host?: string,
   *   port?: number,
   *   secure?: boolean,
   *   user?: string,
   *   pass?: string,
   *   apiBaseUrl?: string,
   *   receivingAccountId?: string,
   *   logger?: boolean
   * }} options
   */
  constructor(options = {}) {
    this.host = options.host || process.env.IMAP_HOST || 'imap.gmail.com';
    this.port = Number(options.port || process.env.IMAP_PORT || 993);
    this.secure = options.secure !== undefined ? options.secure : true;
    this.user = options.user || process.env.IMAP_USER || '';
    this.pass = options.pass || process.env.IMAP_PASSWORD || '';
    this.apiBaseUrl = options.apiBaseUrl || process.env.BASE_PAYMENT_API_URL || 'http://localhost:6100';
    this.receivingAccountId = options.receivingAccountId || '00000000-0000-0000-0000-000000000002';
    this.logger = options.logger || false;

    this.client = null;
    this.isConnected = false;
    this.isIdling = false;
    this.shouldRun = false;
    this.lastEmailAt = null;
    this.observedCount = 0;
    this.processedUids = new Set();
    this.reconnectTimer = null;

    this.observerClient = new PaymentObserverClient({
      apiBaseUrl: this.apiBaseUrl,
      sourceName: 'IMAP_IDLE'
    });
  }

  isConfigured() {
    return Boolean(this.user && this.pass);
  }

  async start() {
    if (!this.isConfigured()) {
      console.log('[IMAP IDLE] Credentials not configured (IMAP_USER / IMAP_PASSWORD). Waiting for configuration.');
      return false;
    }

    this.shouldRun = true;
    return this._connectAndIdle();
  }

  async stop() {
    this.shouldRun = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.client) {
      try {
        await this.client.logout();
      } catch {}
      this.client = null;
    }
    this.isConnected = false;
    this.isIdling = false;
    console.log('[IMAP IDLE] Push listener stopped.');
  }

  async _connectAndIdle() {
    if (!this.shouldRun || !this.isConfigured()) return;

    try {
      console.log(`[IMAP IDLE] Connecting to ${this.host}:${this.port} as ${this.user}...`);
      this.client = new ImapFlow({
        host: this.host,
        port: this.port,
        secure: this.secure,
        auth: {
          user: this.user,
          pass: this.pass
        },
        logger: this.logger ? console : false,
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      });

      this.client.on('error', err => {
        console.error('[IMAP IDLE] Connection error:', err.message);
      });

      this.client.on('close', () => {
        this.isConnected = false;
        this.isIdling = false;
        if (this.shouldRun) {
          console.log('[IMAP IDLE] Connection closed. Scheduling reconnect in 5s...');
          this.reconnectTimer = setTimeout(() => this._connectAndIdle(), 5000);
        }
      });

      // Real-time Push Notification: Bank sends email -> Mail server triggers 'exists' event instantly!
      this.client.on('exists', async data => {
        try {
          await this._handleNewEmails(data);
        } catch (err) {
          console.error('[IMAP IDLE] Error handling incoming email push:', err.message);
        }
      });

      await this.client.connect();
      this.isConnected = true;
      console.log(`[IMAP IDLE] Connected successfully. Opening INBOX...`);

      const lock = await this.client.getMailboxLock('INBOX');
      try {
        // Fetch last few messages once on connection to catch any alerts that arrived while offline
        await this._fetchRecentMessages();
      } finally {
        lock.release();
      }

      console.log('[IMAP IDLE] Entering persistent RFC 2177 IDLE push mode (zero hardware, <400ms latency)...');
      while (this.shouldRun && this.isConnected) {
        this.isIdling = true;
        try {
          await this.client.idle();
        } catch (idleErr) {
          if (!this.shouldRun) break;
          console.warn('[IMAP IDLE] IDLE cycle interrupted, refreshing lock:', idleErr.message);
          await new Promise(r => setTimeout(r, 1000));
        }
      }
    } catch (err) {
      this.isConnected = false;
      this.isIdling = false;
      console.error('[IMAP IDLE] Failed to establish IMAP session:', err.message);
      if (this.shouldRun) {
        this.reconnectTimer = setTimeout(() => this._connectAndIdle(), 10000);
      }
    }
  }

  async _fetchRecentMessages(limit = 5) {
    if (!this.client || !this.client.mailbox) return;
    const total = this.client.mailbox.exists;
    if (total <= 0) return;

    const start = Math.max(1, total - limit + 1);
    const range = `${start}:${total}`;

    for await (const msg of this.client.fetch(range, { uid: true, source: true })) {
      if (this.processedUids.has(msg.uid)) continue;
      this.processedUids.add(msg.uid);
      await this._parseAndSubmitEmail(msg.source, msg.uid);
    }
  }

  async _handleNewEmails(existsData) {
    if (!this.client || !this.client.mailbox) return;
    const count = existsData?.count || this.client.mailbox.exists;
    if (!count) return;

    const lock = await this.client.getMailboxLock('INBOX');
    try {
      const msg = await this.client.fetchOne(count, { uid: true, source: true });
      if (msg && !this.processedUids.has(msg.uid)) {
        this.processedUids.add(msg.uid);
        await this._parseAndSubmitEmail(msg.source, msg.uid);
      }
    } finally {
      lock.release();
    }
  }

  async _parseAndSubmitEmail(sourceBuffer, uid) {
    try {
      const parsed = await simpleParser(sourceBuffer);
      const subject = parsed.subject || '';
      const body = parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ') || '';
      const from = parsed.from?.text || '';
      const date = parsed.date || new Date();

      const paymentInfo = BankEmailParser.parse({
        subject,
        body,
        from,
        date
      });

      if (!paymentInfo) {
        return null;
      }

      console.log(`[IMAP IDLE] Discovered UPI Bank Credit Alert! Amount: ₹${paymentInfo.amount}, Ref: ${paymentInfo.bankReferenceNumber || 'N/A'}`);
      this.lastEmailAt = new Date();

      const result = await this.observerClient.submitObservation({
        receivingAccountId: this.receivingAccountId,
        amountPaise: paymentInfo.amountPaise,
        amount: paymentInfo.amount,
        observedAt: paymentInfo.observedAt,
        bankReferenceNumber: paymentInfo.bankReferenceNumber,
        senderVpa: paymentInfo.senderVpa,
        sender: from,
        rawText: `${subject}\n${body}`,
        rawPayload: {
          uid,
          subject,
          from,
          source: 'IMAP_IDLE',
          bankReferenceNumber: paymentInfo.bankReferenceNumber,
          senderVpa: paymentInfo.senderVpa,
          snippet: paymentInfo.rawSnippet
        }
      });

      this.observedCount++;
      return result;
    } catch (err) {
      console.error(`[IMAP IDLE] Error parsing message uid ${uid}:`, err.message);
      return null;
    }
  }
}
