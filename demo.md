# Spirelia AI Lead Intelligence CRM - Demo Script & Analysis

## 🏗️ System Architecture Overview
The **Spirelia CRM V2** is a high-performance lead generation and intelligence pipeline that bridges Google Workspace (Gmail/Sheets) with a custom modern dashboard using AI.

### 1. The Intelligence Engine (`Code.gs`)
- **Source**: Scans Gmail for high-intent keywords (innovation, R&D, patents).
- **AI Qualification**: Uses **Mistral AI** to parse unstructured email bodies into a structured 14-column lead format.
- **Enrichment**: Automatically queries Wikipedia for company intelligence (firmographics, employee size, HQ).
- **Deduplication**: 3-layer fingerprinting (Message ID, Lead Signature, and Recent Row Scan) to prevent duplicate outreach.
- **Output**: Populates a Google Sheet acting as the "Source of Truth".

### 2. The Backend Server (`server.js`)
- **Framework**: Node.js + Express.
- **Authentication**: Secure **OTP-based login** via Brevo (formerly Sendinblue) SMTP.
- **Data Bridge**: Connects to the Google Sheets API using a Service Account to fetch leads in real-time.
- **Security**: In-memory token management for session control.

### 3. The Intelligence Dashboard (`public/index.html`)
- **Aesthetics**: Premium Glassmorphic design with a customizable Dark/Light mode.
- **Advanced Filtering**: 7+ filters including Score Range, Sector, Position, and Contact Availability.
- **Real-time Stats**: Dynamic cards showing total leads, average fit scores, and company counts.

---

## 🎬 Step-by-Step Demo Script

### Phase 1: Authentication & First Look
1.  **Open Dashboard**: Navigate to the application URL.
2.  **Login**:
    - Enter an authorized email (defined in `.env`).
    - Receive a 6-digit high-end OTP email via **Brevo**.
    - Input OTP to access the dashboard.
3.  **UI Overview**: Point out the glassmorphic stats cards and the shimmering background that feels alive.

### Phase 2: Lead Intelligence & Enrichment
1.  **Lead Table**: Show the 14-column table where AI-scored leads appear.
2.  **Wikipedia Intelligence**:
    - **Happy Path**: Click a lead with a Wikipedia link. Show the detail modal with firmographics.
    - **The "No Wikipedia" Feature**: Locate a lead with a missing Wikipedia link. 
    - **Observe**: A warning triangle icon (<i class="bi bi-exclamation-triangle-fill" style="color:#f59e0b"></i>) appears in the Wikipedia column.
    - **Interaction**: Click the warning icon.
    - **Detail Modal**: Notice the **warning symbol in the top-left header** and the alert box at the top: *"No Wikipedia intelligence data found for this company."* This demonstrates the system's ability to flag data gaps for manual review.

### Phase 3: Advanced Filtering & Search
1.  **Global Search**: Type a keyword like "Tesla" or "AI" to see instant table filtering.
2.  **Sector Filter**: Select "Automotive" or "Pharma" to show how the system categorizes leads based on AI-analyzed bios.
3.  **Score Range**: Slide the score filter to show only "High Fit" leads (90+).
4.  **Advanced Toggles**: Open the "Advanced Filters" to filter by **Position** (VP, Director) or **Has Contact** (Email/LinkedIn).

### Phase 4: Actionable Outreach
1.  **AI Outreach Draft**: Open any lead modal and scroll to the bottom.
2.  **Observe**: A pre-written, personalized outreach email drafted by AI based on the "Fit Reason".
3.  **Copy**: Click the **"Copy"** button; watch it change to "Copied!" with a green checkmark animation.

---

## 🛠️ Tech Stack Analysis
| Component | Technology |
| :--- | :--- |
| **Automation** | Google Apps Script (ES5) |
| **AI Engine** | Mistral AI (Mistral-Large-Latest) |
| **Server** | Node.js (Express) |
| **Database** | Google Sheets (v4 API) |
| **Auth/Email** | Brevo HTTP API |
| **Frontend** | Vanilla HTML5/CSS3 (Glassmorphism) |
| **Icons** | Bootstrap Icons v1.11.3 |
| **Fonts** | Google Fonts (Inter) |

---
*Created by Antigravity AI - Spirelia Master Edition*
