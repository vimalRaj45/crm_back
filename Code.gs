// CRM-V2: Master Edition - Production Ready
// Features: 14-column CRM, 20 new emails limit, smart dedup, AI logging, fit_reason column
// NEW: Dynamic sender filter - use "*" for all senders, or list specific emails

// GLOBAL CONFIGURATION
var SHEET_ID = "1VJtX69Wn4lDryad8L6NkpMylnlys_tPJqYn-b2Oa_aI";
var SHEET_NAME = "Leads";
var LOG_SHEET_NAME = "Logs";
var LOG_PREFIX = "[CRM-V2]";

var CONFIG = {
  MAX_SEARCH_THREADS: 50,
  MAX_PROCESS_MESSAGES: 20,
  SLEEP_MS: 2500,
  NOISE_KEYWORDS: ["tcs", "infosys", "wipro", "hcl", "cognizant", "accenture", "starbucks", "uber", "delivery", "distributor"],
  AI_MODEL: "llama-3.3-70b-versatile",
  AI_TEMPERATURE: 0.1,
  LOG_TRUNCATE: 800,
  // ✅ DYNAMIC SENDER FILTER:
  //    Use ["*"] to process ALL senders (no filter) 
  //    Or list specific emails: ["recruiter@company.com", "hr@startup.io"]  or domain ["@tesla.com"]
  ALLOWED_SENDERS: ["vimalraj5207@gmail.com","muralidharanl@gmail.com"]
};

// COLUMN INDICES (0-based) - 14 COLUMNS
var COL = {
  DATE: 0,
  COMPANY: 1,
  POSITION: 2,
  ROLE_SUMMARY: 3,
  COMPANY_BIO: 4,
  POSTED: 5,
  DOMAIN: 6,
  EMAIL: 7,
  LINKEDIN: 8,
  SCORE: 9,
  DECISION_LINK: 10,
  WIKI_LINK: 11,
  MSG_ID: 12,
  FIT_REASON: 13
};

// HEADERS - Exact 14-column order
var HEADERS = [
  "Date", "Company", "Position", "Role Summary", "Company Bio", "Posted",
  "Domain", "Email", "LinkedIn", "Score", "Decision Maker Link",
  "Wikipedia Link", "Message ID", "Fit Reason"
];

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
    .addToUi();
}

function showAlert(title, message) {
  try { 
    SpreadsheetApp.getUi().alert(title, message, SpreadsheetApp.getUi().ButtonSet.OK); 
  } catch (e) { 
    log("INFO", title + " | " + message);
  }
}

