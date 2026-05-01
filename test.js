import { google } from 'googleapis';

const SHEET_ID = "1VJtX69Wn4lDryad8L6NkpMylnlys_tPJqYn-b2Oa_aI";
const SERVICE_ACCOUNT = 'service-account.json';

/**
 * 🚀 Spirelia Raw Data Tester
 * Standalone script to verify the full 14-column sheet content.
 */
async function testSheetFetch() {
    console.log("\n📡 Fetching RAW Spirelia Intelligence...");
    
    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT,
        scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    try {
        const res = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Leads!A1:N', // ✅ Fetches all 14 columns including headers
        });

        const rows = res.data.values || [];
        if (rows.length === 0) {
            console.log("📭 Sheet is empty.");
            return;
        }

        console.log(`✅ Success! Found ${rows.length - 1} leads (+ headers).\n`);
        
        // 📊 Display full raw data in a table
        console.table(rows.slice(0, 10)); 
        
        console.log("\n🧠 Fit Reason Verification (Column N):");
        rows.slice(1, 6).forEach((row) => {
            if (row[1]) console.log(`➤ ${row[1]}: ${row[13] || 'N/A'}`);
        });

    } catch (err) {
        console.error("❌ Fetch Failed:", err.message);
    }
}

testSheetFetch();
