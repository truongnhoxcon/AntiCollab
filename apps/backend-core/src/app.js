const express = require('express');
const db = require('./config/db');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const serverRoutes = require('./routes/server.routes');
const channelRoutes = require('./routes/channel.routes');
const fileRoutes = require('./routes/file.routes');
const userRoutes = require('./routes/user.routes');
const friendsRoutes = require('./routes/friends.routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable JSON parser middleware
app.use(express.json());

// Enable basic CORS headers manually to allow cross-origin client requests
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// ALB liveness probe – must respond instantly with 200 regardless of backing
// service state.  The ALB uses this to decide whether the container process is
// alive and should receive traffic.  A dependency check here (e.g. db.query)
// would cause healthy tasks to be killed whenever the DB has a blip.
// Use a separate /readyz or /api/health endpoint for deep dependency checks.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Convenience alias routed through the ALB /api/* listener rule so smoke tests
// that hit the ALB DNS directly can also reach a health endpoint.
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'UP' });
});

// Register api routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global unhandled error boundary
app.use((err, req, res, next) => {
  console.error('Global exception caught:', err);
  res.status(500).json({ error: 'Internal server error occurred' });
});

// Start listening if not required as a module (useful for testing)
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Core Backend service is running on 0.0.0.0:${PORT}`);
  });
}

module.exports = app;
