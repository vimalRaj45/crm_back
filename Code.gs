// CRM-V2: Master Edition - Production Ready + Filtered Leads Audit
// ✅ Mistral AI Integration (Single Key)
// ✅ Filtered leads stored in "Filtered_Leads" sheet with reason
// ✅ Wikipedia Disambiguation Fix + Verified URLs Only
// ✅ Lead Validation + Expanded Noise Keywords
// ✅ 14-column CRM, Smart Dedup, AI Logging, fit_reason

// ═══════════════════════════════════════════════════════════
// GLOBAL CONFIGURATION
// ═══════════════════════════════════════════════════════════

var SHEET_ID = "1VJtX69Wn4lDryad8L6NkpMylnlys_tPJqYn-b2Oa_aI";
var SHEET_NAME = "Leads";
var FILTERED_SHEET_NAME = "Filtered_Leads"; // ✅ NEW: Track rejected leads
var LOG_SHEET_NAME = "Logs";
var LOG_PREFIX = "[CRM-V2]";

var CONFIG = {
  MAX_SEARCH_THREADS: 200,
  MAX_PROCESS_MESSAGES: 200,
  SLEEP_MS: 2500,
  NOISE_KEYWORDS: [
    "tcs", "infosys", "wipro", "hcl", "cognizant", "accenture", 
    "starbucks", "uber", "delivery", "distributor",
    "law firm", "legal services", "ip consulting", "patent attorney",
    "consulting firm", "advisory", "recruitment", "staffing",
    "outsourcing", "bpo", "kpo", "it services"
  ],
  AI_MODEL: "mistral-large-latest",
  AI_TEMPERATURE: 0.1,
  LOG_TRUNCATE: 800,
  ALLOWED_SENDERS: ["vimalraj5207@gmail.com","muralidharanl@gmail.com"],
  WIKIPEDIA_ENABLED: true,
  WIKIPEDIA_CACHE_HOURS: 24,
  WIKIPEDIA_SLEEP_MS: 200,
  API_TIMEOUT_MS: 30000,
  MAX_API_RETRIES: 3
};

// COLUMN INDICES (0-based) - 15 COLUMNS for Leads sheet
var COL = {
  DATE: 0, COMPANY: 1, POSITION: 2, ROLE_SUMMARY: 3, COMPANY_BIO: 4,
  POSTED: 5, DOMAIN: 6, EMAIL: 7, LINKEDIN: 8, SCORE: 9,
  DECISION_LINK: 10, WIKI_LINK: 11, MSG_ID: 12, FIT_REASON: 13, OUTREACH_MSG: 14
};

// HEADERS for Leads sheet (15 columns)
var HEADERS = [
  "Date", "Company", "Position", "Role Summary", "Company Bio", "Posted",
  "Domain", "Email", "LinkedIn", "Score", "Decision Maker Link",
  "Wikipedia Link", "Message ID", "Fit Reason", "Outreach Msg"
];

// ✅ HEADERS for Filtered_Leads sheet (14 cols + Filter_Reason)
var FILTERED_HEADERS = HEADERS.concat(["Filter_Reason", "Filtered_At"]);

// ═══════════════════════════════════════════════════════════
// SETUP & UI FUNCTIONS
// ═══════════════════════════════════════════════════════════

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('CRM-V2')
    .addItem('Initialize CRM', 'initializeCRM')
    .addItem('Run Lead Qualifier', 'fetchAndQualifyLeads')
    .addItem('Clear Processed IDs', 'clearProcessedIds')
    .addItem('View Stats', 'showStats')
    .addItem('Setup Mistral Key', 'setupMistralKey')
    .addItem('Review Filtered Leads', 'openFilteredSheet')
    .addToUi();
}

function showAlert(title, message) {
  try { 
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK); 
  } catch (e) { 
    log("INFO", title + " | " + message);
  }
}

function openFilteredSheet() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(FILTERED_SHEET_NAME);
    if (sheet) {
      sheet.activate();
      showAlert("Opened", "Showing Filtered_Leads sheet for review.");
    } else {
      showAlert("Not Found", "No Filtered_Leads sheet yet. Run Lead Qualifier first.");
    }
  } catch (e) {
    log("ERROR", "Failed to open filtered sheet: " + e.message);
    showAlert("Error", e.message);
  }
}

