# Scalability & Cost Analysis (Spirelia CRM V2)

This document breaks down the current capacity of your **Free Tier Architecture** and estimates the costs required to scale up to enterprise-level volume.

---

## 🟢 1. Current Capacity (The "Free" Setup)
Currently, you are running on 100% free tiers: Google Apps Script (Personal), Mistral AI (Free API), Render (Free Web Service), and Brevo (Free SMTP).

### What can it handle right now?
*   **Google Apps Script (Personal Account)**:
    *   **Limit**: Scripts can only run for a maximum of **6 minutes per execution**, with a total of **90 minutes of run-time per day**. You also have a limit of 20,000 API calls (URL Fetches) per day.
    *   **Capacity**: You can process roughly **50 to 100 emails per run** (depending on how fast Mistral responds) before the 6-minute timeout hits. Over a whole day, you can comfortably process **~500 to 800 leads daily** without paying Google.
*   **Mistral AI API (Free Tier)**:
    *   **Limit**: Mistral's free tier has strict rate limits (usually 1 request per second) and monthly caps. If you process emails too quickly, you get a `429 Too Many Requests` error (which your script handles by pausing).
    *   **Capacity**: Good medium volume. Handling a batch of 50 emails will take a few minutes due to the built-in pauses to respect rate limits.
*   **Render Server (Dashboard Backend)**:
    *   **Limit**: Free tier provides 512MB RAM and "spins down" (goes to sleep) after 15 minutes of inactivity.
    *   **Capacity**: Perfect for a small team (1-5 users). The only downside is a **30-50 second delay** when loading the dashboard if no one has visited it recently (Cold Start).
*   **Brevo (OTP Emails)**:
    *   **Limit**: 300 emails per day.
    *   **Capacity**: Allows for 300 dashboard logins per day. More than enough for internal use.

---

## 🟡 2. When to Upgrade (The "Tipping Point")
You will need to start paying when:
1.  **Volume increases**: You receive more than 1,000 potential lead emails per day.
2.  **Timeouts occur**: The 6-minute Google Apps Script limit cuts off your processing before it finishes scanning your inbox.
3.  **Dashboard speed**: You get tired of waiting 40 seconds for the Render server to "wake up".

---

## 🔴 3. Future Scaling Costs (Estimates)
When you are ready to scale to handle **thousands of leads per day** with instant performance, here is the estimated budget:

### A. AI Processing (Mistral API) - *Pay-as-you-go*
If you upgrade to a paid Mistral account to remove rate limits, you pay per token.
*   *Assumption*: 1 Email = ~1000 input tokens (prompt + email body) and ~250 output tokens (JSON).
*   *Mistral Large Pricing*: ~$2.00 per 1M input tokens, ~$6.00 per 1M output tokens.
*   *Cost per lead*: Roughly **$0.0035 per email processed**.
*   **Estimated Cost**: 
    *   Processing **1,000 leads/month** = **~$3.50 / month**
    *   Processing **10,000 leads/month** = **~$35.00 / month**

### B. Automation (Google Workspace)
To increase your Google Apps Script daily limits from 90 minutes/day to 6 hours/day, you need a Google Workspace account (instead of a personal @gmail.com account).
*   **Estimated Cost**: Google Workspace Business Starter = **$6.00 / month per user**.

### C. Dashboard Server (Render)
To stop the server from going to sleep (eliminating the cold-start delay) and provide enough RAM for multiple simultaneous users filtering the dashboard.
*   **Estimated Cost**: Render "Starter" Web Service = **$7.00 / month**.

### D. OTP Emails (Brevo)
If your team grows and you need more than 300 logins per day.
*   **Estimated Cost**: Brevo Starter Plan (10k emails/mo) = **$9.00 / month**. *(You probably won't need this for a long time).*

---

## 💰 Total Estimated Scaling Budget
To move from a "Hobby/Free" setup to a **Production-Ready Enterprise setup handling ~3,000 leads a month**:

| Service | Upgrade Plan | Monthly Cost |
| :--- | :--- | :--- |
| **Mistral AI** | Pay-as-you-go (~3k leads) | ~$10.50 |
| **Google** | Workspace Starter | $6.00 |
| **Render** | Starter Web Service (No sleep) | $7.00 |
| **Brevo** | Free Tier (300/day is enough)| $0.00 |
| **TOTAL** | | **~$23.50 / month** |

### 🚀 Conclusion
The current free architecture is incredibly capable, easily handling **500+ leads daily**. 
When your business scales, the entire CRM pipeline can be upgraded to handle massive enterprise volumes for **less than $25 a month**—a fraction of the cost of commercial software like Salesforce or Apollo.
