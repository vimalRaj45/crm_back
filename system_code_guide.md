# In-Depth System Code Analysis

This document provides a top-to-bottom, easy-to-understand breakdown of the two core backend files powering the Spirelia Intelligence CRM: `Code.gs` (The Automation Engine) and `server.js` (The Node Server).

---

## 1. `Code.gs` - The Intelligence Engine
*This code runs in Google Apps Script attached to your Google Sheet. It is responsible for finding emails, analyzing them with AI, and saving the results.*

### A. Global Configuration (Lines 1-56)
- **What it does:** Sets up the basic rules of the system. It defines the Google Sheet ID, the names of the tabs (`Leads`, `Filtered_Leads`, `Logs`), and important limits like `MAX_SEARCH_THREADS` (how many emails to check) and `NOISE_KEYWORDS` (words like "tcs", "wipro" that indicate spam/unwanted companies).
- **Why it matters:** This acts as the control center. If you ever want to change the AI model or add a new spam keyword, you do it here.

### B. UI Menus & Setup (Lines 58-230)
- **`onOpen()`**: Creates the custom "CRM-V2" dropdown menu at the top of your Google Sheet so you can manually trigger scripts.
- **`initializeCRM()`**: The "Setup Button". If you install this on a blank sheet, this function creates all the necessary tabs, formats the headers with colors, and sets the column widths automatically.
- **`showStats()`**: Scans the sheet and pops up an alert showing how many leads you have, your highest score, and how many unique companies are stored.

### C. The Main Loop: `fetchAndQualifyLeads()` (Lines 310-471)
*This is the heart of the system.*
1. **Load Existing Data**: It first looks at the spreadsheet to see which `Message IDs` and `Company Signatures` already exist so it doesn't process them twice.
2. **Search Gmail**: It searches your Gmail for threads matching high-value keywords like `(innovation OR R&D OR patent)`.
3. **Filter Senders**: It checks if the person who sent the email is in your `ALLOWED_SENDERS` list.
4. **Fast Skip**: It creates a quick "fingerprint" of the email. If it's seen this exact email text before, it skips it instantly to save time and API costs.
5. **Ask Mistral AI**: It sends the email text to the AI (Mistral).
6. **Validation & Filtering**: Once the AI returns a list of leads, the script checks if the data is complete. If the company name contains a "noise keyword" (like a consulting firm), it rejects the lead and moves it to the `Filtered_Leads` sheet.
7. **Save**: If the lead passes all checks, it's appended to the main `Leads` sheet.

### D. AI Integration: `callMistralAI()` (Lines 516-640)
- **`buildPrompt()`**: This tells the AI exactly what to do. It instructs the AI to look for Manufacturing/Pharma companies, look for R&D signals, score them 0-100, and return the data in a strict 14-column JSON format.
- **`callMistralAI()`**: Makes the HTTP request to Mistral's servers. It includes "retry logic"—if Mistral is busy or rate-limits you, the script automatically waits a few seconds and tries again.
- **`parseAIResponse()`**: Takes the AI's raw JSON text and turns it into clean data. It also triggers the Wikipedia lookup here.

### E. Wikipedia Enrichment (Lines 642-726)
- **`fetchWikipediaEnrichment()`**: Takes the company name and asks Wikipedia's API for a summary.
- **`extractFirmographicsFromText()`**: A clever function that reads the Wikipedia summary and uses Regular Expressions (Regex) to pull out the Headquarters location, Industry, and Employee count.
- **Caching**: To prevent hitting Wikipedia too often, it saves (caches) the result for 24 hours.

---

## 2. `server.js` - The Node.js Dashboard Backend
*This code runs on a cloud server (like Render or VPS). It serves the beautiful dashboard to users and securely pulls data from Google Sheets to show on the web.*

### A. Setup & Dependencies (Lines 1-31)
- **What it does:** Imports necessary tools like `express` (for the web server), `axios` (for making HTTP requests), and `googleapis` (to talk to Google Sheets).
- **Config**: Pulls sensitive data from the `.env` file, like your `BREVO_API_KEY` (for sending OTP emails) and the list of `ALLOWED_EMAILS`.

### B. Authentication System (Lines 33-144)
*Spirelia uses a passwordless OTP (One Time Password) system.*
- **`requireAuth` Middleware**: A security checkpoint. Before letting anyone see the leads, it checks if they have a valid, unexpired session token in their browser.
- **`sendOtpEmail()`**: Designs a beautiful HTML email containing a 6-digit code and sends it via Brevo's API.
- **`/api/send-otp`**: When a user types their email on the login page, this route checks if the email is in the `ALLOWED_EMAILS` list. If yes, it generates a random 6-digit code, saves it in server memory (`otpStore`), and emails it.
- **`/api/verify-otp`**: When the user enters the code, this route checks if it matches the code in memory. It prevents brute-forcing by locking out after 5 failed attempts. If successful, it generates a secure session token valid for 24 hours.

### C. Data Bridge (Lines 158-186)
- **`/api/leads`**: This is the route the dashboard calls to get the data.
- **Google Sheets API**: It uses a secure `service-account.json` file to authenticate with Google. It then asks Google Sheets for all data in the range `Leads!A1:O`.
- **Formatting**: It takes the raw rows from Google Sheets, maps them to the header names (like `Company`, `Score`, `Wikipedia Link`), and sends them down to the browser as clean JSON data.

### D. Server Startup (Lines 188-192)
- **`app.listen()`**: Tells the Express server to turn on, listen on port 3000 (or whatever the cloud provider assigns), and prints a success message to the console showing which emails are currently allowed to log in.

---

## Summary of How They Work Together
1. **`Code.gs`** runs in the background silently. It does the heavy lifting of reading emails, paying for AI processing, doing web scraping (Wikipedia), and structuring data into Google Sheets.
2. **`server.js`** is the secure gateway. It doesn't do any heavy processing; it simply locks the front door with OTPs and hands the clean Google Sheet data to the user's web browser when requested.
