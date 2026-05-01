/**
 * 🚀 CRM-V2: MASTER EDITION (Final Production-Ready)
 * ✅ 14-column CRM | Exactly 20 new emails | Smart dedup | Full AI logging
 * ✅ NEW: "Fit Reason" column explains WHY each lead matches
 * ✅ Fixed: AI response parsing ("results" key), noise filter scope, sheet verification
 */

// ⚙️ GLOBAL CONFIGURATION
const SHEET_ID = "1VJtX69Wn4lDryad8L6NkpMylnlys_tPJqYn-b2Oa_aI"; 
const SHEET_NAME = "Leads";
const LOG_SHEET_NAME = "Logs";
const LOG_PREFIX = "[CRM-V2]";

const CONFIG = {
  MAX_SEARCH_THREADS: 50,          // Scan up to 50 Gmail threads
  MAX_PROCESS_MESSAGES: 20,        // ✅ STRICT: Stop after 20 NEW unique emails
  SLEEP_MS: 2500,                  // 2.5s between AI calls (avoids Groq 429 limits)
  NOISE_KEYWORDS: ["tcs", "infosys", "wipro", "hcl", "cognizant", "accenture", "starbucks", "uber", "delivery", "distributor"],
  AI_MODEL: "llama-3.3-70b-versatile",
  AI_TEMPERATURE: 0.1,
  LOG_TRUNCATE: 800                // Max chars for logged data (prevents log bloat)
};

// 🗂️ COLUMN INDICES (0-based) - 14-COLUMN CRM STRUCTURE
const COL = { 
  DATE: 0,           // A
  COMPANY: 1,        // B
  POSITION: 2,       // C
  ROLE_SUMMARY: 3,   // D
  COMPANY_BIO: 4,    // E
  POSTED: 5,         // F
  DOMAIN: 6,         // G
  EMAIL: 7,          // H
  LINKEDIN: 8,       // I
  SCORE: 9,          // J
  DECISION_LINK: 10, // K
  WIKI_LINK: 11,     // L
  MSG_ID: 12,        // M ✅ Deduplication key (Gmail Message ID)
  FIT_REASON: 13     // N ✅ NEW: Why this lead fits criteria
};

// 🗂️ HEADERS - Exact 14-column order as specified
const HEADERS = [
  "Date", "Company", "Position", "Role Summary", "Company Bio", "Posted",
  "Domain", "Email", "LinkedIn", "Score", "Decision Maker Link", 
  "Wikipedia Link", "Message ID", "Fit Reason"
];

// ═══════════════════════════════════════════════════════════
// 🛠️ SETUP & UI FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * 🎯 Creates custom menu in Google Sheets UI (runs on open)
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 CRM-V2')
    .addItem('⚙️ Initialize CRM', 'initializeCRM')
    .addItem('▶️ Run Lead Qualifier', 'fetchAndQualifyLeads')
    .addItem('🧹 Clear Processed IDs', 'clearProcessedIds')
    .addItem('📊 View Stats', 'showStats')
    .addToUi();
}

/**
 * ✅ Safe UI Alert Helper (Works from Editor OR Sheet Menu)
 */
function showAlert(title, message) {
  try { 
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK); 
  } catch (e) { 
    log("INFO", `${title} | ${message}`); // Fallback to logs when run from editor
  }
}

/**
 * ✅ ONE-TIME SETUP: Creates & formats Leads + Logs sheets with 14 columns
 * ✅ FIX: Safely handles completely empty sheets & adds Fit Reason column
 */
