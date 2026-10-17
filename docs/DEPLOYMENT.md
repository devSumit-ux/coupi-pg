# COUPI PG V2 — Deployment & Installation Guide

> **Production Deployment Specification**  
> Complete deployment guide for running the sovereign, zero-fee **COUPI PG V2** payment gateway on Linux servers, Docker containers, and cloud platforms (Railway, Render, AWS, DigitalOcean).

---

## 1. Prerequisites & Architecture

- **Operating System**: Linux (Ubuntu 22.04+ / Debian 12+), macOS, or Windows Server.
- **Node.js**: Version `>= 20.0.0` (Native ESM and `node:sqlite` WAL support).
- **Package Manager**: `npm` (included with Node.js).
- **Network Services**:
  - `6100`: Payment Core API (State machine, REST API, SSE stream, Paise Offset Engine)
  - `7000`: Checkout Portal & `coupi.js` SDK host
  - `6001`: Merchant Admin Panel
  - `5000`: Demo Coin Wallet Store (Reference Implementation)
  - `6003`: IMAP IDLE Push Observer & OAuth2 Mailbox Service
  - `8090`: Control Center Host Supervisor

---

## 2. Installation Steps

### Step 1: Clone or Extract Repository
```bash
git clone <repository_url> coupi
cd coupi
```

### Step 2: Configure Environment
Copy the environment template:
```bash
cp .env.example .env
```

Open `.env` and set:
1. `ENCRYPTION_MASTER_KEY`: 64-character hex key (e.g. `node -e "console.log(crypto.randomBytes(32).toString('hex'))"`).
2. `JWT_SECRET`: Random secret string (minimum 32 characters).
3. `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`: Credentials for your Merchant Admin dashboard.
4. `BASE_PAYMENT_API_URL` and `BASE_CHECKOUT_URL`: Your public domain or localhost URLs.
5. `IMAP_USER` and `IMAP_PASS`: Your receiving bank email address and app password.

### Step 3: Install Dependencies
```bash
npm install
```

### Step 4: Initialize Fresh Database
```bash
npm run db:setup
```
*(Automatically provisions `data/coupi_pg.sqlite` in WAL mode with default seeds).*

### Step 5: Start the Services

#### Local Development / Demonstration:
```bash
npm run dev
```
Starts all services with console log aggregation under the Control Center at `http://localhost:8090`.

#### Production Headless Daemon:
```bash
npm run start
```

---

## 3. Docker & Container Deployment

For containerized deployment on Railway, Render, Fly.io, or VPS:

### `Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

COPY package*.json ./
COPY packages ./packages
COPY apps ./apps

RUN npm install --omit=dev

EXPOSE 6100 7000 6001 5000 6003 8090

CMD ["npm", "run", "start"]
```

### `docker-compose.yml`:
```yaml
version: '3.8'

services:
  coupi-gateway:
    build: .
    restart: unless-stopped
    ports:
      - "6100:6100"
      - "7000:7000"
      - "6001:6001"
      - "5000:5000"
      - "6003:6003"
      - "8090:8090"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
```

---

## 4. Reverse Proxy & SSL (NGINX / Cloudflare)

In production, terminate SSL at your reverse proxy:

### NGINX Configuration:
```nginx
server {
    listen 443 ssl http2;
    server_name pay.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/pay.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/pay.yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:7000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

*Note: The Checkout Portal on port 7000 automatically proxies API requests (`/api/*`) to the Payment Core API on port 6100.*

---

## 5. Verification Checklist

1. **Checkout Portal & SDK:** Open `https://pay.yourdomain.com/coupi.js` — confirms the universal embed bundle is live.
2. **Health Check:** `curl https://pay.yourdomain.com/api/health` returns `{"status":"UP"}`.
3. **Merchant Admin:** Log in at `http://localhost:6001` (or your admin subdomain) and verify your receiving UPI VPA.
4. **IMAP Push Observer:** Verify the log line: `[CouPI IMAP] IDLE socket active. Listening for real-time bank push notifications...`.
