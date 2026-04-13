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
- CHANGE keyword — client texts CHANGE to their Twilio number to update their auto-reply message
- Key files: index.js
- Endpoints: /call, /sms, /add-client, /cancel-client, /clients, /clients-full, /update-message, /stripe-webhook

### BrightSales (brightsales)
- AI cold outreach to local businesses via SMS
- AI handles full conversation and closes deals
- When deal closes: waits for Twilio number assignment before sending setup guide
- Number inventory system — buy numbers in bulk, assign when deal closes
- Auto-buy toggle — automatically buys Twilio number when inventory empty
- Auto lead finder — uses Google Places API to find businesses by town and type
- Outreach limit — controls how many leads get messaged at once
- Declined leads — businesses that say no get permanently blacklisted
- All data saved to MongoDB — survives redeploys
- Key files: index.js, dashboard.html
- Endpoints: /sms, /start-outreach, /conversations, /add-lead, /add-inventory, /assign-number, /update-status, /send-payment-link, /search, /set-auto-buy, /find-leads, /remove-deal
- Stripe link: £14.99/month, 14-day free trial
- Google Places API key: GOOGLE_PLACES_KEY in Railway
- Security: /conversations endpoint protected by API_KEY variable

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
- PIN protected — 4 digit PIN on load (currently 1927)
- Max AI — business partner with memory, daily rundown, suggestions
- Suggestions read notes and avoid repeating done/dismissed items
- Pinned suggestions survive refresh
- Right sidebar navigation
- Space constellation background with shooting stars
- Fireworks when new client lands or trade confidence hits 8+
- Page transitions — smooth fade and slide
- Auto lead finder — search by town and business type
- Start outreach button with limit control
- Number inventory management with auto-buy toggle
- Client database — edit messages, cancel clients
- Client timers — trial countdowns and payment due dates
- Trading countdown to next market open
- Revenue history by month
- Contacted counter — tracks messaged but not yet replied leads
- All data saved to MongoDB — notes, suggestions, memory, revenue survive redeploys
- Pages: HQ, Reply, Sales, Trade, Think
- Key files: index.js, dashboard.html

---

## Infrastructure

- Hosting: Railway (all services in one project)
- GitHub: all repos auto-deploy on commit
- MongoDB Atlas: free tier, both brightsales and brighthq connected
  - brightsales db: conversations, deals, leads, declined, inventory all saved
  - brighthq db: notes, suggestions, memory, revenue, rundown all saved
- Telegram bot: @Brighttrade_callum_bot
- Twilio numbers: +447863782938 (test/BrightReply), +447782217884 (sales outreach)
- These are TEST numbers — never assign to real clients
- Alpaca: paper trading account at https://paper-api.alpaca.markets
- Stripe: live mode, £14.99/month product
- Google Places API: restricted to Places API only
- Node version: 20.11.0 (set via .node-version file in each repo)

---

## Railway Variables

### brightsales
- TWILIO_SID, TWILIO_TOKEN, SALES_NUMBER, CLAUDE_API_KEY
- TELEGRAM_TOKEN, TELEGRAM_CHAT_ID
- BRIGHTREPLY_URL, STRIPE_PAYMENT_LINK
- MONGODB_URI, GOOGLE_PLACES_KEY
- API_KEY (protects /conversations endpoint)

### brighthq
- BRIGHTREPLY_URL, BRIGHTSALES_URL, BRIGHTTRADE_V1_URL, BRIGHTTRADE_V2_URL
- CLAUDE_API_KEY, MONGODB_URI
- BRIGHTSALES_KEY (same value as API_KEY in brightsales)

---

## Business Model

- Service: BrightReply missed call SMS
- Price: £14.99/month per client
- Cost: ~£1/month Twilio number per client
- Profit: ~£13.99/month per client
- Target market: hair salons, beauty salons, plumbers in Wales
- Outreach: AI cold SMS via BrightSales, limit 10 per day to start
- Growth plan: increase outreach limit as revenue grows

---

## Key Technical Notes

- When editing files: always paste the current file here first so Claude can see it
- When Claude says find and replace: use Ctrl+F in GitHub editor
- Railway variables are set in each service Variables tab
- MongoDB Atlas: free tier, IP access set to 0.0.0.0/0
- BrightHQ filters out test numbers from client counts
- Daily rundown cached — only regenerates once per day
- Leads saved to MongoDB leadsCol in brightsales
- State (conversations, deals, declined etc) saved to stateCol in brightsales

---

## Sales Flow