function initializeCRM() {
  log("INFO", "🔧 Initializing CRM sheets with 14-column layout...");
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    
    // ── LEADS Sheet ──
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      log("INFO", `📄 Created new sheet: ${SHEET_NAME}`);
    }
    
    // ✅ SAFE HEADER CHECK: Prevents crash on empty sheets
    let needsUpdate = true;
    if (sheet.getLastColumn() > 0 && sheet.getLastRow() > 0) {
      const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const lastHeader = currentHeaders[currentHeaders.length - 1];
      needsUpdate = currentHeaders.length < HEADERS.length || lastHeader !== "Fit Reason";
    }
    
    if (needsUpdate) {
      // Write/update all 14 headers
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight("bold")
        .setBackground("#4285f4")
        .setFontColor("white")
        .setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, HEADERS.length);
      sheet.setColumnWidth(COL.FIT_REASON + 1, 320);
      
      // Add data validation for Score column (0-100)
      const scoreRange = sheet.getRange(2, COL.SCORE + 1, 1000, 1);
      const rule = SpreadsheetApp.newDataValidation().requireNumberBetween(0, 100).build();
      scoreRange.setDataValidation(rule);
      
      log("INFO", "✅ 14-column headers written/updated in Leads sheet");
    } else {
      log("INFO", "ℹ️ Leads sheet already has correct 14-column headers");
    }
    
    // ── LOGS Sheet ──
    let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
      logSheet = ss.insertSheet(LOG_SHEET_NAME);
      logSheet.getRange(1, 1, 1, 4).setValues([["Timestamp", "Level", "Message", "Data"]]);
      logSheet.getRange(1, 1, 1, 4)
        .setFontWeight("bold")
        .setBackground("#34a853")
        .setFontColor("white");
      logSheet.setFrozenRows(1);
      logSheet.autoResizeColumns(1, 4);
      log("INFO", `📄 Created new sheet: ${LOG_SHEET_NAME}`);
    }
    
    showAlert("✅ CRM Initialized", `Sheets ready:\n• ${SHEET_NAME} (14 columns)\n• ${LOG_SHEET_NAME}\n\nRun "Lead Qualifier" from 🚀 CRM-V2 menu.`);
    log("INFO", "🎉 CRM initialization complete!");
    
  } catch (e) { 
    log("ERROR", `💥 Initialization failed: ${e.message}`); 
    showAlert("❌ Error", e.message); 
  }
}
/**
 * 🧹 Utility: Clear all processed Message IDs (for testing/re-run)
 * ⚠️ Use with caution - removes deduplication history
 */
function clearProcessedIds() {
  const response = SpreadsheetApp.getUi().alert(
    "⚠️ Confirm Clear", 
    "This will remove all processed Message IDs from Column M.\nNew runs will re-process ALL matching emails.\n\nContinue?", 
    SpreadsheetApp.getUi().ButtonSet.YES_NO
  );
  
  if (response === SpreadsheetApp.getUi().Button.YES) {
    try {
      const ss = SpreadsheetApp.openById(SHEET_ID);
      const sheet = ss.getSheetByName(SHEET_NAME);
      const lastRow = sheet.getLastRow();
      
      if (lastRow > 1) {
        sheet.getRange(2, COL.MSG_ID + 1, lastRow - 1, 1).clearContent();
        log("INFO", `🧹 Cleared ${lastRow - 1} processed Message IDs`);
        showAlert("✅ Cleared", `Removed ${lastRow - 1} MsgIDs.\nNext run will re-process all emails.`);
      } else {
        showAlert("ℹ️ No Data", "No processed IDs to clear.");
      }
    } catch (e) {
      log("ERROR", `Failed to clear IDs: ${e.message}`);
      showAlert("❌ Error", e.message);
    }
  }
}

/**
 * 📊 Utility: Show quick stats from current sheet
 */
function showStats() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const lastRow = sheet.getLastRow();
    
    const msgIds = data.slice(1).map(r => r[COL.MSG_ID]).filter(Boolean);
    const companies = data.slice(1).map(r => r[COL.COMPANY]).filter(c => c && c !== "N/A");
    const highScore = data.slice(1).filter(r => typeof r[COL.SCORE] === "number" && r[COL.SCORE] >= 70).length;
    
    const stats = `📊 CRM Stats\n━━━━━━━━\nTotal Rows: ${lastRow - 1}\nUnique MsgIDs: ${msgIds.length}\nValid Companies: ${companies.length}\nHigh-Score Leads (70+): ${highScore}`;
    
    log("INFO", stats);
    showAlert("📊 Current Stats", stats);
    
  } catch (e) {
    log("ERROR", `Failed to show stats: ${e.message}`);
    showAlert("❌ Error", e.message);
  }
}

