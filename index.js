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

function loadNotes() {
  try {
    return JSON.parse(fs.readFileSync(NOTES_FILE, 'utf8'));
  } catch(e) {
    return [];
  }
}

function saveNotes(notes) {
  fs.writeFileSync(NOTES_FILE, JSON.stringify(notes, null, 2));
}

async function fetchSafe(url, path = '') {
  try {
    const res = await axios.get(url + path, { timeout: 5000 });
    return res.data;
  } catch(e) {
    return null;
  }
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
  const replied = Object.values(conversations).filter(c =>
    c.messages && c.messages.length > 1 &&
    c.messages[c.messages.length-1].role === 'user'
  ).length;
  const clientStatuses = sales?.clientStatuses || {};
  const paidClients = closedDeals.filter(d => clientStatuses[d.phone] === 'paid').length;
  const monthlyRevenue = paidClients * 29;

  const v1Decision = tradeV1?.lastDecision;
  const v2Decision = tradeV2?.last_analysis;

  return {
    brightreply: {
      activeClients: activeClients.length,
      totalClients: clients.length,
      clients: activeClients.slice(0, 5)
    },
    brightsales: {
      totalLeads: leads.length,
      replied,
      closedDeals: closedDeals.length,
      paidClients,
      cancelledClients: cancelledClients.length,
      monthlyRevenue,
      recentDeals: closedDeals.slice(-3).reverse()
    },
    trading: {
      v1: {
        position: tradeV1?.position || null,
        decision: v1Decision?.decision || null,
        confidence: v1Decision?.confidence || null,
        reason: v1Decision?.reason || null,
        timestamp: v1Decision?.timestamp || null
      },
      v2: {
        position: tradeV2?.current_position || null,
        decision: v2Decision?.decision || null,
        confidence: v2Decision?.confidence || null,
        reason: v2Decision?.reason || null,
        timestamp: v2Decision?.timestamp || null
      }
    },
    notes: loadNotes(),
    fetchedAt: new Date().toISOString()
  };
}

app.get('/api/data', async (req, res) => {
  const data = await gatherData();
  res.json(data);
});

app.post('/api/notes', (req, res) => {
  const { text, category } = req.body;
  if (!text) return res.json({ success: false });
  const notes = loadNotes();
  notes.unshift({
    id: Date.now(),
    text,
    category: category || 'general',
    createdAt: new Date().toISOString()
  });
  if (notes.length > 100) notes.pop();
  saveNotes(notes);
  res.json({ success: true });
});

app.delete('/api/notes/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const notes = loadNotes().filter(n => n.id !== id);
  saveNotes(notes);
  res.json({ success: true });
});

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.json({ reply: 'Say something!' });

  const data = await gatherData();
  const notes = loadNotes().slice(0, 5).map(n => n.text).join(', ');

  const context = `You are the BrightHQ AI assistant for a small business owner called Callum based in Wales.

Current business snapshot:
- BrightReply: ${data.brightreply.activeClients} active clients
- BrightSales: ${data.brightsales.totalLeads} leads, ${data.brightsales.replied} replied today, ${data.brightsales.closedDeals} deals closed, ${data.brightsales.paidClients} paying clients, £${data.brightsales.monthlyRevenue}/month revenue
- Trading V1: Position ${data.trading.v1.position || 'none'}, Last decision: ${data.trading.v1.decision || 'none'} (${data.trading.v1.confidence || 0}/10)
- Trading V2: Position ${data.trading.v2.position || 'none'}, Last decision: ${data.trading.v2.decision || 'none'} (${data.trading.v2.confidence || 0}/10)
- Recent notes: ${notes || 'none'}

Your personality:
- Chill and friendly like a smart mate who knows business
- Give honest casual reviews — dont sugarcoat
- Keep answers concise unless asked for detail
- Use simple language, no jargon
- Occasionally throw in light humour
- Always end with one useful suggestion or observation`;

  try {
    const response = await axios.post('https://api.anthropic.com/v1/messages', {
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{ role: 'user', content: context + '\n\nUser: ' + message }]
    }, {
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
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