function initializeCRM() {
  log("INFO", "Initializing CRM sheets with filtered leads tracking...");
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    
    // ✅ Initialize MAIN Leads sheet
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    
    var needsUpdate = true;
    if (sheet.getLastColumn() > 0 && sheet.getLastRow() > 0) {
      var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      needsUpdate = currentHeaders.length < HEADERS.length || currentHeaders[currentHeaders.length - 1] !== "Outreach Msg";
    }
    if (needsUpdate) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight("bold").setBackground("#4285f4").setFontColor("white")
        .setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, HEADERS.length);
      sheet.setColumnWidth(COL.FIT_REASON + 1, 320);
      sheet.setColumnWidth(COL.OUTREACH_MSG + 1, 400);
      var scoreRange = sheet.getRange(2, COL.SCORE + 1, 1000, 1);
      var rule = SpreadsheetApp.newDataValidation().requireNumberBetween(0, 100).build();
      scoreRange.setDataValidation(rule);
      log("INFO", "Leads sheet headers updated");
    }
    
    // ✅ Initialize FILTERED_Leads sheet (NEW)
    var filteredSheet = ss.getSheetByName(FILTERED_SHEET_NAME);
    if (!filteredSheet) {
      filteredSheet = ss.insertSheet(FILTERED_SHEET_NAME);
      log("INFO", "Created new sheet: " + FILTERED_SHEET_NAME);
    }
    var fNeedsUpdate = true;
    if (filteredSheet.getLastColumn() > 0 && filteredSheet.getLastRow() > 0) {
      var fHeaders = filteredSheet.getRange(1, 1, 1, filteredSheet.getLastColumn()).getValues()[0];
      fNeedsUpdate = fHeaders.length < FILTERED_HEADERS.length || fHeaders[fHeaders.length - 1] !== "Filtered_At";
    }
    if (fNeedsUpdate) {
      filteredSheet.getRange(1, 1, 1, FILTERED_HEADERS.length).setValues([FILTERED_HEADERS]);
      filteredSheet.getRange(1, 1, 1, FILTERED_HEADERS.length)
        .setFontWeight("bold").setBackground("#ea4335").setFontColor("white")
        .setHorizontalAlignment("center");
      filteredSheet.setFrozenRows(1);
      filteredSheet.autoResizeColumns(1, FILTERED_HEADERS.length);
      filteredSheet.setColumnWidth(15, 250); // Filter_Reason column
      filteredSheet.setColumnWidth(16, 180); // Filtered_At column
      log("INFO", "Filtered_Leads sheet headers created");
    }
    
    // ✅ Initialize Logs sheet
    var logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
      logSheet = ss.insertSheet(LOG_SHEET_NAME);
      logSheet.getRange(1, 1, 1, 4).setValues([["Timestamp", "Level", "Message", "Data"]]);
      logSheet.getRange(1, 1, 1, 4).setFontWeight("bold").setBackground("#34a853").setFontColor("white");
      logSheet.setFrozenRows(1);
      logSheet.autoResizeColumns(1, 4);
    }
    
    showAlert("CRM Initialized", "Sheets ready:\n- " + SHEET_NAME + " (qualified leads)\n- " + FILTERED_SHEET_NAME + " (rejected leads)\n- " + LOG_SHEET_NAME + "\n\nRun 'Lead Qualifier' to start.");
    log("INFO", "CRM initialization complete!");
    
  } catch (e) { 
    log("ERROR", "Initialization failed: " + e.message); 
    showAlert("Error", e.message); 
  }
}

function clearProcessedIds() {
  var response = SpreadsheetApp.getUi().alert(
    "Confirm Clear", 
    "This will remove all processed Message IDs from Column M.\nNew runs will re-process ALL matching emails.\n\nContinue?", 
    SpreadsheetApp.getUi().ButtonSet.YES_NO
  );
  if (response === SpreadsheetApp.getUi().Button.YES) {
    try {
      var ss = SpreadsheetApp.openById(SHEET_ID);
      var sheet = ss.getSheetByName(SHEET_NAME);
      var lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        sheet.getRange(2, COL.MSG_ID + 1, lastRow - 1, 1).clearContent();
        log("INFO", "Cleared " + (lastRow - 1) + " processed Message IDs");
        showAlert("Cleared", "Removed " + (lastRow - 1) + " MsgIDs.");
      } else {
        showAlert("No Data", "No processed IDs to clear.");
      }
    } catch (e) {
      log("ERROR", "Failed to clear IDs: " + e.message);
      showAlert("Error", e.message);
    }
  }
}