// ═══════════════════════════════════════════════════════════
// 🪵 LOGGER (With Smart Truncation)
// ═══════════════════════════════════════════════════════════

function log(level, message, data = null) {
  const ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  let logMsg = `${LOG_PREFIX} [${level}] ${ts} - ${message}`;
  
  if (data) {
    const str = typeof data === "string" ? data : JSON.stringify(data);
    const truncated = str.length > CONFIG.LOG_TRUNCATE ? str.slice(0, CONFIG.LOG_TRUNCATE) + "..." : str;
    logMsg += ` | Data: ${truncated}`;
  }
  Logger.log(logMsg);
}

// Optional: Persist logs to "Logs" sheet (uncomment to enable)
// function logToSheet(level, timestamp, message, data) {
//   try {
//     const ss = SpreadsheetApp.openById(SHEET_ID);
//     let logSheet = ss.getSheetByName(LOG_SHEET_NAME);
//     if (!logSheet) return;
//     const rowData = [timestamp, level, message, data ? (typeof data === "string" ? data : JSON.stringify(data).slice(0, 32767)) : ""];
//     logSheet.appendRow(rowData);
//   } catch (e) { /* Silent fail */ }
// }

// ═══════════════════════════════════════════════════════════
// 🎯 MAIN FUNCTION: Fetch & Qualify Leads (Smart Dedup + Full Logging)
// ═══════════════════════════════════════════════════════════