function initializeCRM() {
  log("INFO", "Initializing CRM sheets with 14-column layout...");
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      log("INFO", "Created new sheet: " + SHEET_NAME);
    }
    
    var needsUpdate = true;
    if (sheet.getLastColumn() > 0 && sheet.getLastRow() > 0) {
      var currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      var lastHeader = currentHeaders[currentHeaders.length - 1];
      needsUpdate = currentHeaders.length < HEADERS.length || lastHeader !== "Fit Reason";
    }
    
    if (needsUpdate) {
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length)
        .setFontWeight("bold")
        .setBackground("#4285f4")
        .setFontColor("white")
        .setHorizontalAlignment("center");
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, HEADERS.length);
      sheet.setColumnWidth(COL.FIT_REASON + 1, 320);
      
      var scoreRange = sheet.getRange(2, COL.SCORE + 1, 1000, 1);
      var rule = SpreadsheetApp.newDataValidation().requireNumberBetween(0, 100).build();
      scoreRange.setDataValidation(rule);
      
      log("INFO", "14-column headers written/updated in Leads sheet");
    } else {
      log("INFO", "Leads sheet already has correct 14-column headers");
    }
    
    var logSheet = ss.getSheetByName(LOG_SHEET_NAME);
    if (!logSheet) {
      logSheet = ss.insertSheet(LOG_SHEET_NAME);
      logSheet.getRange(1, 1, 1, 4).setValues([["Timestamp", "Level", "Message", "Data"]]);
      logSheet.getRange(1, 1, 1, 4)
        .setFontWeight("bold")
        .setBackground("#34a853")
        .setFontColor("white");
      logSheet.setFrozenRows(1);
      logSheet.autoResizeColumns(1, 4);
      log("INFO", "Created new sheet: " + LOG_SHEET_NAME);
    }
    
    showAlert("CRM Initialized", "Sheets ready:\n- " + SHEET_NAME + " (14 columns)\n- " + LOG_SHEET_NAME + "\n\nRun 'Lead Qualifier' from CRM-V2 menu.");
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
        showAlert("Cleared", "Removed " + (lastRow - 1) + " MsgIDs.\nNext run will re-process all emails.");
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
    var data = sheet.getDataRange().getValues();
    var lastRow = sheet.getLastRow();
    
    var msgIds = data.slice(1).map(function(r) { return r[COL.MSG_ID]; }).filter(Boolean);
    var companies = data.slice(1).map(function(r) { return r[COL.COMPANY]; }).filter(function(c) { return c && c !== "N/A"; });
    var highScore = data.slice(1).filter(function(r) { return typeof r[COL.SCORE] === "number" && r[COL.SCORE] >= 70; }).length;
    
    var stats = "CRM Stats\n----------------\nTotal Rows: " + (lastRow - 1) + "\nUnique MsgIDs: " + msgIds.length + "\nValid Companies: " + companies.length + "\nHigh-Score Leads (70+): " + highScore;
    
    log("INFO", stats);
    showAlert("Current Stats", stats);
    
  } catch (e) {
    log("ERROR", "Failed to show stats: " + e.message);
    showAlert("Error", e.message);
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
// HELPER: Check if sender is allowed (DYNAMIC: "*" = all)
// ═══════════════════════════════════════════════════════════

function isSenderAllowed(sender) {
  // If ALLOWED_SENDERS contains "*", allow ALL senders
  if (CONFIG.ALLOWED_SENDERS.indexOf("*") !== -1 || CONFIG.ALLOWED_SENDERS.length === 0) {
    return true;
  }
  
  // Otherwise check if sender matches any allowed email (partial match, case-insensitive)
  var senderLower = sender.toLowerCase();
  for (var i = 0; i < CONFIG.ALLOWED_SENDERS.length; i++) {
    if (senderLower.indexOf(CONFIG.ALLOWED_SENDERS[i].toLowerCase()) !== -1) {
      return true;
    }
  }
  return false;
}

// ═══════════════════════════════════════════════════════════
// MAIN FUNCTION: Fetch & Qualify Leads (OPTIMIZED)
// ═══════════════════════════════════════════════════════════

function fetchAndQualifyLeads() {
  log("INFO", "Starting qualifier (Smart dedup: skip AI if MsgID or content exists)");
  var stats = { 
    threadsScanned: 0, 
    messagesChecked: 0, 
    newMessagesProcessed: 0, 
    leadsAdded: 0, 
    leadsFiltered: 0, 
    duplicatesSkipped: 0, 
    errors: 0 
  };
  
  try {
    var ss = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet '" + SHEET_NAME + "' missing. Run initializeCRM() first.");
    
    var data = sheet.getDataRange().getValues();
    
    var existingMsgIds = data.slice(1).map(function(row) { return row[COL.MSG_ID]; }).filter(function(id) { return id; });
    log("INFO", "Loaded " + existingMsgIds.length + " processed Message IDs");
    
    var existingSignatures = new Set(
      data.slice(1)
        .map(function(row) { return buildLeadSignature(row[COL.COMPANY], row[COL.POSITION], row[COL.ROLE_SUMMARY]); })
        .filter(function(sig) { return sig; })
    );
    log("INFO", "Loaded " + existingSignatures.size + " unique lead signatures for content dedup");

    var query = "(innovation OR R&D OR patent OR \"technology roadmap\")";
    var threads = GmailApp.search(query, 0, CONFIG.MAX_SEARCH_THREADS);
    log("INFO", "Found " + threads.length + " threads to scan");
    
    if (threads.length === 0) {
      log("WARN", "No threads found. Process complete.");
      return;
    }
    
    // OPTIMIZED LOOP
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
        
        // ✅ DYNAMIC SENDER FILTER: Skip if not allowed (unless "*" is set)
        if (!isSenderAllowed(sender)) {
          log("DEBUG", "⏭️ Skip (sender not allowed): " + sender + " | Subject: " + subject);
          continue;
        }
        
        // EARLY EXIT #1: Skip if this exact email was already processed
        if (existingMsgIds.indexOf(msgId) !== -1) {
          log("DEBUG", "Skip (MsgID exists): " + subject + " | MsgID: " + msgId);
          continue;
        }
        
        // EARLY EXIT #2: Quick content fingerprint check BEFORE AI call
        var bodyPreview = msg.getPlainBody().slice(0, 500).toLowerCase();
        var quickSig = generateQuickSignature(bodyPreview, subject);
        
        if (quickSig && existingSignatures.has(quickSig)) {
          log("DEBUG", "Skip (content fingerprint match): " + subject + " | MsgID: " + msgId);
          stats.duplicatesSkipped++;
          continue;
        }
        
        // Process as NEW message & call AI
        stats.newMessagesProcessed++;
        log("INFO", "[" + stats.newMessagesProcessed + "/" + CONFIG.MAX_PROCESS_MESSAGES + "] Processing: " + subject + " | From: " + sender + " | MsgID: " + msgId);
        
        var body = msg.getPlainBody();
        var bodyPreviewLog = body ? body.replace(/\n/g, " ").slice(0, 300) + "..." : "";
        log("DEBUG", "Email preview (MsgID: " + msgId + "): " + bodyPreviewLog);
        
        Utilities.sleep(CONFIG.SLEEP_MS);
        
        var leads = callGroqAI(body, msgId);
        
        if (leads.length > 0) {
          log("INFO", "Extracted " + leads.length + " lead(s) from MsgID: " + msgId, leads);
        } else {
          log("DEBUG", "No leads extracted from MsgID: " + msgId);
          existingMsgIds.push(msgId);
          continue;
        }
        
        // Filter & Append Leads
        for (var idx = 0; idx < leads.length; idx++) {
          var l = leads[idx];
          var company = (l.company_name || "").toLowerCase();
          
          if (!l.company_name || l.company_name === "N/A") { 
            log("DEBUG", "Filtered: Empty company | MsgID: " + msgId);
            stats.leadsFiltered++; 
            continue; 
          }
          
          var matchedNoise = null;
          for (var k = 0; k < CONFIG.NOISE_KEYWORDS.length; k++) {
            if (company.indexOf(CONFIG.NOISE_KEYWORDS[k]) !== -1) {
              matchedNoise = CONFIG.NOISE_KEYWORDS[k];
              break;
            }
          }
          if (matchedNoise) { 
            log("DEBUG", "Filtered: Noise keyword '" + matchedNoise + "' | Company: " + l.company_name + " | MsgID: " + msgId);
            stats.leadsFiltered++; 
            continue; 
          }
          
          var signature = buildLeadSignature(l.company_name, l.position, l.role_summary);
          if (signature && existingSignatures.has(signature)) {
            log("DEBUG", "Skipped duplicate: '" + l.company_name + " | " + l.position + "' | MsgID: " + msgId);
            stats.duplicatesSkipped++;
            continue;
          }
          
          try {
            var newRow = [
              msg.getDate(),
              l.company_name || "N/A",
              l.position || l.title_name || "N/A",
              l.role_summary || l.role_description || "N/A",
              l.company_bio || l.company_description || "N/A",
              l.posted_date || l.date_of_posting || "",
              l.domain || "",
              l.email || "",
              l.linkedin || "",
              l.score || "",
              l.decision_link || "",
              l.wikipedia || "",
              msgId,
              l.fit_reason || ""
            ];
            
            sheet.appendRow(newRow);
            SpreadsheetApp.flush();
            
            var afterRow = sheet.getLastRow();
            var savedMsgId = sheet.getRange(afterRow, COL.MSG_ID + 1).getValue();
            
            if (savedMsgId === msgId) {
              stats.leadsAdded++;
              if (signature) existingSignatures.add(signature);
              existingMsgIds.push(msgId);
              var fitPreview = l.fit_reason ? l.fit_reason.slice(0, 60) + "..." : "";
              log("INFO", "Saved: " + l.company_name + " | " + l.position + " | Fit: " + fitPreview);
            } else {
              throw new Error("Verification mismatch");
            }
          } catch (e) { 
            log("ERROR", "Append failed for " + l.company_name + " | MsgID: " + msgId + " | Error: " + e.message); 
            stats.errors++; 
          }
        }
      }
    }
    
    var summary = "Scanned: " + stats.threadsScanned + " threads | Checked: " + stats.messagesChecked + " emails | Processed: " + stats.newMessagesProcessed + "/" + CONFIG.MAX_PROCESS_MESSAGES + " | Added: " + stats.leadsAdded + " | Skipped(Dup): " + stats.duplicatesSkipped + " | Errors: " + stats.errors;
    log("INFO", summary);
    showAlert("Complete", summary);
    
  } catch (e) { 
    log("ERROR", "CRITICAL FAILURE: " + e.message + " | Stack: " + e.stack); 
    showAlert("Failed", e.message); 
  }
}

