# Cloud-Native Banking Observer Setup Guide

> **COUPI PG V2 Architecture**  
> Unlike legacy tools (such as `YouPI-PG`) that required maintaining physical Android smartphones with SIM cards or scraping Google Messages Web via Puppeteer, COUPI PG V2 operates **100% cloud-natively** via RFC 2177 IMAP IDLE push sockets and OAuth2.

---

## Overview

Indian commercial banks (HDFC, ICICI, SBI, Axis, Kotak, PNB, Canara, IndusInd, etc.) automatically send an email transaction alert whenever an incoming UPI transfer credits your account.

COUPI PG V2 maintains an open, encrypted TLS socket to your alert email inbox. Using the standard IMAP `IDLE` protocol, your mail server pushes new messages to COUPI PG within **400 milliseconds** of delivery.

---

## Method 1: RFC 2177 IMAP IDLE Push Observer (Recommended)

This is the fastest, simplest, and most reliable method. It requires zero cloud console approvals or API quotas.

### Step 1: Generate an App Password for Your Mailbox

#### For Gmail / Google Workspace:
1. Go to your [Google Account Security Settings](https://myaccount.google.com/security).
2. Enable **2-Step Verification** (if not already enabled).
3. Search for **App passwords** (or go to `https://myaccount.google.com/apppasswords`).
4. Enter an app name (e.g. `CouPI Payment Gateway`) and click **Create**.
5. Copy the 16-character generated password (e.g. `abcd efgh ijkl mnop`).

#### For Outlook / Hotmail / Microsoft 365:
1. Go to [Microsoft Security Settings](https://account.microsoft.com/security).
2. Select **Advanced security options** -> **App passwords** -> **Create a new app password**.

#### For Custom Domain / Bank Email:
Use your standard IMAP host, port 993, your mailbox username, and password.

---

### Step 2: Configure Environment Variables

Add the following credentials to your root `.env` file (or your cloud container environment variables on Render, Railway, or Docker):

```env
# Enable Cloud-Native IMAP Push Observer
IMAP_OBSERVER_ENABLED=true

# Mailbox Server Settings
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_SECURE=true

# Credentials
IMAP_USER=yourbusiness.alerts@gmail.com
IMAP_PASS=abcdefghijklmnop

# Mailbox Folder to Watch (Default: INBOX)
IMAP_MAILBOX=INBOX
```

---

### Step 3: Verify Connection

Start the observer or the entire suite:

```bash
npm run dev
```

In the console logs, you will observe:
```text
[CouPI IMAP] Connecting to imap.gmail.com:993...
[CouPI IMAP] Authenticated as yourbusiness.alerts@gmail.com
[CouPI IMAP] Selected mailbox "INBOX" (UIDValidity: 1)
[CouPI IMAP] IDLE socket active. Listening for real-time bank push notifications...
```

When a UPI credit notification arrives from HDFC, SBI, ICICI, etc., you will see:
```text
[CouPI IMAP] Push notification received: "Credit Alert: Rs. 499.03 received via UPI"
[CouPI IMAP] Parsed incoming credit: ₹499.03, UTR: 429810238194, Account: XX1234
[CouPI IMAP] Observation submitted successfully to Payment Core API
```

---

## Method 2: Google Cloud OAuth2 Sync (Optional Fallback)

If your enterprise security policy prohibits App Passwords, you can connect via Google Cloud OAuth2:

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named `CouPI-Gateway`.
3. Navigate to **APIs & Services** -> **Library** and enable the **Gmail API**.
4. Navigate to **APIs & Services** -> **Credentials** -> **Create Credentials** -> **OAuth client ID**:
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:6003/oauth/callback` (or `https://your-domain.com/oauth/callback`)
5. Save the credentials in your `.env`:
   ```env
   GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=your-client-secret
   GMAIL_REDIRECT_URI=http://localhost:6003/oauth/callback
   ```
6. Visit `http://localhost:6003/oauth/url` or open the Merchant Admin to authorize mailbox read permissions.

---

## Method 3: 12-Digit Bank Reference (UTR) Fast-Path

When a customer pays using Google Pay, PhonePe, or Paytm, their payment receipt displays a **12-digit UPI Reference Number / UTR** (e.g. `429810238194`).

COUPI PG provides an instant client submission endpoint:
```http
POST /api/v1/sessions/:sessionId/utr
Content-Type: application/json

{
  "utr": "429810238194"
}
```

If the customer pastes or types their UTR into the checkout modal, the Attribution Engine immediately validates the UTR against recent incoming bank observations, confirming the payment with zero delay.

---

## Notice: Decommissioned Legacy Methods

The following mechanisms from legacy `YouPI-PG` have been permanently retired:
- **Android Phone APK (`com.youpi.observer`):** Eliminated. No need for dedicated physical hardware, battery maintenance, or charging cradles.
- **Google Messages Web Puppeteer Scraper:** Eliminated. No need for fragile Chrome browser automation, session disconnects, or DOM parsing risks.