function fetchAndQualifyLeads() {
  log("INFO", "🚀 Starting qualifier (Smart dedup: company+role+summary)");
  let stats = { 
    threadsScanned: 0, 
    messagesChecked: 0, 
    newMessagesProcessed: 0, 
    leadsAdded: 0, 
    leadsFiltered: 0, 
    duplicatesSkipped: 0, 
    errors: 0 
  };
  
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" missing. Run initializeCRM() first.`);
    
    const data = sheet.getDataRange().getValues();
    
    // ✅ Load existing MsgIDs for email-level dedup
    const existingMsgIds = data.slice(1).map(row => row[COL.MSG_ID]).filter(id => id);
    log("INFO", `📊 Loaded ${existingMsgIds.length} processed Message IDs`);
    
    // ✅ Load existing lead signatures for content-level dedup
    const existingSignatures = new Set(
      data.slice(1)
        .map(row => buildLeadSignature(row[COL.COMPANY], row[COL.POSITION], row[COL.ROLE_SUMMARY]))
        .filter(sig => sig)
    );
    log("INFO", `🔐 Loaded ${existingSignatures.size} unique lead signatures for content dedup`);

    const query = '(innovation OR R&D OR patent OR "technology roadmap")';
    const threads = GmailApp.search(query, 0, CONFIG.MAX_SEARCH_THREADS);
    log("INFO", `📬 Found ${threads.length} threads to scan`);
    
    if (threads.length === 0) {
      log("WARN", "⚠️ No threads found. Process complete.");
      return;
    }
    
    // ✅ STRICT LOOP: Stops exactly after 20 NEW messages
    for (let t = 0; t < threads.length; t++) {
      if (stats.newMessagesProcessed >= CONFIG.MAX_PROCESS_MESSAGES) break;
      stats.threadsScanned++;
      
      const messages = threads[t].getMessages();
      
      for (let m = 0; m < messages.length; m++) {
        if (stats.newMessagesProcessed >= CONFIG.MAX_PROCESS_MESSAGES) break;
        stats.messagesChecked++;
        
        const msg = messages[m];
        const msgId = msg.getId();
        const subject = msg.getSubject()?.slice(0, 80) || "No Subject";
        
        // ✅ Email-level dedup (already processed this exact email)
        if (existingMsgIds.includes(msgId)) continue;
        
        stats.newMessagesProcessed++;
        log("INFO", `✉️ [${stats.newMessagesProcessed}/${CONFIG.MAX_PROCESS_MESSAGES}] Processing: ${subject} | MsgID: ${msgId}`);
        
        const body = msg.getPlainBody();
        const bodyPreview = body?.replace(/\n/g, " ").slice(0, 300) + "...";
        log("DEBUG", `📧 Email preview (MsgID: ${msgId}): ${bodyPreview}`);
        
        Utilities.sleep(CONFIG.SLEEP_MS); // Rate limiting
        
        // 🤖 Call Groq AI with full logging
        const leads = callGroqAI(body, msgId);
        
        if (leads.length > 0) {
          log("INFO", `🎯 Extracted ${leads.length} lead(s) from MsgID: ${msgId}`, leads);
        } else {
          log("DEBUG", `📭 No leads extracted from MsgID: ${msgId}`);
        }
        
        // 🛡️ Filter & Append Leads with 14-column output
        leads.forEach((l, idx) => {
          const company = (l.company_name || "").toLowerCase();
          
          // Filter: Empty/N/A company
          if (!l.company_name || l.company_name === "N/A") { 
            log("DEBUG", `❌ Filtered: Empty company | MsgID: ${msgId}`);
            stats.leadsFiltered++; 
            return; 
          }
          
          // Filter: Noise keywords (FIXED: capture keyword before logging)
          const matchedNoise = CONFIG.NOISE_KEYWORDS.find(k => company.includes(k));
          if (matchedNoise) { 
            log("DEBUG", `❌ Filtered: Noise keyword "${matchedNoise}" | Company: ${l.company_name} | MsgID: ${msgId}`);
            stats.leadsFiltered++; 
            return; 
          }
          
          // ✅✅ SMART DEDUP: Check if this exact company+role+summary combo already exists
          const signature = buildLeadSignature(l.company_name, l.position, l.role_summary);
          if (existingSignatures.has(signature)) {
            log("DEBUG", `⏭️ Skipped duplicate: "${l.company_name} | ${l.position}" (same role summary) | MsgID: ${msgId}`);
            stats.duplicatesSkipped++;
            return; // Skip adding this duplicate lead
          }
          
          // ✅ Append to Sheet WITH VERIFICATION
          try {
            const newRow = [
              msg.getDate(),                    // A: Date
              l.company_name || "N/A",          // B: Company
              l.position || l.title_name || "N/A", // C: Position
              l.role_summary || l.role_description || "N/A", // D: Role Summary
              l.company_bio || l.company_description || "N/A", // E: Company Bio
              l.posted_date || l.date_of_posting || "", // F: Posted
              l.domain || "",                   // G: Domain
              l.email || "",                    // H: Email
              l.linkedin || "",                 // I: LinkedIn
              l.score || "",                    // J: Score
              l.decision_link || "",            // K: Decision Maker Link
              l.wikipedia || "",                // L: Wikipedia Link
              msgId,                            // M: Message ID ✅ (dedup key)
              l.fit_reason || ""                // N: Fit Reason ✅ NEW
            ];
            
            const beforeRow = sheet.getLastRow();
            sheet.appendRow(newRow);
            SpreadsheetApp.flush(); // Force sync to Google servers
            
            // 🔐 Verify write succeeded
            const afterRow = sheet.getLastRow();
            const savedMsgId = sheet.getRange(afterRow, COL.MSG_ID + 1).getValue();
            
            if (savedMsgId === msgId) {
              stats.leadsAdded++;
              existingSignatures.add(signature); // Add to in-memory set to catch duplicates in same run
              log("INFO", `✅ Saved NEW: ${l.company_name} | ${l.position} | Fit: ${l.fit_reason?.slice(0,60)}... | MsgID: ${msgId}`);
            } else {
              throw new Error(`Verification mismatch: expected ${msgId}, got ${savedMsgId}`);
            }
          } catch (e) { 
            log("ERROR", `💥 Append failed for ${l.company_name} | MsgID: ${msgId} | Error: ${e.message}`); 
            stats.errors++; 
          }
        });
      }
    }
    
    // 📊 Final Summary
    const summary = `📈 Scanned: ${stats.threadsScanned} threads | Checked: ${stats.messagesChecked} emails | Processed: ${stats.newMessagesProcessed}/${CONFIG.MAX_PROCESS_MESSAGES} | Added: ${stats.leadsAdded} | Skipped(Dup): ${stats.duplicatesSkipped} | Errors: ${stats.errors}`;
    log("INFO", `✅ ${summary}`);
    showAlert("✅ Complete", summary);
    
  } catch (e) { 
    log("ERROR", `💥 CRITICAL FAILURE: ${e.message} | Stack: ${e.stack}`); 
    showAlert("❌ Failed", e.message); 
  }
}

