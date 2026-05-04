import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { google } from 'googleapis';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ─── Config ──────────────────────────────────────
const SHEET_ID        = "1v7-gLstbXePVCiHrjGysdjIR2vSDm180XYirgUWzl9U";
const SERVICE_ACCOUNT = 'service-account.json';
const BREVO_API_KEY   = process.env.BREVO_API_KEY;
const BREVO_SENDER    = process.env.BREVO_SENDER;
const ALLOWED_EMAILS  = (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

// ─── In-memory Stores ────────────────────────────
const otpStore   = new Map();

// ─── Auth Middleware ─────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET;

function requireAuth(req, res, next) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userEmail = decoded.email;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Session expired or invalid' });
    }
}

// ─── Static Files ────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ─── Send Email via Brevo HTTP API (axios) ───────
async function sendOtpEmail(toEmail, otp) {
    const digits = otp.split('').map(d =>
        `<span style="display:inline-block;width:44px;height:52px;line-height:52px;font-size:28px;font-weight:700;color:#a855f7;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);border-radius:10px;margin:0 4px;text-align:center;">${d}</span>`
    ).join('');

    const html = `
    <div style="max-width:480px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;background:#0f0f1a;border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.05);">
        <div style="background:linear-gradient(135deg,#6366f1,#a855f7);padding:32px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">📡</div>
            <h1 style="color:white;margin:0;font-size:22px;font-weight:700;">Spirelia Intelligence</h1>
            <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Secure Login Verification</p>
        </div>
        <div style="padding:32px;text-align:center;">
            <p style="color:#ccc;font-size:15px;margin:0 0 24px;">Your one-time access code:</p>
            <div style="margin:0 0 24px;">${digits}</div>
            <p style="color:#888;font-size:13px;">⏱ Expires in <strong style="color:#a855f7;">5 minutes</strong></p>
            <hr style="border:none;border-top:1px solid rgba(255,255,255,0.05);margin:24px 0;">
            <p style="color:#555;font-size:12px;margin:0;">If you didn't request this, ignore this email.</p>
        </div>
    </div>`;

    await axios.post('https://api.brevo.com/v3/smtp/email', {
        sender: { name: 'Spirelia Intelligence', email: BREVO_SENDER },
        to: [{ email: toEmail }],
        subject: '🔐 Your Spirelia Login OTP',
        htmlContent: html,
    }, {
        headers: {
            'api-key': BREVO_API_KEY,
            'Content-Type': 'application/json',
        },
    });
}

// ─── Send OTP ────────────────────────────────────
app.post('/api/send-otp', async (req, res) => {
    try {
        const email = (req.body.email || '').toLowerCase().trim();
        if (!email || !email.includes('@')) {
            return res.status(400).json({ error: 'Enter a valid email address' });
        }
        if (!ALLOWED_EMAILS.includes(email)) {
            return res.status(403).json({ error: 'This email is not authorized' });
        }

        const existing = otpStore.get(email);
        if (existing && Date.now() - existing.createdAt < 60000) {
            return res.status(429).json({ error: 'Wait 60s before requesting a new OTP' });
        }

        const otp = crypto.randomInt(100000, 999999).toString();
        otpStore.set(email, { otp, expires: Date.now() + 300000, attempts: 0, createdAt: Date.now() });

        await sendOtpEmail(email, otp);

        console.log(`📨 OTP sent to ${email}`);
        res.json({ success: true, message: 'OTP sent to your email' });
    } catch (err) {
        console.error('❌ OTP error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Failed to send OTP. Try again.' });
    }
});

// ─── Verify OTP ──────────────────────────────────
app.post('/api/verify-otp', (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    const otp   = (req.body.otp || '').trim();

    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

    const stored = otpStore.get(email);
    if (!stored) return res.status(400).json({ error: 'No OTP found. Request a new one.' });
    if (Date.now() > stored.expires) {
        otpStore.delete(email);
        return res.status(400).json({ error: 'OTP expired. Request a new one.' });
    }
    if (stored.attempts >= 5) {
        otpStore.delete(email);
        return res.status(429).json({ error: 'Too many attempts. Request a new OTP.' });
    }

    stored.attempts++;
    if (stored.otp !== otp) {
        return res.status(400).json({ error: `Invalid OTP. ${5 - stored.attempts} attempts left.` });
    }

    otpStore.delete(email);
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '1d' });

    console.log(`✅ ${email} authenticated`);
    res.json({ success: true, token, email });
});

// ─── Check Auth ──────────────────────────────────
app.get('/api/check-auth', requireAuth, (req, res) => {
    res.json({ authenticated: true, email: req.userEmail });
});

// ─── Logout ──────────────────────────────────────
app.post('/api/logout', (req, res) => {
    // With JWT, logout is primarily handled client-side by deleting the token.
    res.json({ success: true });
});

// ─── Leads (Protected) ──────────────────────────
app.get('/api/leads', requireAuth, async (req, res) => {
    try {
        const auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        const result = await sheets.spreadsheets.values.get({
            spreadsheetId: SHEET_ID,
            range: 'Leads!A1:P',
        });

        const rows = result.data.values;
        if (!rows || rows.length === 0) return res.json({ headers: [], leads: [], total: 0 });

        const headers = rows[0];
        const leads = rows.slice(1).map((row, idx) => {
            const obj = { _sheetRow: idx + 2 }; // Sheet row is 1-indexed, +1 for header = idx+2
            headers.forEach((h, i) => { obj[h] = row[i] || ''; });
            return obj;
        });
        res.json({ headers, leads, total: leads.length });
    } catch (err) {
        console.error("❌ Sheet error:", err.message);
        res.status(500).json({ error: err.message, headers: [], leads: [], total: 0 });
    }
});

// ─── Save Notes (Protected) ──────────────────────
app.post('/api/leads/notes', requireAuth, async (req, res) => {
    try {
        const { sheetRow, notes } = req.body;
        if (!sheetRow) return res.status(400).json({ error: 'Missing sheet row' });

        const auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT,
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });
        const sheets = google.sheets({ version: 'v4', auth });
        
        await sheets.spreadsheets.values.update({
            spreadsheetId: SHEET_ID,
            range: `Leads!P${sheetRow}`, // Column P is the 'Notes' column
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [[notes || '']] }
        });

        res.json({ success: true });
    } catch (err) {
        console.error("❌ Save notes error:", err.message);
        res.status(500).json({ error: 'Failed to save notes' });
    }
});

// ─── Start ───────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Spirelia CRM running on port ${PORT}`);
    console.log(`🔒 Allowed: ${ALLOWED_EMAILS.join(', ')}\n`);
});