// ═══════════════════════════════════════════════════════════
// Lead Signature Builder
// ═══════════════════════════════════════════════════════════

function buildLeadSignature(company, position, roleSummary) {
  if (!company || company === "N/A") return null;
  
  function normalize(str) {
    if (!str) return "";
    return str.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/\b(of|and|the|for|in|at|on|with)\b/g, '')
      .trim();
  }
  
  var c = normalize(company);
  var p = normalize(position);
  var r = normalize(roleSummary);
  
  return (c + "|" + p + "|" + r).slice(0, 200);
}

// ═══════════════════════════════════════════════════════════
// Quick Content Fingerprint
// ═══════════════════════════════════════════════════════════

function generateQuickSignature(bodyPreview, subject) {
  if (!bodyPreview) return null;
  
  var capWords = (subject + " " + bodyPreview).match(/\b[A-Z][a-z]{2,}\b/g) || [];
  var uniqueCompanies = [];
  var seen = {};
  for (var i = 0; i < capWords.length; i++) {
    var word = capWords[i].toLowerCase();
    if (!seen[word]) {
      seen[word] = true;
      uniqueCompanies.push(word);
    }
  }
  var topCompanies = uniqueCompanies.slice(0, 3).join("|");
  
  var roleKeywords = bodyPreview.match(/\b(CTO|VP|R&D|innovation|patent|engineer|director)\b/gi) || [];
  var uniqueRoles = [];
  var roleSeen = {};
  for (var j = 0; j < roleKeywords.length; j++) {
    var role = roleKeywords[j].toLowerCase();
    if (!roleSeen[role]) {
      roleSeen[role] = true;
      uniqueRoles.push(role);
    }
  }
  var topRoles = uniqueRoles.slice(0, 2).join("|");
  
  if (!topCompanies && !topRoles) return null;
  
  return (topCompanies + "|" + topRoles).slice(0, 150);
}