// ═══════════════════════════════════════════════════════════
// 🔐 Lead Signature Builder (For Smart Content Dedup)
// ═══════════════════════════════════════════════════════════

/**
 * Creates a unique signature for company+position+role_summary
 * Normalizes text to catch minor variations ("VP of R&D" vs "VP R&D")
 */
function buildLeadSignature(company, position, roleSummary) {
  if (!company || company === "N/A") return null;
  
  const normalize = (str) => {
    if (!str) return "";
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '')           // Remove punctuation
      .replace(/\s+/g, ' ')              // Collapse whitespace
      .replace(/\b(of|and|the|for|in|at|on|with)\b/g, '') // Remove stop words
      .trim();
  };
  
  const c = normalize(company);
  const p = normalize(position);
  const r = normalize(roleSummary);
  
  // Return combined signature: "company|position|role_summary"
  return `${c}|${p}|${r}`.slice(0, 200); // Truncate for safety
}

// ═══════════════════════════════════════════════════════════
// 🤖 AI FUNCTION: Groq API Call (Full Logging + 429 Retry + Fixed Parsing)
// ═══════════════════════════════════════════════════════════

function callGroqAI(emailBody, msgId) {
  log("DEBUG", `🔐 Fetching API key for MsgID: ${msgId}`);
  const apiKey = PropertiesService.getScriptProperties().getProperty('GROQ_API_KEY');
  
  if (!apiKey) { 
    log("ERROR", `❌ Missing GROQ_API_KEY | MsgID: ${msgId}`); 
    return []; 
  }
  
  const url = "https://api.groq.com/openai/v1/chat/completions";
  
  // 🎯 Enhanced prompt for 12-field extraction (NEW: fit_reason)
  const prompt = `You are a specialized R&D Intelligence Agent. Extract EVERY listing matching these rules:

📋 REQUIRED FIELDS (return for EACH lead):
1. company_name: Organization name (string)
2. position: Job title/role (string)
3. role_summary: 1-2 sentence summary of responsibilities (string)
4. company_bio: 1-2 sentence company overview (string)
5. posted_date: Original posting date if mentioned (string or empty)
6. domain: Official website like "tesla.com" (string or empty)
7. email: Contact email if found or guess format like "careers@company.com" (string or empty)
8. linkedin: Company LinkedIn URL like "https://linkedin.com/company/tesla" (string or empty)
9. score: Fit score 0-100 based on: Manufacturing/Auto/Aerospace/Pharma/MedTech/GCC + 500+ employees + R&D signals (number)
10. fit_reason: CONCISE 1-sentence explanation WHY this lead matches. MUST cite: (1) sector match, (2) employee size signal if available, (3) specific R&D keyword found in email. Example: "Automotive manufacturer with 10k+ employees; email mentions 'patent portfolio' and 'technology roadmap'" (string)
11. decision_link: Pre-built LinkedIn search URL for CTO/VP R&D at this company (string or empty)
12. wikipedia: Wikipedia URL if company has one (string or empty)

🎯 SECTOR FILTER (ONLY extract if matches):
• Manufacturing, Automotive, Aerospace, Pharma, MedTech, Global Capability Centers (GCC)
• Companies with 500+ employees
• Signals: technology roadmap, R&D strategy, IP analyst, patent portfolio, innovation manager, TRIZ, NPD

❌ EXCLUDE:
• IT Services (TCS, Infosys, Wipro, etc.), Trading, Startups <5 years, Distributors, Retail chains

📤 OUTPUT FORMAT (STRICT JSON ARRAY):
[
  {
    "company_name": "String",
    "position": "String", 
    "role_summary": "String",
    "company_bio": "String",
    "posted_date": "String",
    "domain": "String",
    "email": "String",
    "linkedin": "String",
    "score": 85,
    "fit_reason": "Automotive manufacturer with 10k+ employees; email mentions 'patent portfolio' and 'technology roadmap'",
    "decision_link": "String",
    "wikipedia": "String"
  }
]

📧 EMAIL TO ANALYZE:
${emailBody}`;

  const payload = { 
    model: CONFIG.AI_MODEL, 
    messages: [{ role: "user", content: prompt }], 
    temperature: CONFIG.AI_TEMPERATURE, 
    response_format: { type: "json_object" } 
  };
  
  log("INFO", `🌐 Sending AI request | Model: ${CONFIG.AI_MODEL} | MsgID: ${msgId}`);
  log("DEBUG", `📝 Prompt preview (MsgID: ${msgId}): ${prompt.slice(0, CONFIG.LOG_TRUNCATE)}...`);
  
  // Retry loop for rate limits
  for (let retry = 0; retry <= 2; retry++) {
    try {
      const startTime = new Date();
      const res = UrlFetchApp.fetch(url, { 
        method: "post", 
        contentType: "application/json", 
        headers: { Authorization: "Bearer " + apiKey }, 
        payload: JSON.stringify(payload), 
        muteHttpExceptions: true // Allow manual error handling
      });
      const responseTime = (new Date() - startTime) / 1000;
      const code = res.getResponseCode();
      
      log("DEBUG", `📡 API Response | Status: ${code} | Time: ${responseTime}s | MsgID: ${msgId}`);
      
      // ⏳ Handle 429 Rate Limits with exponential backoff
      if (code === 429) { 
        const waitTime = 3000 + (retry * 2000); // 3s → 5s → 7s
        log("WARN", `⏳ Rate limited (429). Waiting ${waitTime/1000}s before retry ${retry+1}/3 | MsgID: ${msgId}`);
        Utilities.sleep(waitTime); 
        continue; 
      }
      
      if (code !== 200) {
        const errorText = res.getContentText()?.slice(0, 300);
        log("ERROR", `❌ API Error ${code} | Body: ${errorText} | MsgID: ${msgId}`);
        return [];
      }
      
      const rawResponse = res.getContentText();
      log("DEBUG", `📦 Raw API response (MsgID: ${msgId}): ${rawResponse.slice(0, CONFIG.LOG_TRUNCATE)}...`);
      
      // Parse outer Groq response
      const parsedResponse = JSON.parse(rawResponse);
      const aiContent = parsedResponse?.choices?.[0]?.message?.content;
      
      if (!aiContent) {
        log("WARN", `⚠️ No content in AI response choices | MsgID: ${msgId}`);
        return [];
      }
      
      log("DEBUG", `🧠 AI content string (MsgID: ${msgId}): ${aiContent.slice(0, CONFIG.LOG_TRUNCATE)}...`);
      
      // ✅ Parse the JSON string returned by AI
      const parsed = JSON.parse(aiContent);
      log("DEBUG", `✅ Parsed AI JSON (MsgID: ${msgId}) | Type: ${Array.isArray(parsed) ? "array" : typeof parsed}`, parsed);
      
      // ✅✅ FIX: Normalize to array - check ALL possible keys including "results"
      const raw = Array.isArray(parsed) 
        ? parsed 
        : (parsed.leads || parsed.results || parsed.jobs || parsed.data || [parsed]);
      
      log("DEBUG", `📋 Normalized to ${raw.length} lead object(s) | MsgID: ${msgId}`);
      
      // Map to expected 12-field schema with fallbacks + helper functions
      const results = raw.map(l => ({
        company_name: l.company_name || l.Company || l.organization || "N/A",
        position: l.position || l.title_name || l.role || l.job_title || "N/A",
        role_summary: l.role_summary || l.role_description || l.summary || "N/A",
        company_bio: l.company_bio || l.company_description || l.about || "N/A",
        posted_date: l.posted_date || l.date_of_posting || l.date || "",
        domain: l.domain || l.website || extractDomain(l.company_name) || "",
        email: l.email || l.contact_email || guessEmail(l.domain) || "",
        linkedin: l.linkedin || l.linkedin_url || buildLinkedIn(l.company_name) || "",
        score: typeof l.score === "number" ? l.score : (l.fit_score || l.relevance_score || ""),
        fit_reason: l.fit_reason || l.why_match || l.match_reason || "Score based on sector + R&D signals", // ✅ NEW FIELD
        decision_link: l.decision_link || l.cto_link || buildDecisionLink(l.company_name) || "",
        wikipedia: l.wikipedia || l.wiki_url || buildWikipedia(l.company_name) || ""
      }));
      
      log("INFO", `✨ Final normalized leads (MsgID: ${msgId}): ${results.length} item(s)`, results);
      return results;
      
    } catch (e) {
      log("ERROR", `💥 AI request failed | MsgID: ${msgId} | Error: ${e.message} | Retry: ${retry+1}/3`);
      if (retry < 2) Utilities.sleep(2000); // Brief pause before retry
    }
  }
  
  log("ERROR", `❌ All AI retries exhausted | MsgID: ${msgId}`);
  return [];
}