function showStats() {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    var filteredSheet = ss.getSheetByName(FILTERED_SHEET_NAME);
    var data = sheet.getDataRange().getValues();
    var lastRow = sheet.getLastRow();
    
    var msgIds = data.slice(1).map(function(r) { return r[COL.MSG_ID]; }).filter(Boolean);
    var companies = data.slice(1).map(function(r) { return r[COL.COMPANY]; }).filter(function(c) { return c && c !== "N/A"; });
    var highScore = data.slice(1).filter(function(r) { return typeof r[COL.SCORE] === "number" && r[COL.SCORE] >= 70; }).length;
    
    var filteredCount = filteredSheet ? Math.max(0, filteredSheet.getLastRow() - 1) : 0;
    
    var stats = "CRM Stats\n----------------\n✅ Qualified Leads: " + (lastRow - 1) + 
                "\n❌ Filtered Leads: " + filteredCount +
                "\n📊 Unique MsgIDs: " + msgIds.length + 
                "\n🏢 Valid Companies: " + companies.length + 
                "\n⭐ High-Score (70+): " + highScore +
                "\n\n💡 Review filtered leads via CRM-V2 menu → 'Review Filtered Leads'";
    
    log("INFO", stats);
    showAlert("Current Stats", stats);
    
  } catch (e) {
    log("ERROR", "Failed to show stats: " + e.message);
    showAlert("Error", e.message);
  }
}

function setupMistralKey() {
  var key = SpreadsheetApp.getUi().prompt("Setup Mistral API", "Enter your Mistral AI API Key:", SpreadsheetApp.getUi().ButtonSet.OK_CANCEL);
  if (key.getSelectedButton() === SpreadsheetApp.getUi().Button.OK && key.getResponseText().trim()) {
    PropertiesService.getScriptProperties().setProperty("MISTRAL_API_KEY", key.getResponseText().trim());
    showAlert("Success", "Mistral API key saved. Run 'Lead Qualifier' to start processing.");
    log("INFO", "Mistral API key stored");
  }
}

// ═══════════════════════════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════════════════════════

function log(level, message, data) {
  if (data === undefined) data = null;
  var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
  var logMsg = LOG_PREFIX + " [" + level + "] " + ts + " - " + message;
  if (data) {
    var str = typeof data === "string" ? data : JSON.stringify(data);
    var truncated = str.length > CONFIG.LOG_TRUNCATE ? str.slice(0, CONFIG.LOG_TRUNCATE) + "..." : str;
    logMsg += " | Data: " + truncated;
  }
  Logger.log(logMsg);
}

// ═══════════════════════════════════════════════════════════
// ✅ HELPER: Save filtered lead to audit sheet
// ═══════════════════════════════════════════════════════════

function saveFilteredLead(lead, msgId, msgDate, filterReason) {
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(FILTERED_SHEET_NAME);
    if (!sheet) return; // Sheet not initialized yet
    
    var row = [
      msgDate || new Date(),
      lead.company_name || "N/A",
      lead.position || "N/A",
      lead.role_summary || "N/A",
      lead.company_bio || "N/A",
      lead.posted_date || "",
      lead.domain || "",
      lead.email || "",
      lead.linkedin || "",
      lead.score || "",
      lead.decision_link || "",
      lead.wikipedia || "",
      msgId || "",
      lead.fit_reason || "",
      lead.outreach_msg || "",
      filterReason, // ✅ WHY it was filtered
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss") // ✅ When filtered
    ];
    sheet.appendRow(row);
    SpreadsheetApp.flush();
    log("DEBUG", "Saved filtered lead: " + (lead.company_name || "N/A") + " | Reason: " + filterReason);
  } catch (e) {
    log("ERROR", "Failed to save filtered lead: " + e.message);
  }
}

// ═══════════════════════════════════════════════════════════
// HELPER: Check if sender is allowed
// ═══════════════════════════════════════════════════════════