// ═══════════════════════════════════════════════════════════
// AI FUNCTION: Groq API Call
// ═══════════════════════════════════════════════════════════

function callGroqAI(emailBody, msgId) {
  log("DEBUG", "Fetching API key for MsgID: " + msgId);
  var apiKey = PropertiesService.getScriptProperties().getProperty("GROQ_API_KEY");
  
  if (!apiKey) { 
    log("ERROR", "Missing GROQ_API_KEY | MsgID: " + msgId); 
    return []; 
  }
  
  var url = "https://api.groq.com/openai/v1/chat/completions";
  
  var prompt = "You are a specialized R&D Intelligence Agent. Extract EVERY listing matching these rules:\n\n" +
    "REQUIRED FIELDS (return for EACH lead):\n" +
    "1. company_name: Organization name (string)\n" +
    "2. position: Job title/role (string)\n" +
    "3. role_summary: 1-2 sentence summary of responsibilities (string)\n" +
    "4. company_bio: 1-2 sentence company overview (string)\n" +
    "5. posted_date: Original posting date if mentioned (string or empty)\n" +
    "6. domain: Official website like \"tesla.com\" (string or empty)\n" +
    "7. email: Contact email if found or guess format like \"careers@company.com\" (string or empty)\n" +
    "8. linkedin: Company LinkedIn URL like \"https://linkedin.com/company/tesla\" (string or empty)\n" +
    "9. score: Fit score 0-100 based on: Manufacturing/Auto/Aerospace/Pharma/MedTech/GCC + 500+ employees + R&D signals (number)\n" +
    "10. fit_reason: CONCISE 1-sentence explanation WHY this lead matches. MUST cite: (1) sector match, (2) employee size signal if available, (3) specific R&D keyword found in email.\n" +
    "11. decision_link: Pre-built LinkedIn search URL for CTO/VP R&D at this company (string or empty)\n" +
    "12. wikipedia: Wikipedia URL if company has one (string or empty)\n\n" +
    "SECTOR FILTER (ONLY extract if matches):\n" +
    "- Manufacturing, Automotive, Aerospace, Pharma, MedTech, Global Capability Centers (GCC)\n" +
    "- Companies with 500+ employees\n" +
    "- Signals: technology roadmap, R&D strategy, IP analyst, patent portfolio, innovation manager, TRIZ, NPD\n\n" +
    "EXCLUDE:\n" +
    "- IT Services (TCS, Infosys, Wipro, etc.), Trading, Startups <5 years, Distributors, Retail chains\n\n" +
    "OUTPUT FORMAT (STRICT JSON ARRAY):\n" +
    "[{\"company_name\":\"String\",\"position\":\"String\",\"role_summary\":\"String\",\"company_bio\":\"String\",\"posted_date\":\"String\",\"domain\":\"String\",\"email\":\"String\",\"linkedin\":\"String\",\"score\":85,\"fit_reason\":\"String\",\"decision_link\":\"String\",\"wikipedia\":\"String\"}]\n\n" +
    "EMAIL TO ANALYZE:\n" + emailBody;

  var payload = { 
    model: CONFIG.AI_MODEL, 
    messages: [{ role: "user", content: prompt }], 
    temperature: CONFIG.AI_TEMPERATURE, 
    response_format: { type: "json_object" } 
  };
  
  log("INFO", "Sending AI request | Model: " + CONFIG.AI_MODEL + " | MsgID: " + msgId);
  
  for (var retry = 0; retry <= 2; retry++) {
    try {
      var startTime = new Date();
      var res = UrlFetchApp.fetch(url, { 
        method: "post", 
        contentType: "application/json", 
        headers: { Authorization: "Bearer " + apiKey }, 
        payload: JSON.stringify(payload), 
        muteHttpExceptions: true
      });
      var responseTime = (new Date() - startTime) / 1000;
      var code = res.getResponseCode();
      
      log("DEBUG", "API Response | Status: " + code + " | Time: " + responseTime + "s | MsgID: " + msgId);
      
      if (code === 429) { 
        var waitTime = 3000 + (retry * 2000);
        log("WARN", "Rate limited (429). Waiting " + (waitTime/1000) + "s before retry " + (retry+1) + "/3 | MsgID: " + msgId);
        Utilities.sleep(waitTime); 
        continue; 
      }
      
      if (code !== 200) {
        var errorText = res.getContentText() ? res.getContentText().slice(0, 300) : "";
        log("ERROR", "API Error " + code + " | Body: " + errorText + " | MsgID: " + msgId);
        return [];
      }
      
      var rawResponse = res.getContentText();
      var parsedResponse = JSON.parse(rawResponse);
      var aiContent = parsedResponse && parsedResponse.choices && parsedResponse.choices[0] && parsedResponse.choices[0].message ? parsedResponse.choices[0].message.content : null;
      
      if (!aiContent) {
        log("WARN", "No content in AI response choices | MsgID: " + msgId);
        return [];
      }
      
      var parsed = JSON.parse(aiContent);
      var raw = Array.isArray(parsed) ? parsed : (parsed.leads || parsed.results || parsed.jobs || parsed.data || [parsed]);
      
      var results = [];
      for (var i = 0; i < raw.length; i++) {
        var l = raw[i];
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
          fit_reason: l.fit_reason || l.why_match || l.match_reason || "Score based on sector + R&D signals",
          decision_link: l.decision_link || l.cto_link || buildDecisionLink(l.company_name) || "",
          wikipedia: l.wikipedia || l.wiki_url || buildWikipedia(l.company_name) || ""
        });
      }
      
      log("INFO", "Final normalized leads (MsgID: " + msgId + "): " + results.length + " item(s)", results);
      return results;
      
    } catch (e) {
      log("ERROR", "AI request failed | MsgID: " + msgId + " | Error: " + e.message + " | Retry: " + (retry+1) + "/3");
      if (retry < 2) Utilities.sleep(2000);
    }
  }
  
  log("ERROR", "All AI retries exhausted | MsgID: " + msgId);
  return [];
}

