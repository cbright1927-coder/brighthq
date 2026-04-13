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

const { MongoClient } = require('mongodb');
const MONGODB_URI = process.env.MONGODB_URI;

let db;
let notesCol;
let revenueCol;
let suggestionsCol;
let memoryCol;
let rundownCol;

const TEST_NUMBERS = ['+447863782938', '+447782217884'];
async function connectDB() {
  try {
    const mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
    await mongoClient.connect();
    db = mongoClient.db('brighthq');
    notesCol = db.collection('notes');
    revenueCol = db.collection('revenue');
    suggestionsCol = db.collection('suggestions');
    memoryCol = db.collection('memory');
    rundownCol = db.collection('rundown');
    console.log('MongoDB connected');
  } catch(e) {
    console.error('MongoDB error:', e.message);
  }
}

async function loadNotes() {
  try { return await notesCol.find({}).sort({ createdAt: -1 }).toArray(); }
  catch(e) { return []; }
}
async function saveNotes(notes) {
  try {
    await notesCol.deleteMany({});
    if(notes.length) await notesCol.insertMany(notes);
  } catch(e) { console.error('Save notes error:', e.message); }
}
async function loadRevenue() {
  try {
    const doc = await revenueCol.findOne({ _id: 'revenue' });
    return doc || { monthly: {}, daily: [] };
  } catch(e) { return { monthly: {}, daily: [] }; }
}
async function saveRevenue(r) {
  try {
    await revenueCol.replaceOne({ _id: 'revenue' }, { _id: 'revenue', ...r }, { upsert: true });
  } catch(e) { console.error('Save revenue error:', e.message); }
}
async function loadSuggestions() {
  try {
    const doc = await suggestionsCol.findOne({ _id: 'suggestions' });
    return doc?.data || [];
  } catch(e) { return []; }
}
async function saveSuggestions(s) {
  try {
    await suggestionsCol.replaceOne({ _id: 'suggestions' }, { _id: 'suggestions', data: s }, { upsert: true });
  } catch(e) { console.error('Save suggestions error:', e.message); }
}
async function loadMemory() {
  try {
    const doc = await memoryCol.findOne({ _id: 'memory' });
    return doc?.data || [];
  } catch(e) { return []; }
}
async function saveMemory(m) {
  try {
    await memoryCol.replaceOne({ _id: 'memory' }, { _id: 'memory', data: m }, { upsert: true });
  } catch(e) { console.error('Save memory error:', e.message); }
}

function nextTradingDay() {
  const now = new Date();
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = ny.getDay();
  const h = ny.getHours();
  const m = ny.getMinutes();
  const mins = h * 60 + m;
  let target = new Date(ny);
  target.setSeconds(0); target.setMilliseconds(0);
  if (day >= 1 && day <= 5 && mins < 570) {
    target.setHours(9); target.setMinutes(30);
  } else {
    let daysAhead = 1;
    if (day === 5 && mins >= 570) daysAhead = 3;
    else if (day === 6) daysAhead = 2;
    else if (day === 0) daysAhead = 1;
    target.setDate(target.getDate() + daysAhead);
    target.setHours(9); target.setMinutes(30);
  }
  const diff = target - ny;
  return { ms: diff, target: target.toISOString() };
}

async function fetchSafe(url, path = '') {
  try {
    const res = await axios.get(url + path, { timeout: 5000 });
    return res.data;
  } catch(e) { return null; }
}

