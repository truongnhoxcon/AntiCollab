const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const tenantMiddleware = require('../middlewares/tenant.middleware');

/**
 * Pre-middleware to map S3 upload/download bodies into standard format 
 * so tenantMiddleware can inspect membership for the target server/channel.
 */
const resolveS3Tenant = (req, res, next) => {
  try {
    const { action, channelId, key } = req.body;
    
    if (action === 'upload') {
      if (!channelId) {
        return res.status(400).json({ error: 'channelId is required' });
      }
      req.body.channelId = channelId;
    } else if (action === 'download') {
      if (!key) {
        return res.status(400).json({ error: 'key is required' });
      }
      // Parse key structure: server-{serverId}/channels/{channelId}/{uuid}-{filename}
      const parts = key.split('/');
      if (parts.length >= 4 && parts[0].startsWith('server-')) {
        req.body.serverId = parts[0].replace('server-', '');
      } else {
        return res.status(400).json({ error: 'Invalid file key format' });
      }
    }
    next();
  } catch (error) {
    console.error('Error resolving S3 tenant parameters:', error);
    return res.status(500).json({ error: 'Failed to pre-process S3 request credentials' });
  }
};

// POST /api/files/presign
router.post('/presign', authMiddleware, resolveS3Tenant, tenantMiddleware, fileController.generatePresignedUrl);

module.exports = router;