function isSenderAllowed(sender) {
  if (CONFIG.ALLOWED_SENDERS.indexOf("*") !== -1 || CONFIG.ALLOWED_SENDERS.length === 0) return true;
  var senderLower = sender.toLowerCase();
  for (var i = 0; i < CONFIG.ALLOWED_SENDERS.length; i++) {
    if (senderLower.indexOf(CONFIG.ALLOWED_SENDERS[i].toLowerCase()) !== -1) return true;
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// ✅ LEAD VALIDATION
// ═══════════════════════════════════════════════════════════

function isValidLead(l) {
  if (!l.company_name || l.company_name === "N/A") return false;
  if (!l.position || l.position === "N/A") return false;
  if (!l.role_summary || l.role_summary === "N/A") return false;
  if (l.role_summary.toLowerCase().indexOf("n/a") !== -1) return false;
  return true;
}

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION: Fetch & Qualify Leads (WITH FILTERED TRACKING)
// ═══════════════════════════════════════════════════════════

function fetchAndQualifyLeads() {
  log("INFO", "Starting qualifier (Filtered leads saved to " + FILTERED_SHEET_NAME + ")");
  var stats = { 
    threadsScanned: 0, messagesChecked: 0, newMessagesProcessed: 0, 
    leadsAdded: 0, leadsFiltered: 0, duplicatesSkipped: 0, errors: 0 
  };
  
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' missing. Run initializeCRM() first.");
    
    var data = sheet.getDataRange().getValues();
    var existingMsgIds = data.slice(1).map(function(row) { return row[COL.MSG_ID]; }).filter(function(id) { return id; });
    log("INFO", "Loaded " + existingMsgIds.length + " processed Message IDs");
    
    var existingSignatures = new Set(
      data.slice(1).map(function(row) { return buildLeadSignature(row[COL.COMPANY], row[COL.POSITION], row[COL.ROLE_SUMMARY]); }).filter(function(sig) { return sig; })
    );
    log("INFO", "Loaded " + existingSignatures.size + " unique lead signatures");

    var query = "(innovation OR R&D OR patent OR \"technology roadmap\") in:inbox newer_than:7d -in:spam -in:trash";
    var threads = GmailApp.search(query, 0, CONFIG.MAX_SEARCH_THREADS);
    log("INFO", "Found " + threads.length + " threads to scan");
    
    if (threads.length === 0) { log("WARN", "No threads found."); return; }
    
    for (var t = 0; t < threads.length; t++) {
      if (stats.newMessagesProcessed >= CONFIG.MAX_PROCESS_MESSAGES) break;
      stats.threadsScanned++;
      var messages = threads[t].getMessages();
      
      for (var m = 0; m < messages.length; m++) {
        if (stats.newMessagesProcessed >= CONFIG.MAX_PROCESS_MESSAGES) break;
        stats.messagesChecked++;
        
        var msg = messages[m];
        var msgId = msg.getId();
        var subject = msg.getSubject() ? msg.getSubject().slice(0, 80) : "No Subject";
        var sender = msg.getFrom();
        
        if (!isSenderAllowed(sender)) {
          log("DEBUG", "⏭️ Skip (sender not allowed): " + sender);
          continue;
        }
        if (existingMsgIds.indexOf(msgId) !== -1) {
          log("DEBUG", "Skip (MsgID exists): " + subject);
          continue;
        }
        
        var bodyPreview = msg.getPlainBody().slice(0, 1000).toLowerCase();
        var quickSig = generateQuickSignature(bodyPreview, subject);
        if (quickSig && existingSignatures.has(quickSig)) {
          log("DEBUG", "Skip (content fingerprint): " + subject);
          stats.duplicatesSkipped++;
          existingMsgIds.push(msgId);
          continue;
        }
        
        stats.newMessagesProcessed++;
        log("INFO", "[" + stats.newMessagesProcessed + "/200] Processing: " + subject);
        
        var body = msg.getPlainBody();
        Utilities.sleep(CONFIG.SLEEP_MS);
        var leads = callMistralAI(body, msgId);
        
        if (leads.length === 0) {
          log("DEBUG", "No leads extracted | MsgID: " + msgId);
          existingMsgIds.push(msgId);
          continue;
        }
        
        for (var idx = 0; idx < leads.length; idx++) {
          var l = leads[idx];
          
          // ✅ VALIDATION: Incomplete data
          if (!isValidLead(l)) {
            saveFilteredLead(l, msgId, msg.getDate(), "Incomplete data (N/A fields)");
            stats.leadsFiltered++;
            continue;
          }
          
          var company = (l.company_name || "").toLowerCase();
          
          // ✅ NOISE KEYWORD FILTER
          var matchedNoise = null;
          for (var k = 0; k < CONFIG.NOISE_KEYWORDS.length; k++) {
            if (company.indexOf(CONFIG.NOISE_KEYWORDS[k]) !== -1) {
              matchedNoise = CONFIG.NOISE_KEYWORDS[k];
              break;
            }
          }
          if (matchedNoise) {
            saveFilteredLead(l, msgId, msg.getDate(), "Noise keyword: " + matchedNoise);
            stats.leadsFiltered++;
            continue;
          }
          
          // ✅ SIGNATURE DEDUP
          var signature = buildLeadSignature(l.company_name, l.position, l.role_summary);
          if (signature && existingSignatures.has(signature)) {
            saveFilteredLead(l, msgId, msg.getDate(), "Duplicate signature");
            stats.duplicatesSkipped++;
            continue;
          }
          
          // ✅ PRE-APPEND DEDUP (scan last 500 rows)
          var isDuplicate = false;
          var lastRow = sheet.getLastRow();
          if (lastRow > 1) {
            var lastCheckRow = Math.max(2, lastRow - 500);
            var recentData = sheet.getRange(lastCheckRow, 1, Math.max(1, lastRow - lastCheckRow + 1), 3).getValues();
            for (var r = 0; r < recentData.length; r++) {
              var rc = (recentData[r][1] || "").toLowerCase().trim();
              var rp = (recentData[r][2] || "").toLowerCase().trim();
              var rMsgId = recentData[r][12] || "";
              if (rMsgId === msgId) continue;
              if (rc === company && (rp.indexOf((l.position||"").toLowerCase().slice(0,30)) !== -1 || (l.position||"").toLowerCase().slice(0,30).indexOf(rp) !== -1)) {
                isDuplicate = true;
                saveFilteredLead(l, msgId, msg.getDate(), "Duplicate in recent rows");
                stats.duplicatesSkipped++;
                break;
              }
            }
          }
          if (isDuplicate) { existingMsgIds.push(msgId); continue; }
          
          // ✅ APPEND TO MAIN SHEET
          try {
            var newRow = [
              msg.getDate(), l.company_name || "N/A", l.position || "N/A",
              l.role_summary || "N/A", l.company_bio || "N/A", l.posted_date || "",
              l.domain || "", l.email || "", l.linkedin || "", l.score || "",
              l.decision_link || "", l.wikipedia || "", msgId, l.fit_reason || "",
              l.outreach_msg || ""
            ];
            sheet.appendRow(newRow);
            SpreadsheetApp.flush();
            if (sheet.getRange(sheet.getLastRow(), COL.MSG_ID + 1).getValue() === msgId) {
              stats.leadsAdded++;
              if (signature) existingSignatures.add(signature);
              existingMsgIds.push(msgId);
              log("INFO", "✅ Saved: " + l.company_name + " | Score: " + (l.score||"N/A"));
            }
          } catch (e) { 
            log("ERROR", "Append failed: " + e.message); 
            stats.errors++; 
          }
        }
      }
    }
    
    var summary = "✅ Added: " + stats.leadsAdded + " | ❌ Filtered: " + stats.leadsFiltered + " | 🔁 Dupes: " + stats.duplicatesSkipped + " | ⚠️ Errors: " + stats.errors;
    log("INFO", summary);
    showAlert("Complete", summary + "\n\nReview filtered leads: CRM-V2 → 'Review Filtered Leads'");
    
  } catch (e) { 
    log("ERROR", "CRITICAL: " + e.message); 
    showAlert("Failed", e.message); 
  }
}

// ═══════════════════════════════════════════════════════════
// Signature Builder & Quick Fingerprint (UNCHANGED)
// ═══════════════════════════════════════════════════════════

function buildLeadSignature(company, position, roleSummary) {
  if (!company || company === "N/A") return null;
  function normalize(str) {
    if (!str) return "";
    return str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ')
      .replace(/\b(of|and|the|for|in|at|on|with|a|an)\b/g, '')
      .replace(/\b(director|manager|senior|junior|lead|head|vp|vice\s*president)\b/g, '').trim();
  }
  var sig = (normalize(company) + "|" + normalize(position)).slice(0, 180);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, sig)
    .map(b => ('0' + (b & 0xFF).toString(16)).slice(-2)).join('').slice(0, 24);
}