async function gatherData() {
  const [reply, sales, tradeV1, tradeV2] = await Promise.all([
    fetchSafe(BRIGHTREPLY_URL, '/clients-full'),
    fetchSafe(BRIGHTSALES_URL, `/conversations?key=${process.env.BRIGHTSALES_KEY}`),
    fetchSafe(BRIGHTTRADE_V1_URL, '/api/data'),
    fetchSafe(BRIGHTTRADE_V2_URL, '/api/state')
  ]);

  const allClients = reply?.clients || [];
  const clients = allClients.filter(c => c.active && !TEST_NUMBERS.includes(c.twilioNumber));
  const closedDeals = (sales?.closedDeals || []).filter(d => !TEST_NUMBERS.includes(d.phone));
  const cancelledClients = sales?.cancelledClients || [];
  const leads = (sales?.leads || []).filter(l => !TEST_NUMBERS.includes(l.phone));
  const conversations = sales?.conversations || {};
  const clientStatuses = sales?.clientStatuses || {};
  const pendingAssignment = sales?.pendingAssignment || [];

  const contacted = Object.values(conversations).filter(c => c.messages && c.messages.length >= 1).length;
const replied = Object.values(conversations).filter(c =>
    c.messages && c.messages.length > 1 &&
    c.messages[c.messages.length-1].role === 'user'
  ).length;

  const paidClients = closedDeals.filter(d => clientStatuses[d.phone] === 'paid').length;
  const trialClients = closedDeals.filter(d =>
    clientStatuses[d.phone] === 'trial' || clientStatuses[d.phone] === 'pending'
  ).length;
  const monthlyRevenue = paidClients * 14.99;

  const clientsWithTimers = closedDeals.map(d => {
    const closedAt = new Date(d.closedAt);
    const trialEnd = new Date(closedAt.getTime() + 14 * 24 * 60 * 60 * 1000);
    const now = new Date();
    const trialMsLeft = trialEnd - now;
    const status = clientStatuses[d.phone] || 'trial';
    let nextPayment = null;
    if (status === 'paid') {
      const dayOfMonth = closedAt.getDate();
      const next = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      nextPayment = next.toISOString();
    }
    return {
      name: d.name, type: d.type, phone: d.phone, twilioNumber: d.twilioNumber,
      closedAt: d.closedAt, status, trialEndsAt: trialEnd.toISOString(),
      trialMsLeft: Math.max(0, trialMsLeft), trialActive: trialMsLeft > 0 && status !== 'paid',
      nextPayment
    };
  });

  const v1Decision = tradeV1?.lastDecision;
  const v2Decision = tradeV2?.last_analysis;

  const today = new Date().toISOString().split('T')[0];
  const month = today.slice(0, 7);
  const revenue = await loadRevenue();
  if (!revenue.monthly[month]) revenue.monthly[month] = 0;
  revenue.monthly[month] = monthlyRevenue;
  const todayEntry = revenue.daily.find(d => d.date === today);
  if (todayEntry) {
    todayEntry.revenue = monthlyRevenue;
    todayEntry.clients = clients.length;
    todayEntry.leads = leads.length;
  } else {
    revenue.daily.push({ date: today, revenue: monthlyRevenue, clients: clients.length, leads: leads.length });
    if (revenue.daily.length > 90) revenue.daily.shift();
  }
  saveRevenue(revenue);

  const trading = nextTradingDay();

  return {
    brightreply: { activeClients: clients.length, totalClients: clients.length, clients: clients.slice(0, 10) },
    brightsales: { totalLeads: Math.max(0, leads.length - contacted), contacted, replied, closedDeals: closedDeals.length, paidClients, trialClients, cancelledClients: cancelledClients.length, monthlyRevenue, pendingAssignment: pendingAssignment.length, recentDeals: closedDeals.slice(-5).reverse() },
    trading: {
      v1: { position: tradeV1?.position || null, decision: v1Decision?.decision || null, confidence: v1Decision?.confidence || null, reason: v1Decision?.reason || null, timestamp: v1Decision?.timestamp || null },
      v2: { position: tradeV2?.current_position || null, decision: v2Decision?.decision || null, confidence: v2Decision?.confidence || null, reason: v2Decision?.reason || null, timestamp: v2Decision?.timestamp || null },
      nextTradingMs: trading.ms,
      nextTradingTarget: trading.target
    },
    revenue: { monthly: revenue.monthly, daily: revenue.daily.slice(-30), currentMonth: monthlyRevenue },
    clientsWithTimers,
inventory: sales?.twilioInventory || [],
    notes: await loadNotes(),
    suggestions: await loadSuggestions(),
    fetchedAt: new Date().toISOString()
  };
}

