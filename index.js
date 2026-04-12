const express = require('express');
const axios = require('axios');
const fs = require('fs');

const app = express();
app.use(express.json());

const BRIGHTREPLY_URL = process.env.BRIGHTREPLY_URL;
const BRIGHTSALES_URL = process.env.BRIGHTSALES_URL;
const BRIGHTTRADE_V1_URL = process.env.BRIGHTTRADE_V1_URL;
const BRIGHTTRADE_V2_URL = process.env.BRIGHTTRADE_V2_URL;
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const NOTES_FILE = 'notes.json';
const REVENUE_FILE = 'revenue.json';
const SUGGESTIONS_FILE = 'suggestions.json';

function loadJSON(file, def) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch(e) { return def; }
}

function saveJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadNotes() { return loadJSON(NOTES_FILE, []); }
function saveNotes(n) { saveJSON(NOTES_FILE, n); }
function loadRevenue() { return loadJSON(REVENUE_FILE, { monthly: {}, daily: [] }); }
function saveRevenue(r) { saveJSON(REVENUE_FILE, r); }
function loadSuggestions() { return loadJSON(SUGGESTIONS_FILE, []); }
function saveSuggestions(s) { saveJSON(SUGGESTIONS_FILE, s); }

async function fetchSafe(url, path = '') {
  try {
    const res = await axios.get(url + path, { timeout: 5000 });
    return res.data;
  } catch(e) { return null; }
}

async function gatherData() {
  const [reply, sales, tradeV1, tradeV2] = await Promise.all([
    fetchSafe(BRIGHTREPLY_URL, '/clients'),
    fetchSafe(BRIGHTSALES_URL, '/conversations'),
    fetchSafe(BRIGHTTRADE_V1_URL, '/api/data'),
    fetchSafe(BRIGHTTRADE_V2_URL, '/api/state')
  ]);

  const clients = reply?.clients || [];
  const activeClients = clients.filter(c => c.active);
  const closedDeals = sales?.closedDeals || [];
  const cancelledClients = sales?.cancelledClients || [];
  const leads = sales?.leads || [];
  const conversations = sales?.conversations || {};
  const clientStatuses = sales?.clientStatuses || {};
  const pendingAssignment = sales?.pendingAssignment || [];

  const replied = Object.values(conversations).filter(c =>
    c.messages && c.messages.length > 1 &&
    c.messages[c.messages.length-1].role === 'user'
  ).length;

  const paidClients = closedDeals.filter(d => clientStatuses[d.phone] === 'paid').length;
  const trialClients = closedDeals.filter(d => clientStatuses[d.phone] === 'trial' || clientStatuses[d.phone] === 'pending').length;
  const monthlyRevenue = paidClients * 29;

  const v1Decision = tradeV1?.lastDecision;
  const v2Decision = tradeV2?.last_analysis;

  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);
  const revenue = loadRevenue();

  if (!revenue.monthly[month]) revenue.monthly[month] = 0;
  revenue.monthly[month] = monthlyRevenue;

  const todayEntry = revenue.daily.find(d => d.date === today);
  if (todayEntry) {
    todayEntry.revenue = monthlyRevenue;
    todayEntry.clients = activeClients.length;
    todayEntry.leads = leads.length;
  } else {
    revenue.daily.push({ date: today, revenue: monthlyRevenue, clients: activeClients.length, leads: leads.length });
    if (revenue.daily.length > 90) revenue.daily.shift();
  }
  saveRevenue(revenue);

  return {
    brightreply: { activeClients: activeClients.length, totalClients: clients.length, clients: activeClients.slice(0, 10) },
    brightsales: { totalLeads: leads.length, replied, closedDeals: closedDeals.length, paidClients, trialClients, cancelledClients: cancelledClients.length, monthlyRevenue, pendingAssignment: pendingAssignment.length, recentDeals: closedDeals.slice(-5).reverse() },
    trading: {
      v1: { position: tradeV1?.position || null, decision: v1Decision?.decision || null, confidence: v1Decision?.confidence || null, reason: v1Decision?.reason || null, timestamp: v1Decision?.timestamp || null },
      v2: { position: tradeV2?.current_position || null, decision: v2Decision?.decision || null, confidence: v2Decision?.confidence || null, reason: v2Decision?.reason || null, timestamp: v2Decision?.timestamp || null }
    },
    revenue: { monthly: revenue.monthly, daily: revenue.daily.slice(-30), currentMonth: monthlyRevenue },
    notes: loadNotes(),
    suggestions: loadSuggestions(),
    fetchedAt: new Date().toISOString()
  };
}