function generateQuickSignature(bodyPreview, subject) {
  if (!bodyPreview) return null;
  var cleanBody = bodyPreview.replace(/----------\s*Forwarded\s*message\s*----------[\s\S]*?(?=\n\n|\w{3,})/i, '')
    .replace(/From:\s*[^\n]+\nDate:\s*[^\n]+\nSubject:\s*[^\n]+\n(?:To:\s*[^\n]+\n)?/gi, '')
    .replace(/On\s+[\w\s,]+wrote:/i, '').replace(/>+\s*[^\n]*\n?/g, '').trim();
  if (cleanBody.length < 50) cleanBody = bodyPreview;
  var capWords = cleanBody.match(/\b[A-Z][a-z]{2,}\b/g) || [];
  var uniqueCompanies = [], seen = {};
  for (var i = 0; i < capWords.length; i++) {
    var word = capWords[i].toLowerCase();
    if (!seen[word]) { seen[word] = true; uniqueCompanies.push(word); }
  }
  var topCompanies = uniqueCompanies.slice(0, 3).join("|");
  var roleKeywords = cleanBody.match(/\b(CTO|VP|R&D|innovation|patent|engineer|director)\b/gi) || [];
  var uniqueRoles = [], roleSeen = {};
  for (var j = 0; j < roleKeywords.length; j++) {
    var role = roleKeywords[j].toLowerCase();
    if (!roleSeen[role]) { roleSeen[role] = true; uniqueRoles.push(role); }
  }
  var topRoles = uniqueRoles.slice(0, 2).join("|");
  if (!topCompanies && !topRoles) return null;
  return (topCompanies + "|" + topRoles).slice(0, 150);
}

// ═══════════════════════════════════════════════════════════
// 🔑 MISTRAL AI API CALL
// ═══════════════════════════════════════════════════════════

function sanitizeEmailBody(body) {
  if (!body) return body;
  return body
    // Remove email addresses
    .replace(/[\w.-]+@[\w.-]+\.\w+/g, "[EMAIL]")
    // Remove phone numbers only
    .replace(/\+?\d[\d\s\-\(\)]{8,}/g, "[PHONE]");
}