async function generateSuggestions(data) {
  const existing = await loadSuggestions();
  const doneItems = existing.filter(s => s.status === 'done').map(s => s.title).join(', ') || 'none';
  const notes = (await loadNotes()).slice(0, 10).map(n => n.text).join(' | ') || 'none';

  const prompt = `You are Max, a confident business partner AI for Callum in Wales.

Business data:
- BrightReply: ${data.brightreply.activeClients} real active clients
- BrightSales: ${data.brightsales.totalLeads} leads, ${data.brightsales.replied} replied, ${data.brightsales.closedDeals} deals, ${data.brightsales.paidClients} paying = £${data.brightsales.monthlyRevenue}/month
- Pending assignments: ${data.brightsales.pendingAssignment}
- Trading V1: ${data.trading.v1.position || 'no position'} confidence ${data.trading.v1.confidence || 0}/10
- Trading V2: ${data.trading.v2.position || 'no position'} confidence ${data.trading.v2.confidence || 0}/10
- Monthly revenue: £${data.brightsales.monthlyRevenue}
- Clients on trial: ${data.brightsales.trialClients}

Callum's notes: ${notes}
Already done or dismissed: ${doneItems}

Give 3 specific actionable suggestions that are NEW and not already covered in the notes or done list. Be direct and casual. No fluff.

Return JSON array only:
[{"title":"short title","suggestion":"2-3 sentence suggestion","priority":"high/medium/low","category":"sales/trading/operations/growth"}]`;

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
    const newOnes = suggestions.map(s => ({ ...s, id: Date.now() + Math.random(), createdAt: new Date().toISOString(), status: 'active' }));
    const pinned = existing.filter(s => s.pinned && s.status === 'active');
const merged = [...pinned, ...newOnes, ...existing.filter(s => s.status === 'done')].slice(0, 20);
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

app.post('/api/find-leads', async (req, res) => {
  const { town, type } = req.body;
  try {
    const result = await axios.post(`${BRIGHTSALES_URL}/find-leads`, { town, type });
    res.json(result.data);
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});
app.post('/api/set-auto-buy', async (req, res) => {
  const { enabled } = req.body;
  try {
    const result = await axios.post(`${BRIGHTSALES_URL}/set-auto-buy`, { enabled });
    res.json(result.data);
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});
app.post('/api/cancel-client', async (req, res) => {
  const { twilioNumber } = req.body;
  try {
    const result = await axios.post(`${BRIGHTREPLY_URL}/cancel-client`, { twilioNumber });
    res.json(result.data);
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});
app.post('/api/update-message', async (req, res) => {
  const { twilioNumber, message } = req.body;
  try {
    const result = await axios.post(`${BRIGHTREPLY_URL}/update-message`, { twilioNumber, message });
    res.json(result.data);
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});
app.post('/api/add-inventory', async (req, res) => {
  const { number, friendlyName } = req.body;
  try {
    const result = await axios.post(`${BRIGHTSALES_URL}/add-inventory`, { number, friendlyName });
    res.json(result.data);
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});
app.post('/api/start-outreach', async (req, res) => {
  const { limit } = req.body || {};
  try {
    await axios.post(`${BRIGHTSALES_URL}/start-outreach`, { limit: limit || 10 });
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/api/suggestions/refresh', async (req, res) => {
  const data = await gatherData();
  const suggestions = await generateSuggestions(data);
  res.json({ suggestions });
});

app.post('/api/suggestions/:id/pin', async (req, res) => {
  const id = parseFloat(req.params.id);
  const { pinned } = req.body;
  const s = await loadSuggestions();
  const found = s.find(x => x.id === id);
  if (found) found.pinned = pinned;
  saveSuggestions(s);
  res.json({ success: true });
});
app.post('/api/suggestions/:id/done', async (req, res) => {
  const id = parseFloat(req.params.id);
  const s = await loadSuggestions();
  const found = s.find(x => x.id === id);
  if (found) found.status = 'done';
  saveSuggestions(s);
  res.json({ success: true });
});

app.delete('/api/suggestions/:id', async (req, res) => {
  saveSuggestions((await loadSuggestions()).filter(s => s.id !== parseFloat(req.params.id)));
  res.json({ success: true });
});

app.post('/api/notes', async (req, res) => {
  const { text, category } = req.body;
  if (!text) return res.json({ success: false });
  const notes = await loadNotes();
  notes.unshift({ id: Date.now(), text, category: category || 'general', createdAt: new Date().toISOString() });
  if (notes.length > 100) notes.pop();
  saveNotes(notes);
  res.json({ success: true });
});

app.delete('/api/notes/:id', async (req, res) => {
  saveNotes((await loadNotes()).filter(n => n.id !== parseInt(req.params.id)));
  res.json({ success: true });
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.json({ reply: 'Say something!' });

  const data = await gatherData();
  const memory = (await loadMemory()).slice(-20);
  const notes = (await loadNotes()).slice(0, 5).map(n => n.text).join(', ');
  const suggestions = (await loadSuggestions()).filter(s => s.status === 'active').slice(0, 3).map(s => s.suggestion).join(' | ');
  const months = Object.entries(data.revenue.monthly).slice(-3).map(([m, v]) => `${m}: £${v}`).join(', ');

  const systemPrompt = `You are Max — Callum's AI business partner. You're like a smart mate who genuinely knows his business inside out.

Personality:
- Chill and direct — talk like a friend, not a corporate bot
- Confident — give actual opinions, don't sit on the fence
- Professional when it matters — like when discussing money or strategy
- Funny sometimes but not forced
- Short answers unless they ask for detail
- Use "mate" occasionally but don't overdo it
- On trading money: start with £200-300, never more than 10-15% per trade, scale up only after 4-6 weeks profitable paper trading

Business snapshot:
- BrightReply: ${data.brightreply.activeClients} real clients (test numbers excluded)
- BrightSales: ${data.brightsales.totalLeads} leads, ${data.brightsales.replied} replied today, ${data.brightsales.closedDeals} deals, ${data.brightsales.paidClients} paying = £${data.brightsales.monthlyRevenue}/month
- Clients on trial: ${data.brightsales.trialClients}
- Trading V1: ${data.trading.v1.position || 'no position'} (${data.trading.v1.confidence || 0}/10)
- Trading V2: ${data.trading.v2.position || 'no position'} (${data.trading.v2.confidence || 0}/10)
- Revenue history: ${months || 'just starting out'}
- Notes: ${notes || 'none'}
- Active suggestions: ${suggestions || 'none'}

Always end with one useful next step or observation. Keep it real.`;

  const messages = [...memory, { role: 'user', content: message }];

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: systemPrompt,
      messages
    }, {
      headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
    });

    const reply = response.data.content[0].text;
    memory.push({ role: 'user', content: message });
    memory.push({ role: 'assistant', content: reply });
    saveMemory(memory.slice(-40));
    res.json({ reply });
  } catch(e) {
    res.json({ reply: 'Something went wrong — try again!' });
  }
});

app.get('/api/daily-rundown', async (req, res) => {
  let savedRundown = { text: null, date: null, trigger: null };
try {
  const doc = await rundownCol.findOne({ _id: 'rundown' });
  if(doc) savedRundown = doc;
} catch(e) {}
const saved = savedRundown;
  const today = new Date().toISOString().split('T')[0];
  const force = req.query.force === 'true';

  if (!force && saved.date === today && saved.text) {
    return res.json({ rundown: saved.text, cached: true });
  }

  const data = await gatherData();
  const prompt = `You are Max, Callum's business partner AI. Give a quick casual daily rundown of what's happening across all his projects. Keep it short — 3-4 sentences max. Be chill and friendly like a mate. Mention anything important like clients on trial ending soon, bot positions, leads that replied. End with one thing to focus on today.

Data:
- BrightReply: ${data.brightreply.activeClients} active clients
- BrightSales: ${data.brightsales.totalLeads} leads, ${data.brightsales.replied} replied, £${data.brightsales.monthlyRevenue}/month revenue
- Clients on trial: ${data.brightsales.trialClients}
- Trading V1: ${data.trading.v1.position || 'no position'} (${data.trading.v1.confidence || 0}/10)
- Trading V2: ${data.trading.v2.position || 'no position'} (${data.trading.v2.confidence || 0}/10)
- Pending number assignments: ${data.brightsales.pendingAssignment}`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }]
    }, {
      headers: { 'x-api-key': CLAUDE_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }
    });
    const text = response.data.content[0].text;
    await rundownCol.replaceOne({ _id: 'rundown' }, { _id: 'rundown', text, date: today, trigger: req.query.trigger || 'manual' }, { upsert: true });
    res.json({ rundown: text, cached: false });
  } catch(e) {
    res.json({ rundown: saved.text || 'Could not load rundown.' });
  }
});

app.post('/api/rundown/refresh', async (req, res) => {
  const { trigger } = req.body || {};
  const url = `http://localhost:${PORT}/api/daily-rundown?force=true&trigger=${trigger||'event'}`;
  try {
    const result = await axios.get(url);
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false });
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
async function start() {
  await connectDB();
  app.listen(PORT, () => console.log('BrightHQ running on port', PORT));
}
start();
