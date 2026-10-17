# Configuration & Secret Management Guide

> **COUPI PG V2 Configuration Reference**

---

## 1. Environment Parameters Reference

| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Runtime environment (`development` or `production`) |
| `CONTROL_CENTER_PORT` | `8090` | Host port for the Local Process Supervisor |
| `PAYMENT_API_PORT` | `6100` | Host port for the central Payment Core REST API |
| `CHECKOUT_PORTAL_PORT` | `7000` | Host port for the customer-facing Checkout page & `coupi.js` |
| `MERCHANT_ADMIN_PORT` | `6001` | Host port for the Merchant Admin Dashboard |
| `GMAIL_OBSERVER_PORT` | `6003` | Host port for the IMAP push observer & OAuth2 callback |
| `IMAP_OBSERVER_ENABLED`| `true` | Enables real-time RFC 2177 IMAP IDLE push listener |
| `IMAP_HOST` | `imap.gmail.com` | IMAP mail server hostname |
| `IMAP_PORT` | `993` | IMAP SSL/TLS port |
| `IMAP_SECURE` | `true` | Force TLS connection for IMAP |
| `IMAP_USER` | `""` | Bank alert receiving email address |
| `IMAP_PASS` | `""` | 16-character App Password or mail password |
| `IMAP_MAILBOX` | `INBOX` | Mailbox folder to monitor for bank alerts |
| `SQLITE_DB_PATH` | `./data/coupi_pg.sqlite`| Path to local SQLite WAL database file |
| `ENCRYPTION_MASTER_KEY` | *(Required)* | 64-character hex key (256-bit) for encrypting stored secrets |
| `JWT_SECRET` | *(Required)* | Secret key for customer and admin session tokens (min 32 chars) |
| `PAYMENT_ACTIVE_WINDOW_MS` | `300000` | Duration of active payment window (5 minutes = 300,000ms) |
| `PAYMENT_PROCESSING_WINDOW_MS` | `30000` | Duration of verification countdown (30 seconds = 30,000ms) |
| `LATE_OBSERVATION_WINDOW_MS` | `1800000` | Window for reconciling late bank observations (30 minutes) |

---

## 2. Cryptographic Secret Generation

Generate strong 256-bit encryption keys using Node.js native crypto:

```bash
# Generate 256-bit Master Key (64 hex characters)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Never commit production `.env` files to source code repositories.