function callMistralAI(emailBody, msgId) {
  log("DEBUG", "Fetching Mistral API key for MsgID: " + msgId);
  var apiKey = PropertiesService.getScriptProperties().getProperty("MISTRAL_API_KEY");
  if (!apiKey) { log("ERROR", "Missing MISTRAL_API_KEY"); return []; }
  
  emailBody = sanitizeEmailBody(emailBody);
  
  var url = "https://api.mistral.ai/v1/chat/completions";
  var prompt = buildPrompt(emailBody);
  var payload = { 
    model: CONFIG.AI_MODEL, 
    messages: [{ role: "user", content: prompt }], 
    temperature: CONFIG.AI_TEMPERATURE, 
    response_format: { type: "json_object" }
  };
  
  for (var retry = 0; retry <= CONFIG.MAX_API_RETRIES; retry++) {
    try {
      var res = UrlFetchApp.fetch(url, { 
        method: "post", contentType: "application/json", 
        headers: { "Authorization": "Bearer " + apiKey }, 
        payload: JSON.stringify(payload), muteHttpExceptions: true, timeout: CONFIG.API_TIMEOUT_MS
      });
      var code = res.getResponseCode();
      if (code === 200) return parseAIResponse(res.getContentText(), msgId);
      if (code === 429) {
        var wait = res.getHeaders()["Retry-After"] || Math.pow(2, retry) * 3;
        log("WARN", "Rate limited. Waiting " + wait + "s");
        Utilities.sleep(wait * 1000);
        continue;
      }
      if (code >= 400) {
        log("ERROR", "API Error " + code + ": " + (res.getContentText()||"").slice(0,150));
        if (retry < CONFIG.MAX_API_RETRIES) Utilities.sleep(2000 * (retry + 1));
        continue;
      }
    } catch (e) {
      log("ERROR", "Request failed: " + e.message);
      if (retry < CONFIG.MAX_API_RETRIES) Utilities.sleep(2000);
    }
  }
  log("ERROR", "All retries exhausted | MsgID: " + msgId);
  return [];
}

function buildPrompt(emailBody) {
  return "You are a specialized R&D Intelligence Agent. Extract EVERY listing matching these rules:\n\n" +
    "REQUIRED FIELDS (return for EACH lead):\n" +
    "1. company_name: Organization name (string)\n" +
    "2. position: Job title/role (string)\n" +
    "3. role_summary: 1-2 sentence summary of responsibilities (string)\n" +
    "4. company_bio: 1-2 sentence company overview (string)\n" +
    "5. posted_date: Original posting date if mentioned (string or empty)\n" +
    "6. domain: Official website like \"tesla.com\" (string or empty)\n" +
    "7. email: Contact email if found or guess format like \"careers@company.com\" (string or empty)\n" +
    "8. linkedin: Official Company LinkedIn URL in format: https://www.linkedin.com/company/[vanity-name]. RULES: 1. Verify it is correct. 2. Remove legal suffixes. EXAMPLES: 'Tesla Inc' -> https://www.linkedin.com/company/tesla, 'Microsoft Corporation' -> https://www.linkedin.com/company/microsoft, '3M' -> https://www.linkedin.com/company/3m, 'GSK' -> https://www.linkedin.com/company/gsk (string or empty)\n" +
    "9. score: Fit score 0-100 based on: Manufacturing/Auto/Aerospace/Pharma/MedTech/GCC + 500+ employees + R&D signals (number)\n" +
    "10. fit_reason: CONCISE 1-sentence explanation WHY this lead matches. MUST cite: (1) sector match, (2) employee size signal if available, (3) specific R&D keyword found in email.\n" +
    "11. decision_link: LinkedIn URL to see all employees/people of this company. Use the exact same vanity-name from the linkedin field and append /people/ (e.g., https://www.linkedin.com/company/tesla/people/) (string or empty)\n" +
    "12. wikipedia: Wikipedia URL if company has one (string or empty)\n" +
    "13. outreach_msg: Company specific outreach message, personalized based on their profile and R&D signals (string)\n\n" +
    "SECTOR FILTER (ONLY extract if matches):\n" +
    "- Manufacturing, Automotive, Aerospace, Pharma, MedTech, Global Capability Centers (GCC)\n" +
    "- Companies with 500+ employees\n" +
    "- Signals: technology roadmap, R&D strategy, IP analyst, patent portfolio, innovation manager, TRIZ, NPD\n\n" +
    "EXCLUDE:\n" +
    "- IT Services (TCS, Infosys, Wipro, etc.), Trading, Startups <5 years, Distributors, Retail chains, Law firms, Consulting firms, IP services\n\n" +
    "OUTPUT FORMAT (STRICT JSON ARRAY):\n" +
    "[{\"company_name\":\"String\",\"position\":\"String\",\"role_summary\":\"String\",\"company_bio\":\"String\",\"posted_date\":\"String\",\"domain\":\"String\",\"email\":\"String\",\"linkedin\":\"String\",\"score\":85,\"fit_reason\":\"String\",\"decision_link\":\"String\",\"wikipedia\":\"String\",\"outreach_msg\":\"String\"}]\n\n" +
    "EMAIL TO ANALYZE:\n" + emailBody;
}

