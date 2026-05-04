# Spirelia AI CRM — Client Setup Guide

This guide details the exact step-by-step process to deploy the completely decoupled Spirelia AI CRM into your client's environment. The CRM is split into three parts:
1. **Google Apps Script (`Code.gs`)** - The AI Engine running in the client's Google Account.
2. **Node.js Backend (`crm_back`)** - The secure API Server.
3. **Static Frontend (`crm_front`)** - The dashboard User Interface.

---

## STEP 1: Set Up the Client's Google Account (The AI Engine)

We need to install the AI email-scanning script in the client's Google Workspace.

### 1A. Create the Google Sheet
1. Log into the client's Google account.
2. Open Google Sheets and create a new blank spreadsheet named **"Spirelia CRM Master"**.
3. Look at the URL and copy the **Sheet ID** (the long string of letters and numbers between `/d/` and `/edit`).

### 1B. Install the Script
1. In the Google Sheet, go to **Extensions** > **Apps Script**.
2. Delete any default code in the editor.
3. Open your local `CRM-V2/Code.gs` file, copy all the code, and paste it into the Apps Script editor.
4. At the very top of the code, find `var SHEET_ID = ...` and replace the ID with the client's new Sheet ID.
5. Click the **Save** (floppy disk) icon.

### 1C. Initialize the System
1. Go back to the Google Sheet tab and refresh the page.
2. A new custom menu called **CRM-V2** will appear at the top.
3. Click **CRM-V2** > **Initialize CRM**.
   - *Note: Google will ask you to authorize the script. Click "Continue", choose the client's account, click "Advanced", and click "Go to script". Allow all permissions.*
4. This will automatically set up the `Leads`, `Filtered_Leads`, and `Logs` sheets with the correct styling.

### 1D. Add Mistral AI Key
1. Click **CRM-V2** > **Setup Mistral Key**.
2. Paste the Mistral AI API key and hit OK.

### 1E. Set the Automation Trigger
1. In the Apps Script editor, click the **Triggers (clock icon)** on the left sidebar.
2. Click **+ Add Trigger** (bottom right).
3. Set it up as follows:
   - **Function to run:** `fetchAndQualifyLeads`
   - **Event source:** `Time-driven`
   - **Type of time based trigger:** `Hour timer`
   - **Hour interval:** `Every 4 hours` (or whatever interval the client prefers).
4. Save the trigger. The AI will now scan the client's inbox autonomously!


api MISTRAL_API_KEY RIJtdilUE1qIa27JtSzbzgTqZDvniQQz

---

## STEP 2: Deploy the Backend Server (`crm_back`)

This is the API that connects the Google Sheet to the web dashboard and handles OTP login.

### 2A. Get a Google Service Account JSON
Because the backend needs to read the client's Google Sheet, it needs authorization.
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project and enable the **Google Sheets API**.
3. Go to **Credentials** > **Create Credentials** > **Service Account**.
4. Create the account, then go to the "Keys" tab, and click **Add Key** > **Create new key** (JSON format).
5. Download the JSON file and rename it exactly to `service-account.json`.
6. **CRITICAL STEP:** Open `service-account.json`, copy the `client_email` address, go to the client's Google Sheet, and **Share** the sheet with that email address (give it Editor access).
7. Place this `service-account.json` file inside your local `crm_back` folder.

### 2B. Push to Render (or Heroku)
1. Go to [Render.com](https://render.com/) and create a new **Web Service**.
2. Connect your `crm_back` GitHub repository.
3. Use the following build settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start` (or `node server.js`)

### 2C. Set Environment Variables
In the Render dashboard for the web service, go to **Environment** and add:
- `BREVO_API_KEY`: Your Brevo API key for sending login OTPs.
- `BREVO_SENDER`: The email address sending the OTPs (e.g., `admin@yourcompany.com`).
- `ALLOWED_EMAILS`: The client's email addresses separated by commas (e.g., `client1@gmail.com,client2@gmail.com`). Only these emails will be allowed to log in.
- `JWT_SECRET`: A long random string of text (e.g., `spirelia-secure-secret-2026`).

---

## STEP 3: Deploy the Frontend Dashboard (`crm_front`)

This is the beautiful user interface where the client will actually view their leads.

### 3A. Update the API URL
1. Once Render finishes deploying your backend (from Step 2), copy the new backend URL (e.g., `https://client-backend.onrender.com`).
2. In your local `crm_front` folder, open `index.html` and `login.html`.
3. Search for the old backend URL (`https://crm-back-x4c6.onrender.com`) and replace it everywhere with the new backend URL.
4. Commit and push these changes to your `crm_front` GitHub repository.

### 3B. Host the Frontend
1. Go to [Netlify](https://www.netlify.com/) or [Vercel](https://vercel.com/).
2. Add a new site and connect your `crm_front` GitHub repository.
3. Deploy it as a static site (no build command needed).
4. Once deployed, Netlify/Vercel will give you a public URL for the dashboard.

### 3C. Handover
Give the client the Netlify/Vercel URL. They can enter their email (which you whitelisted in the `ALLOWED_EMAILS` variable), receive their OTP, and instantly see the leads flowing in!