1. Lead finder adds businesses to MongoDB
2. Start outreach — AI messages leads with opening message
3. AI handles full conversation automatically
4. When deal closes — Telegram alert to assign Twilio number
5. Assign number in HQ — setup guide sent automatically with CHANGE keyword instructions
6. Client activates call forwarding on their phone
7. After 14 days — send payment link manually from app
8. Mark as paid in app

---

## IMPORTANT — Outreach Issues Found

### SMS too long — MUST FIX BEFORE NEXT OUTREACH
- Current opening message is ~190 characters — splits into 4 SMS segments
- Twilio charges per segment — costs 4x more and looks spammy
- Most businesses ignored messages because of this
- Fix: shorten opening message to under 160 characters
- New message to use (under 160 chars):
  "Hi! Do you ever miss calls at [name]? I help local salons auto-text customers back so you don't lose them. Free trial — worth a chat?"

### Landline filtering — add before next outreach
- +441633 numbers are Newport landlines — cannot receive SMS
- Shows as Undelivered in Twilio
- Fix: only message numbers starting with +447 (mobiles)
- Add to startOutreach function: if (!lead.phone.startsWith('+447')) skip

### First outreach results
- ~90 businesses contacted on 13 April 2026
- Mix of hair salons, beauty salons, plumbers in Newport/Cwmbran area
- Most messages delivered but zero replies so far
- Likely due to long message being flagged as spam
- Wait 24-48 hours for any late replies before sending more

---

## Pending / Next Steps — DO THESE NEXT SESSION

1. **FIX OPENING MESSAGE** — shorten to under 160 chars in brightsales index.js
2. **ADD MOBILE FILTER** — skip non +447 numbers in startOutreach
3. **Buy a real Twilio number** for inventory before assigning to first real client
4. **Check for replies** — any responses from first outreach batch
5. **Trading bot results** — check Telegram for Monday 2:30pm alerts
6. Add business type categories to leads view in HQ
7. Future: Google review bot, landing page, referral scheme
8. **Build Lessons database** — add to Think page in BrightHQ
   - Log mistakes, learnings, what worked
   - Categories: outreach, tech, trading, operations
   - Max reads lessons when making suggestions so he never repeats bad advice
   - First entries to add: SMS too long (460-612 chars, need under 160), landlines waste money (skip non +447)
9. **Improve pre-market news analysis** — in BrightTrade V2
    - 5 mins before market open fetch last 24hrs financial news
    - Summarise key events (Fed news, CPI, earnings, geopolitical)
    - Feed summary into AI decision as extra context
    - Should improve trade quality significantly
---
Dev Tools & Automation Setup
Claude Code
Install: npm install -g @anthropic-ai/claude-code
Use instead of copy-pasting code into GitHub
Run in terminal inside any repo folder
Claude reads all files, edits directly, commits and pushes
Railway auto-deploys on every push — no manual steps
Cost: Included in Claude Pro ($20/month) — you likely already pay this

CLAUDE.md (per repo memory)
Create a file called CLAUDE.md in the root of each repo
Paste the relevant section of this briefing into it
Claude Code reads it automatically every session
No more pasting briefing at the start of every chat
Cost: Free — just a file in your repo

Workflow Change (old vs new)
Old: Ask Claude → copy output → paste into GitHub editor → commit → wait
New: Open terminal in repo → run claude → describe change → Claude edits, commits, Railway deploys
Key rule: Always paste full file contents when asking for code changes in chat
Key rule: Ask for diffs not full rewrites when making small changes

Claude in Chrome (optional, later)
Browser extension — Claude can see and click your Railway, MongoDB, Twilio, Stripe dashboards
Good for: checking logs, managing inventory, reviewing conversations hands-free
Cost: Free beta currently
Hold off until Claude Code workflow is solid

Artifacts + Claude API (build tools in chat)
Claude can build full interactive React/HTML apps in this chat window
These can call the Claude API themselves — AI-powered mini apps with no backend needed
Good for: landing pages, SMS message builders, client portals, internal tools
Cost: Free to build here — Claude API calls use your existing CLAUDE_API_KEY

Cost Summary
Claude Code: free with Claude Pro (~$20/month)
CLAUDE.md: completely free
Claude in Chrome: free beta
Artifacts: free to build, API calls use existing key
Total extra cost: £0 — all covered by existing Claude Pro sub

## Current Session

**Date:** [fill in]
**What I want to do today:** [fill in]
**Any recent changes:** [fill in]
**Any issues:** [fill in]
