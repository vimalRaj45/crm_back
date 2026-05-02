# 🚀 Spirelia AI CRM: Master Architecture & Code Guide

Welcome to the **Spirelia AI CRM** master documentation. This file provides a top-to-bottom, comprehensive breakdown of the entire platform. This system acts as an **Autonomous Sales Development Representative (SDR)**, capable of reading incoming emails, utilizing an LLM to extract highly structured lead data, deduplicating the entries, and rendering them in a secure, interactive web dashboard.

---

## 🏗️ 1. High-Level Architecture
The CRM is built on a decoupled, 4-tier architecture designed for maximum performance, high privacy, and zero infrastructure cost (leveraging Google services).

1.  **Automation & AI Layer**: `Code.gs` (Google Apps Script)
2.  **Database Layer**: Google Sheets API v4
3.  **Secure Backend Layer**: `server.js` (Node.js & Express)
4.  **Interactive Frontend Layer**: `public/index.html` (Vanilla Web Stack)

---

## 🧠 2. Layer 1: Data Ingestion & AI Intelligence (`Code.gs`)
*This file runs securely in the background on Google Apps Script servers.*

### A. Automated Mining
*   **Gmail Trigger**: The script uses `GmailApp.search()` to actively scan the user's inbox for high-value signals like `"innovation OR R&D OR patent"`.
*   **Sender Whitelisting**: `isSenderAllowed()` ensures only emails forwarded from authorized team members are processed.

### B. The 3-Layer Deduplication Engine
Before calling the expensive AI API, the script prevents duplicates:
1.  **Message ID Cache**: Tracks native Gmail thread IDs.
2.  **Signature Hashing**: Creates a lightweight hash of the email body to identify structurally identical forwards.
3.  **Historical Row Scan**: Scans the last 500 Google Sheet rows for matching Company Name and Position pairs to prevent overlapping data.

### C. PII Sanitization (Privacy-First)
*   **`sanitizeEmailBody()`**: Before any data leaves Google's servers, raw email addresses and phone numbers are scrubbed and replaced with `[EMAIL]` and `[PHONE]` using strict Regex. This guarantees GDPR compliance.

### D. Mistral AI Extraction
*   **Prompt Engineering**: The script instructs Mistral Large to return a strict 16-point JSON array.
*   **Data Formatting**: Explicit rules are set for the AI, such as stripping legal suffixes ("Inc.", "LLC") and generating clean vanity LinkedIn URLs (e.g., `testcompany` instead of `test-company`).
*   **Actionable Generation**: The AI not only extracts data but creates two highly valuable synthetic fields:
    *   **Fit Reason**: A 1-sentence explanation of *why* the lead matches.
    *   **Outreach Msg**: A personalized draft email tailored to the lead's R&D profile.

---

## 💾 3. Layer 2: The Database (Google Sheets)
*Google Sheets acts as a free, scalable Headless CMS.*

*   **Initialization**: Running `initializeCRM()` formats the UI with colored headers, freezes rows, and expands the schema to **16 columns**, including `Notes`.
*   **Filtered Leads**: Leads that contain "Noise Keywords" (e.g., specific IT consulting firms like TCS) or lack critical data are routed to a separate `Filtered_Leads` sheet for manual auditing.

---

## 🛡️ 4. Layer 3: The Backend API Gateway (`server.js`)
*This Express.js application runs on a Node server (e.g., Render/VPS) and bridges the gap between the private Google Sheet and the public web.*

### A. Passwordless Authentication
*   **Brevo Integration**: Replaces traditional passwords with secure OTPs (One-Time Passwords).
*   **Flow**: The user inputs an email $\rightarrow$ Backend verifies it against `.env` whitelist $\rightarrow$ Generates a 6-digit code $\rightarrow$ Transmits via Brevo SMTP $\rightarrow$ User inputs code to receive a secure 24-hour Session Token.

### B. Google Sheets Middleware
*   **Service Account Authorization**: The server uses `service-account.json` to authenticate backend requests. The raw sheet is never exposed to the client.
*   **Data Serialization (`GET /api/leads`)**: Fetches rows, maps them to JSON objects, and dynamically tracks the exact spreadsheet row (`_sheetRow`) for future write-backs.
*   **Interactive Write-Backs (`POST /api/leads/notes`)**: An elevated endpoint utilizing the full `spreadsheets` scope, allowing frontend users to save qualitative notes directly back into Column P of the Google Sheet.

---

## 💻 5. Layer 4: The Frontend Dashboard (`public/index.html`)
*A responsive, modern UI utilizing a custom "Glassmorphic" CSS aesthetic.*

### A. Advanced 7-Point Filtering Engine
Users can slice data with zero latency directly in the browser via an explicit **"Apply"** button workflow:
*   **Global Search**: String-safe global querying across all fields.
*   **Sector & Position**: Regex-mapped dropdowns targeting specific industries (e.g., Pharma, Aerospace) and hierarchy levels (VP, Director).
*   **Fit & Score**: Slider-based UI for lead scoring.

### B. The Lead Detail Modal
When a user clicks a row, the application renders a beautiful overlay modal with actionable features:
*   **One-Click Copy**: The AI-generated "Outreach Msg" is stored in a monospace block. A custom `copyToClipboard()` function allows instant pasting into email clients.
*   **Google Optimization**: The "Domain" field is transformed into a highly optimized Google query (`https://www.google.com/search?q=[Company]+linkedin+website+contact`), bypassing manual research.
*   **Asynchronous Notes**: Users can type directly into the Notes block. Clicking "Save Notes" executes a background API call that updates the master database without reloading the page.
*   **Accident Prevention**: A `beforeunload` event listener actively protects the user from losing unsaved notes if they try to close the tab prematurely.
