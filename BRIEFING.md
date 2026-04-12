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
- Auto lead finder — uses Google Places API to find businesses by town and type
- Outreach limit — controls how many leads get messaged at once
- Key files: index.js, dashboard.html, leads.json
- Endpoints: /sms, /start-outreach, /conversations, /add-lead, /add-inventory, /assign-number, /update-status, /send-payment-link, /search, /set-auto-buy, /find-leads
- Stripe link: £14.99/month, 14-day free trial
- Google Places API key added as GOOGLE_PLACES_KEY in Railway

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
- Right sidebar navigation with touch interactions and glow effects
- Space constellation background with shooting stars that react to touch
- Fireworks animation when new client lands or trade confidence hits 8+
- Page transitions — smooth fade and slide
- Auto lead finder built in — search by town and business type
- Start outreach button with limit control
- Number inventory management with auto-buy toggle
- Client timers — trial countdowns and payment due dates
- Trading countdown to next market open
- Revenue history by month
- Pages: HQ, Reply, Sales, Trade, Think
- Key files: index.js, dashboard.html, notes.json, revenue.json, suggestions.json, memory.json, rundown.json
- Endpoints: /api/data, /api/chat, /api/daily-rundown, /api/notes, /api/suggestions, /api/find-leads, /api/start-outreach, /api/add-inventory, /api/set-auto-buy

---

## Infrastructure

- Hosting: Railway (all services in one project)
- GitHub: all repos auto-deploy on commit
- Telegram bot: @Brighttrade_callum_bot — token: 8681510450:AAGjQPhXxPWt2VVfT-1t4Wg9GqbRmOK0-XE — chat ID: 8659994812
- Twilio numbers: +447863782938 (test/BrightReply), +447782217884 (sales outreach)
- These are TEST numbers — never assign to real clients
- Alpaca: paper trading account at https://paper-api.alpaca.markets
- Stripe: live mode, £14.99/month product
- Google Places API: restricted to Places API only

---

## Business Model

- Service: BrightReply missed call SMS
- Price: £14.99/month per client
- Cost: ~£1/month Twilio number per client
- Profit: ~£13.99/month per client
- Target market: hair salons, independent tradespeople in Wales
- Outreach: AI cold SMS via BrightSales, limit 10 per day to start
- Growth plan: increase outreach limit as revenue grows

---

## Key Technical Notes

- When editing files: always paste the current file here first so Claude can see it
- When Claude says find and replace: use Ctrl+F in GitHub editor
- Railway variables are set in each service Variables tab
- All services use in-memory storage except BrightHQ which uses JSON files
- BrightHQ filters out test numbers from client counts
- Daily rundown is cached — only regenerates once per day or on major events

---

## Pending / Next Steps

- Sort page colours on non-HQ pages — still a bit dark
- Monday 9am — first outreach to 10 leads
- Monday 2:30pm — first trading bot alerts — check Telegram
- After first clients — increase outreach limit gradually
- Future ideas: Google review bot, appointment reminders, social media poster
## Pending / Next Steps

- Set up MongoDB Atlas for persistent storage in brightsales
  - Currently data.json resets on every Railway redeploy
  - Conversations, declined, deals, inventory all need to move to MongoDB
  - Free tier on MongoDB Atlas is sufficient
  - This is the most important technical fix before scaling outreach
- Sort page colours on non-HQ pages — still a bit dark
- Monday 9am — first outreach to 10 leads (DO NOT redeploy during outreach day)
- Monday 2:30pm — first trading bot alerts — check Telegram
- After first clients — increase outreach limit gradually
- Future ideas: Google review bot, appointment reminders, social media poster
---

## Current Session

**Date:** [fill in]
**What I want to do today:** [fill in]
**Any recent changes:** [fill in]
**Any issues:** [fill in]
