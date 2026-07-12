const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
require('dotenv').config();

// ── Routes từ backend-core ──────────────────────────────────────────────────
const authRoutes    = require('./routes/auth.routes');
const serverRoutes  = require('./routes/server.routes');
const channelRoutes = require('./routes/channel.routes');
const fileRoutes    = require('./routes/file.routes');
const userRoutes    = require('./routes/user.routes');
const friendsRoutes = require('./routes/friends.routes');

// ── Handlers từ backend-realtime ────────────────────────────────────────────
const socketAuthMiddleware = require('./middlewares/socketAuth.middleware');
const { registerChatHandler, registerRedisMessageSubscriber }       = require('./handlers/chat.handler');
const { registerPresenceHandler, registerRedisPresenceSubscriber }  = require('./handlers/presence.handler');
const { registerWebRTCHandler }                                      = require('./signaling/webrtc.handler');
const { connectAll }                                                  = require('./config/redis');

const PORT = process.env.PORT || 3000;

// ── Express + HTTP server ───────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);  // Socket.io cần http.Server, không phải app trực tiếp

// ── Socket.io ───────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/ws',
  transports: ['websocket', 'polling'],
});

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  registerChatHandler(io, socket);
  registerPresenceHandler(io, socket);
  registerWebRTCHandler(io, socket);
});

// ── Express middleware ──────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[HTTP] ${req.method} ${req.url} - Length: ${req.headers['content-length'] || 0}`);
  next();
});
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── Health checks ───────────────────────────────────────────────────────────
// Một endpoint /health phục vụ cả hai ALB target groups (cùng 1 port)
app.get('/health',      (req, res) => res.status(200).json({ status: 'UP' }));
app.get('/api/health',  (req, res) => res.status(200).json({ status: 'UP' }));
app.get('/ws/health',   (req, res) => res.status(200).json({ status: 'UP' }));

// ── REST routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',    authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/channels',channelRoutes);
app.use('/api/files',   fileRoutes);
app.use('/api/users',   userRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/uploads', express.static(path.join(__dirname, '../public/uploads')));

// ── Error handlers ──────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Endpoint not found' }));
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Startup ─────────────────────────────────────────────────────────────────
async function startServer() {
  // 1. Bind port TRƯỚC để ALB health check không fail trong lúc khởi động
  await new Promise((resolve) => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Unified backend listening on 0.0.0.0:${PORT}`);
      resolve();
    });
  });

  // 2. Connect Redis (non-blocking — lỗi không crash server)
  try {
    await connectAll();
    registerRedisMessageSubscriber(io);
    registerRedisPresenceSubscriber(io);
    console.log('Redis connected, Pub/Sub ready.');
  } catch (err) {
    console.error('Redis connect failed, will retry:', err.message);
  }

  // 3. DB migration (non-blocking — lỗi không crash server)
  const db = require('./config/db');
  db.runMigration().catch((err) => {
    console.error('DB migration failed:', err.message);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { app, server, io };
