const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const DATA_FILE = path.join(__dirname, 'data', 'rooms.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'pousada2024';
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function readData() { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
function writeData(data) {
  data.updatedAt = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}
function broadcast(data) {
  const msg = JSON.stringify(data);
  wss.clients.forEach(c => { if (c.readyState === 1) c.send(msg); });
}
function adminAuth(req, res, next) {
  if (req.headers.password !== ADMIN_PASSWORD) return res.status(401).json({ error: 'Senha incorreta' });
  next();
}
function recalcStats(data) {
  const s = { ocupado: 0, disponivel: 0, limpeza: 0, manutencao: 0, reservado: 0 };
  data.rooms.forEach(r => { if (s[r.status] !== undefined) s[r.status]++; });
  data.stats = { ...data.stats, ...s };
}

app.get('/api/rooms', (req, res) => res.json(readData()));

app.put('/api/rooms/:id', adminAuth, (req, res) => {
  const data = readData();
  const idx = data.rooms.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Quarto não encontrado' });
  data.rooms[idx] = { ...data.rooms[idx], ...req.body };
  recalcStats(data);
  writeData(data);
  broadcast({ type: 'update', data });
  res.json({ success: true, room: data.rooms[idx] });
});

app.post('/api/auth', (req, res) => {
  res.json(req.body.password === ADMIN_PASSWORD ? { success: true } : res.status(401).json({ error: 'Senha incorreta' }));
});

wss.on('connection', ws => {
  ws.send(JSON.stringify({ type: 'connected', data: readData() }));
});

server.listen(PORT, () => {
  console.log(`\n🌿 Pousada Dashboard 3D`);
  console.log(`📺 Painel 3D:   http://localhost:${PORT}`);
  console.log(`📱 Equipe:      http://localhost:${PORT}/admin.html`);
  console.log(`🔑 Senha admin: ${ADMIN_PASSWORD}\n`);
});
