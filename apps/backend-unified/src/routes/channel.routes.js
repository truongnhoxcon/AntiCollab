const express = require('express');
const router = express.Router();
const channelController = require('../controllers/channel.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const tenantMiddleware = require('../middlewares/tenant.middleware');

// Fetch message history for a channel (authentication + tenant check via channel resolution)
router.get('/:channelId/messages', authMiddleware, tenantMiddleware, channelController.getChannelMessages);

module.exports = router;
