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

// ALB liveness probe – instant 200, no dependency checks.
// The realtime target group health_check.path is "/health" on port 4000.
// Querying DB or Redis here would cause the task to be marked unhealthy during
// any backing-service blip and trigger unnecessary container replacements.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Alias under the Socket.io path prefix for completeness.
app.get('/ws/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
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
    
    // 3. Start server – bind to 0.0.0.0 so the ALB and container network
    //    can reach the process (binding to localhost/127.0.0.1 would block
    //    any traffic originating from outside the container).
    return new Promise((resolve) => {
      server.listen(port, '0.0.0.0', () => {
        console.log(`Real-time WebSocket server is listening on 0.0.0.0:${port} (Path: /ws)`);
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
