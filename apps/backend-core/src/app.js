const express = require('express');
const db = require('./config/db');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const serverRoutes = require('./routes/server.routes');
const channelRoutes = require('./routes/channel.routes');
const fileRoutes = require('./routes/file.routes');
const userRoutes = require('./routes/user.routes');

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

// ALB and ECS service health check endpoints
app.get('/health', async (req, res) => {
  try {
    // Check PostgreSQL connection pool
    await db.query('SELECT 1');
    return res.status(200).json({ status: 'UP', database: 'connected' });
  } catch (error) {
    console.error('Health check failed:', error);
    return res.status(500).json({ status: 'DOWN', database: 'disconnected', error: error.message });
  }
});

// Duplicate route for '/api/health' verification matches smoke tests
app.get('/api/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    return res.status(200).json({ status: 'UP', database: 'connected' });
  } catch (error) {
    return res.status(500).json({ status: 'DOWN', database: 'disconnected', error: error.message });
  }
});

// Register api routes
app.use('/api/auth', authRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/users', userRoutes);

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
  app.listen(PORT, () => {
    console.log(`Core Backend service is running on port ${PORT}`);
  });
}

module.exports = app;