// ═══════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════

function extractDomain(companyName) {
  if (!companyName || companyName === "N/A") return "";
  var clean = companyName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
  var parts = clean.split(/\s+/);
  var filtered = [];
  for (var i = 0; i < parts.length; i++) {
    if (parts[i]) filtered.push(parts[i]);
  }
  if (filtered.length === 0) return "";
  if (filtered.length === 1) return filtered[0] + ".com";
  if (filtered.length === 2) return filtered[0] + filtered[1] + ".com";
  return filtered[0] + ".com";
}

function guessEmail(domain) {
  if (!domain) return "";
  var prefixes = ["careers", "jobs", "hr", "recruiting", "talent", "contact"];
  var prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  return prefix + "@" + domain;
}

function buildLinkedIn(companyName) {
  if (!companyName || companyName === "N/A") return "";
  var slug = companyName.toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return "https://linkedin.com/company/" + slug;
}

function buildDecisionLink(companyName) {
  if (!companyName || companyName === "N/A") return "";
  var encoded = encodeURIComponent(companyName);
  return "https://linkedin.com/search/results/people/?keywords=CTO%20OR%20VP%20R&D&company=" + encoded;
}

function buildWikipedia(companyName) {
  if (!companyName || companyName === "N/A") return "";
  var slug = companyName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, "_");
  return "https://en.wikipedia.org/wiki/" + slug;
}