const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const db = require('./config/db');
const { connectAll, isConnected } = require('./config/redis');
const socketAuthMiddleware = require('./middlewares/socketAuth.middleware');
const { registerChatHandler, registerRedisMessageSubscriber } = require('./handlers/chat.handler');
const { registerPresenceHandler, registerRedisPresenceSubscriber } = require('./handlers/presence.handler');
const { registerWebRTCHandler } = require('./signaling/webrtc.handler');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io Server
// ALB routes "/ws/*" to this backend, so we configure Socket.io path to "/ws"
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  path: '/ws',
  transports: ['websocket', 'polling'],
});

// Attach JWT Handshake middleware for authentication
io.use(socketAuthMiddleware);

// Handle WebSocket connections
io.on('connection', (socket) => {
  console.log(`Socket connection initiated. ID: ${socket.id}`);

  // Register events handlers
  registerChatHandler(io, socket);
  registerPresenceHandler(io, socket);
  registerWebRTCHandler(io, socket);
});

// Simple HTTP health check endpoint for ALB target group
app.get('/health', async (req, res) => {
  try {
    // Check DB
    await db.query('SELECT 1');
    // Check Redis
    const redisOk = isConnected();
    
    return res.status(200).json({
      status: 'UP',
      postgres: 'healthy',
      redis: redisOk ? 'healthy' : 'unhealthy',
    });
  } catch (err) {
    console.error('Health check failed for realtime backend:', err.message);
    return res.status(500).json({
      status: 'DOWN',
      error: err.message,
    });
  }
});

// Duplicate route for '/ws/health' matching path-based ALB configs if needed
app.get('/ws/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    return res.status(200).json({ status: 'UP', postgres: 'healthy', redis: isConnected() ? 'healthy' : 'unhealthy' });
  } catch (err) {
    return res.status(500).json({ status: 'DOWN', error: err.message });
  }
});

/**
 * Connect to backing storage and start the HTTP server.
 * 
 * @param {number} port 
 */
async function startServer(port) {
  try {
    // 1. Connect Redis clients
    console.log('Connecting to Redis...');
    await connectAll();
    
    // 2. Register Redis Pub/Sub event sync subscribers
    registerRedisMessageSubscriber(io);
    registerRedisPresenceSubscriber(io);
    
    // 3. Start server
    return new Promise((resolve) => {
      server.listen(port, () => {
        console.log(`Real-time WebSocket server is listening on port ${port} (Path: /ws)`);
        resolve(server);
      });
    });
  } catch (err) {
    console.error('Failed to initialize server resources:', err);
    throw err;
  }
}

module.exports = {
  app,
  server,
  io,
  startServer,
};
