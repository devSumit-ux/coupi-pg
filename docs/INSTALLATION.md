# Installation & Host Environment Setup Guide

> **COUPI PG V2 Setup Reference**

---

## 1. Operating Environment
COUPI PG V2 is engineered to run directly as native host processes or inside standard Linux containers (Ubuntu, Debian, Alpine) and macOS/Windows environments.

**Zero Hardware & Zero External Database Requirement:** Physical phones, SIM cards, Docker daemons, and external databases are completely optional. The system utilizes Node.js native `node:sqlite` in Write-Ahead Logging (WAL) mode with automatic self-healing schema provisioning.

### Prerequisites
- **Node.js:** `>= 20.0.0` (Node.js 24 LTS recommended)
- **Database:** Built-in zero-dependency SQLite WAL with automatic schema provisioning (or optional PostgreSQL)
- **Mailbox:** Standard IMAP email account (Gmail App Password, Outlook, or corporate bank email)

---

## 2. Zero-Config Quickstart (All Platforms)

Thanks to **Zero-Config Database Auto-Provisioning**, COUPI PG V2 automatically creates `data/coupi_pg.sqlite` and executes idempotent schema migrations and default seeds on first launch:

```bash
# 1. Clone repository
git clone <your-repository-url> coupi-pg
cd coupi-pg

# 2. Install dependencies across monorepo
npm install

# 3. Configure environment
cp .env.example .env

# 4. Start all services
npm start
# or for interactive development with live logs:
npm run dev
```

---

## 3. Linux (Ubuntu / Debian) Production Setup

```bash
# 1. Update system packages
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 24 LTS & Git
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs git

# 3. Clone and enter repository
git clone <your-repository-url> coupi-pg
cd coupi-pg

# 4. Install dependencies
npm install

# 5. Configure environment
cp .env.example .env
nano .env

# 6. Start production cluster
npm start
```

---

## 4. Verification

Run the test suite to ensure the system passes all 31 regression suites:
```bash
node scripts/test-all.js
```
Expected output:
```text
31 passed, 0 failed
```
