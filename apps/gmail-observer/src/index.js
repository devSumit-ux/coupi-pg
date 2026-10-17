import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GmailObserverServer } from './server.js';
import { GmailPoller } from './gmail-poller.js';
import { ImapIdleListener } from './imap-listener.js';

export function startGmailObserver(port = null, options = {}) {
  const finalPort = port || Number(process.env.GMAIL_OBSERVER_PORT || 6003);
  const poller = new GmailPoller(options);
  const imapListener = new ImapIdleListener(options);
  const observerServer = new GmailObserverServer({ poller, imapListener, ...options });
  const rawServer = observerServer.createServer();

  // If IMAP is configured via env, initiate IDLE push loop immediately
  if (imapListener.isConfigured()) {
    imapListener.start().catch(err => {
      console.warn('[IMAP IDLE] Auto-start encountered error:', err.message);
    });
  }

  return new Promise(resolve => {
    const instance = rawServer.listen(finalPort, () => {
      console.log(`[Bank Email Observer] Cloud-native service listening on port ${finalPort}`);
      resolve({
        poller,
        imapListener,
        port: finalPort,
        close: () => new Promise(async cb => {
          poller.stop();
          await imapListener.stop().catch(() => {});
          instance.close(cb);
        })
      });
    });
  });
}

// Auto-run if executed directly as main script
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startGmailObserver();
}