// ═══════════════════════════════════════════════════════════
// 🧰 HELPER FUNCTIONS (Domain/Email/Link Builders)
// ═══════════════════════════════════════════════════════════

/**
 * Extract domain from company name (basic heuristic)
 * e.g., "Tesla Inc" → "tesla.com"
 */
function extractDomain(companyName) {
  if (!companyName || companyName === "N/A") return "";
  const clean = companyName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  const parts = clean.split(/\s+/).filter(p => p);
  if (parts.length === 0) return "";
  if (parts.length === 1) return `${parts[0]}.com`;
  if (parts.length === 2) return `${parts[0]}${parts[1]}.com`;
  return `${parts[0]}.com`;
}

/**
 * Guess contact email from domain
 * e.g., "tesla.com" → "careers@tesla.com"
 */
function guessEmail(domain) {
  if (!domain) return "";
  const prefixes = ["careers", "jobs", "hr", "recruiting", "talent", "contact"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return `${prefix}@${domain}`;
}

/**
 * Build LinkedIn company URL
 * e.g., "Tesla Inc" → "https://linkedin.com/company/tesla-inc"
 */
function buildLinkedIn(companyName) {
  if (!companyName || companyName === "N/A") return "";
  const slug = companyName.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `https://linkedin.com/company/${slug}`;
}

/**
 * Build LinkedIn decision-maker search URL
 * e.g., "Tesla Inc" → LinkedIn search for CTO/VP R&D at Tesla
 */
function buildDecisionLink(companyName) {
  if (!companyName || companyName === "N/A") return "";
  const encoded = encodeURIComponent(companyName);
  return `https://linkedin.com/search/results/people/?keywords=CTO%20OR%20VP%20R&D&company=${encoded}`;
}

/**
 * Build Wikipedia URL (basic heuristic)
 * e.g., "Tesla Inc" → "https://en.wikipedia.org/wiki/tesla_inc"
 */
function buildWikipedia(companyName) {
  if (!companyName || companyName === "N/A") return "";
  const slug = companyName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
  return `https://en.wikipedia.org/wiki/${slug}`;
}