async function generateSuggestions(data) {
  const prompt = `You are a confident business partner AI for Callum, a young entrepreneur in Wales.

Current business data:
- BrightReply: ${data.brightreply.activeClients} active clients, ${data.brightreply.totalClients} total
- BrightSales: ${data.brightsales.totalLeads} leads, ${data.brightsales.replied} replied, ${data.brightsales.closedDeals} deals closed, ${data.brightsales.paidClients} paying at £29/month = £${data.brightreply.activeClients * 29}/month
- Pending number assignments: ${data.brightsales.pendingAssignment}
- Trading V1: ${data.trading.v1.position || 'no position'}, confidence ${data.trading.v1.confidence || 0}/10
- Trading V2: ${data.trading.v2.position || 'no position'}, confidence ${data.trading.v2.confidence || 0}/10
- Monthly revenue: £${data.brightsales.monthlyRevenue}

Generate 3 specific actionable suggestions based on this data. Be confident, direct and casual. No fluff.

Return JSON array only:
[
  {"title": "short title", "suggestion": "2-3 sentence specific suggestion", "priority": "high/medium/low", "category": "sales/trading/operations/growth"},
  ...
]`;

  try {
    const res = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
    });
    const raw = res.data.content[0].text.replace(/```json|```/g, '').trim();
    const suggestions = JSON.parse(raw);
    const existing = loadSuggestions();
    const newSuggestions = suggestions.map(s => ({
      ...s,
      id: Date.now() + Math.random(),
      createdAt: new Date().toISOString(),
      status: 'active'
    }));
    const merged = [...newSuggestions, ...existing.filter(s => s.status === 'done')].slice(0, 20);
    saveSuggestions(merged);
    return merged;
  } catch(e) {
    console.error('Suggestions error:', e.message);
    return loadSuggestions();
  }
}

app.get('/api/data', async (req, res) => {
  const data = await gatherData();
  res.json(data);
});

app.get('/api/suggestions/refresh', async (req, res) => {
  const data = await gatherData();
  const suggestions = await generateSuggestions(data);
  res.json({ suggestions });
});

app.post('/api/suggestions/:id/done', (req, res) => {
  const id = parseFloat(req.params.id);
  const suggestions = loadSuggestions();
  const s = suggestions.find(s => s.id === id);
  if (s) s.status = 'done';
  saveSuggestions(suggestions);
  res.json({ success: true });
});

app.delete('/api/suggestions/:id', (req, res) => {
  const id = parseFloat(req.params.id);
  const suggestions = loadSuggestions().filter(s => s.id !== id);
  saveSuggestions(suggestions);
  res.json({ success: true });
});

app.post('/api/notes', (req, res) => {
  const { text, category } = req.body;
  if (!text) return res.json({ success: false });
  const notes = loadNotes();
  notes.unshift({ id: Date.now(), text, category: category || 'general', createdAt: new Date().toISOString() });
  if (notes.length > 100) notes.pop();
  saveNotes(notes);
  res.json({ success: true });
});

app.delete('/api/notes/:id', (req, res) => {
  const id = parseInt(req.params.id);
  saveNotes(loadNotes().filter(n => n.id !== id));
  res.json({ success: true });
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.json({ reply: 'Say something!' });
  const data = await gatherData();
  const notes = loadNotes().slice(0, 5).map(n => n.text).join(', ');
  const suggestions = loadSuggestions().filter(s => s.status === 'active').slice(0, 3).map(s => s.suggestion).join(' | ');
  const revenue = data.revenue;
  const months = Object.entries(revenue.monthly).slice(-3).map(([m, v]) => `${m}: £${v}`).join(', ');

  const context = `You are Max — BrightHQ AI business partner for Callum, a young entrepreneur in Wales building multiple income streams.

Your personality:
- Confident and direct — say what you actually think
- Chill and casual — like a smart mate who knows business
- Give simple honest breakdowns — no jargon
- Proactive — bring up things they haven't asked
- Occasionally funny but not forced
- When asked about trading money: recommend starting with £200-300, never more than 10-15% per trade, only scale up after 4-6 weeks profitable paper trading

Current business snapshot:
- BrightReply: ${data.brightreply.activeClients} active clients
- BrightSales: ${data.brightsales.totalLeads} leads, ${data.brightsales.replied} replied, ${data.brightsales.closedDeals} deals, ${data.brightsales.paidClients} paying = £${data.brightsales.monthlyRevenue}/month
- Trading V1: ${data.trading.v1.position || 'no position'} (${data.trading.v1.confidence || 0}/10 confidence)
- Trading V2: ${data.trading.v2.position || 'no position'} (${data.trading.v2.confidence || 0}/10 confidence)
- Revenue history: ${months || 'just starting'}
- Recent notes: ${notes || 'none'}
- Active suggestions: ${suggestions || 'none'}

Reply naturally. Keep it concise unless they want detail. Always end with one useful observation or next step.`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: context + '\n\nCallum: ' + message }]
    }, {
      headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
    });
    res.json({ reply: response.data.content[0].text });
  } catch(e) {
    res.json({ reply: 'Something went wrong — try again!' });
  }
});

app.get('/', (req, res) => {
  if (fs.existsSync('dashboard.html')) {
    res.send(fs.readFileSync('dashboard.html', 'utf8'));
  } else {
    res.send('BrightHQ loading...');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('BrightHQ running on port', PORT));
