# BrightHQ — Session Briefing for Claude

Hi, I'm Callum, a young entrepreneur in Wales building multiple income streams. Paste this at the start of every new Claude conversation so it knows the full setup.

---

## Projects & URLs

| Project | Repo | Live URL |
|---|---|---|
| BrightReply | missed-call-server | https://missed-call-server-production.up.railway.app |
| BrightSales | brightsales | https://brightsales-production-454f.up.railway.app |
| BrightTrade V1 | trading-bot | https://trading-bot-production-ec62.up.railway.app |
| BrightTrade V2 | brighttrade-v2 | https://brighttrade-v2-production.up.railway.app |
| BrightHQ | brighthq | https://brighthq-production.up.railway.app |

---

## How Each Project Works

### BrightReply (missed-call-server)
- Auto-texts customers who call a business and get no answer
- Clients forward missed calls to their dedicated Twilio number
- Server identifies client by Twilio number and sends their custom SMS
- Key files: index.js
- Endpoints: /call, /add-client, /cancel-client, /clients, /stripe-webhook

### BrightSales (brightsales)
- AI cold outreach to local businesses via SMS
- AI handles full conversation and closes deals
- When deal closes: waits for Twilio number assignment before sending setup guide
- Number inventory system — buy numbers in bulk, assign when deal closes
- Auto-buy toggle — automatically buys Twilio number when inventory empty
- Key files: index.js, dashboard.html, leads.json
- Endpoints: /sms, /start-outreach, /conversations, /add-lead, /add-inventory, /assign-number, /update-status, /send-payment-link, /search, /set-auto-buy
- Stripe link: https://buy.stripe.com/7sY3cw9EL1tj3Cj4kq83C00 (£29/month, 14-day trial)

### BrightTrade V1 (trading-bot)
- Simple daily trading bot — TQQQ/SQQQ switching
- Uses moving average + Claude AI decision
- Runs weekdays 9:30am ET (2:30pm UK)
- Paper trading on Alpaca
- Key files: index.js

### BrightTrade V2 (brighttrade-v2)
- Professional trading bot
- Uses EMA + RSI + VWAP + news sentiment + 2-layer AI
- Runs weekdays 9:30am ET (2:30pm UK)
- Paper trading on Alpaca
- Key files: main.py, dashboard.html
- Language: Python

### BrightHQ (brighthq)
- Unified dashboard for all projects
- Max AI — business partner with memory, daily rundown, suggestions
- Sidebar navigation, space constellation background with shooting stars
- Pages: HQ, Reply, Sales, Trade, Think
- Key files: index.js, dashboard.html, notes.json, revenue.json, suggestions.json, memory.json, rundown.json
- Endpoints: /api/data, /api/chat, /api/daily-rundown, /api/notes, /api/suggestions

---

## Infrastructure

- Hosting: Railway (all services in one project)
- GitHub: all repos auto-deploy on commit
- Telegram bot: @Brighttrade_callum_bot
- Twilio numbers: +447863782938 (test/BrightReply), +447782217884 (sales outreach)
- These are TEST numbers — never assign to real clients
- Alpaca: paper trading account at https://paper-api.alpaca.markets
- Stripe: live mode, £29/month product

---

## Business Model

- Service: BrightReply missed call SMS
- Price: £29/month per client
- Cost: ~£1/month Twilio number per client
- Profit: ~£28/month per client
- Target market: hair salons, tradespeople in Wales

---

## Key Technical Notes

- When editing files: always paste the current file here first so Claude can see it
- When Claude says "find and replace": use Ctrl+F in GitHub editor to find exact text
- Railway variables are set in each service's Variables tab
- All services use in-memory storage (data resets on restart) except BrightHQ which uses JSON files
- BrightHQ filters out test numbers from client counts

---

## Current Session

**Date:** [fill in]
**What I want to do today:** [fill in]
**Any recent changes:** [fill in]
**Any issues:** [fill in]
