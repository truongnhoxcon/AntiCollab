const express = require('express');
const router = express.Router();
const serverController = require('../controllers/server.controller');
const channelController = require('../controllers/channel.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const tenantMiddleware = require('../middlewares/tenant.middleware');

// Get all servers user is a member of (authentication required)
router.get('/', authMiddleware, serverController.getUserServers);

// Create a new server (authentication required)
router.post('/', authMiddleware, serverController.createServer);

// Create a channel within a server (authentication + tenant check required)
router.post('/:serverId/channels', authMiddleware, tenantMiddleware, channelController.createChannel);

// Fetch WebRTC ICE / STUN / TURN credentials (authentication + tenant check required)
router.get('/:serverId/voice-credentials', authMiddleware, tenantMiddleware, serverController.getVoiceCredentials);

module.exports = router;
