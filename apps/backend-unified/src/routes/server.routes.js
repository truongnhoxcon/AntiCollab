const express = require('express');
const router = express.Router();
const serverController = require('../controllers/server.controller');
const channelController = require('../controllers/channel.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const tenantMiddleware = require('../middlewares/tenant.middleware');
const upload = require('../middlewares/upload.middleware');

// Get all servers user is a member of (authentication required)
router.get('/', authMiddleware, serverController.getUserServers);

// Create a new server (authentication required)
router.post('/', authMiddleware, serverController.createServer);

// Join an existing server (authentication required)
router.post('/join', authMiddleware, serverController.joinServer);

// Create a channel within a server (authentication + tenant check required)
router.post('/:serverId/channels', authMiddleware, tenantMiddleware, channelController.createChannel);

// Fetch WebRTC ICE / STUN / TURN credentials (authentication + tenant check required)
router.get('/:serverId/voice-credentials', authMiddleware, tenantMiddleware, serverController.getVoiceCredentials);

// Get/Update server member profiles
router.get('/:serverId/members/me', authMiddleware, tenantMiddleware, serverController.getServerMemberProfile);
router.put('/:serverId/members/me', authMiddleware, tenantMiddleware, serverController.updateServerMemberProfile);
router.patch('/:serverId/members/me', authMiddleware, tenantMiddleware, upload.single('avatar'), serverController.updateServerMemberProfileMultipart);
router.get('/:serverId/members/:userId', authMiddleware, tenantMiddleware, serverController.getServerMemberSpecificProfile);
router.get('/:serverId/members', authMiddleware, tenantMiddleware, serverController.getServerMembers);

module.exports = router;