function parseAIResponse(rawResponse, msgId) {
  try {
    var parsedResponse = JSON.parse(rawResponse);
    var aiContent = parsedResponse?.choices?.[0]?.message?.content;
    if (!aiContent) { log("WARN", "No content in AI response"); return []; }
    var parsed = JSON.parse(aiContent);
    var raw = Array.isArray(parsed) ? parsed : (parsed.leads || parsed.results || parsed.jobs || parsed.data || [parsed]);
    var results = [];
    for (var i = 0; i < raw.length; i++) {
      var l = raw[i];
      var wikiUrl = (function() {
        var company = l.company_name || l.Company || l.organization;
        if (!company || company === "N/A") return "";
        if (l.wikipedia && l.wikipedia.indexOf("wikipedia.org") !== -1) return l.wikipedia;
        if (l.wiki_url && l.wiki_url.indexOf("wikipedia.org") !== -1) return l.wiki_url;
        return getVerifiedWikipediaUrl(company, msgId);
      })();
      var fitReason = (function() {
        var base = l.fit_reason || l.why_match || l.match_reason || "Score based on sector + R&D signals";
        var company = l.company_name || l.Company || l.organization;
        if (!company || company === "N/A") return base;
        var wikiResult = getCachedWikipediaResult(company);
        if (!wikiResult && CONFIG.WIKIPEDIA_ENABLED) wikiResult = fetchWikipediaEnrichment(company, msgId);
        if (wikiResult?.data?.firmographics) {
          var fg = wikiResult.data.firmographics, extras = [];
          if (fg.headquarters) extras.push("HQ: " + fg.headquarters);
          if (fg.industry) extras.push("Industry: " + fg.industry);
          if (fg.employees) extras.push("Employees: " + fg.employees.toLocaleString());
          if (extras.length > 0) return base + " | Wikipedia: " + extras.join(", ");
        }
        return base;
      })();
      results.push({
        company_name: l.company_name || l.Company || l.organization || "N/A",
        position: l.position || l.title_name || l.role || l.job_title || "N/A",
        role_summary: l.role_summary || l.role_description || l.summary || "N/A",
        company_bio: l.company_bio || l.company_description || l.about || "N/A",
        posted_date: l.posted_date || l.date_of_posting || l.date || "",
        domain: l.domain || l.website || extractDomain(l.company_name) || "",
        email: l.email || l.contact_email || guessEmail(l.domain) || "",
        linkedin: l.linkedin || l.linkedin_url || buildLinkedIn(l.company_name) || "",
        score: typeof l.score === "number" ? l.score : (l.fit_score || l.relevance_score || ""),
        fit_reason: fitReason,
        outreach_msg: l.outreach_msg || l.outreach || "",
        decision_link: l.decision_link || l.cto_link || buildDecisionLink(l.company_name) || "",
        wikipedia: wikiUrl
      });
    }
    return results;
  } catch (e) {
    log("ERROR", "Failed to parse AI response: " + e.message);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════
// 🏛️ WIKIPEDIA ENRICHMENT (FIXED)
// ═══════════════════════════════════════════════════════════

function getVerifiedWikipediaUrl(companyName, msgId) {
  if (!CONFIG.WIKIPEDIA_ENABLED) return "";
  var result = fetchWikipediaEnrichment(companyName, msgId);
  return result.verified ? result.wikiUrl : "";
}

function fetchWikipediaEnrichment(companyName, msgId) {
  var result = { wikiUrl: "", data: null, verified: false, error: null };
  if (!companyName || companyName === "N/A") return result;
  var searchTitle = normalizeForWikipedia(companyName);
  try {
    var baseUrl = "https://en.wikipedia.org/w/api.php";
    var params = { action: "query", format: "json", prop: "extracts|info", exintro: "1", explaintext: "1", inprop: "url", titles: searchTitle };
    var queryString = Object.keys(params).map(function(key) { return encodeURIComponent(key) + "=" + encodeURIComponent(params[key]); }).join("&");
    var response = UrlFetchApp.fetch(baseUrl + "?" + queryString, { muteHttpExceptions: true, timeout: 10000 });
    if (response.getResponseCode() !== 200) return result;
    var json = JSON.parse(response.getContentText());
    var pages = json.query.pages, pageId = Object.keys(pages)[0];
    if (pageId === "-1" || !pages[pageId].extract) return result;
    var page = pages[pageId];
    if (page.extract && page.extract.toLowerCase().indexOf("may refer to") !== -1) {
      log("DEBUG", "Disambiguation page for: " + companyName);
      return result;
    }
    result.verified = true;
    result.wikiUrl = page.fullurl || "";
    result.data = { title: page.title || "", extract: page.extract ? page.extract.slice(0, 500) + "..." : "" };
    var fg = extractFirmographicsFromText(page.extract || "", companyName);
    if (fg) { result.data.firmographics = fg; log("INFO", "Wikipedia enriched: " + companyName); }
    cacheWikipediaResult(searchTitle, result);
    return result;
  } catch (e) {
    log("ERROR", "Wikipedia lookup failed: " + e.message);
    return result;
  }
}

function normalizeForWikipedia(name) {
  if (!name) return "";
  var expansions = { "gsk": "GlaxoSmithKline", "ge": "General Electric", "ibm": "International Business Machines", "3m": "3M (company)", "bmw": "BMW" };
  var lower = name.toLowerCase().trim();
  if (expansions[lower]) name = expansions[lower];
  return name.replace(/^(the|a|an)\s+/i, "").replace(/[^a-z0-9\s\-\&]/gi, "")
    .replace(/\s+/g, "_").replace(/_+/g, "_").replace(/^_+|_+$/g, "")
    .replace(/_(inc|ltd|llc|corp|corporation|limited|company)$/i, "").trim();
}

function extractFirmographicsFromText(text, companyName) {
  if (!text) return null;
  var result = {};
  var hq = text.match(/(?:headquartered|based)\s+in\s+([A-Z][\w\s,\.]+)/i);
  if (hq && hq[1]) result.headquarters = hq[1].trim();
  var ind = text.match(/is\s+a\s+([\w\s]+)\s+company/i);
  if (ind && ind[1]) result.industry = ind[1].trim();
  var emp = text.match(/(\d{1,3}(?:,\d{3})*)\s+employees/i);
  if (emp && emp[1]) { var n = parseInt(emp[1].replace(/,/g, "")); if (n >= 100) result.employees = n; }
  var fnd = text.match(/founded\s+(?:in\s+)?(\d{4})/i);
  if (fnd && fnd[1]) result.founded = parseInt(fnd[1]);
  return Object.keys(result).length > 0 ? result : null;
}

function cacheWikipediaResult(companyKey, result) {
  try {
    var props = PropertiesService.getScriptProperties();
    var cacheKey = "wiki_cache_" + companyKey.toLowerCase().replace(/[^a-z0-9]/g, "_");
    props.setProperty(cacheKey, JSON.stringify({ ts: new Date().getTime(), verified: result.verified, wikiUrl: result.wikiUrl }));
  } catch (e) {}
}

function getCachedWikipediaResult(companyName) {
  try {
    var props = PropertiesService.getScriptProperties();
    var cacheKey = "wiki_cache_" + normalizeForWikipedia(companyName).toLowerCase().replace(/[^a-z0-9]/g, "_");
    var cached = props.getProperty(cacheKey);
    if (!cached) return null;
    var data = JSON.parse(cached);
    if ((new Date().getTime() - data.ts) / (1000 * 60 * 60) < CONFIG.WIKIPEDIA_CACHE_HOURS) 
      return { wikiUrl: data.wikiUrl, verified: data.verified };
    return null;
  } catch (e) { return null; }
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function extractDomain(companyName) {
  if (!companyName || companyName === "N/A") return "";
  var clean = companyName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  var parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0] + ".com";
  if (parts.length === 2) return parts[0] + parts[1] + ".com";
  return parts[0] + ".com";
}

function guessEmail(domain) {
  if (!domain) return "";
  var prefixes = ["careers", "jobs", "hr", "recruiting", "talent", "contact"];
  return prefixes[Math.floor(Math.random() * prefixes.length)] + "@" + domain;
}

function buildLinkedIn(companyName) {
  if (!companyName || companyName === "N/A") return "";
  var cleanName = companyName.toLowerCase().replace(/\b(inc|ltd|llc|corp|corporation|limited|company|group)\b\.?/gi, "").trim();
  var slug = cleanName.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return "https://www.linkedin.com/company/" + slug;
}

function buildDecisionLink(companyName) {
  if (!companyName || companyName === "N/A") return "";
  var cleanName = companyName.toLowerCase().replace(/\b(inc|ltd|llc|corp|corporation|limited|company|group)\b\.?/gi, "").trim();
  var slug = cleanName.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return "https://www.linkedin.com/company/" + slug + "/people/";
}