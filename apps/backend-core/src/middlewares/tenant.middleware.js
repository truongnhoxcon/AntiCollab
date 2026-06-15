const db = require('../config/db');

/**
 * Middleware to enforce multi-tenant isolation.
 * Resolves the server_id (directly or through channel_id) and verifies if the authenticated
 * user is a registered member of that server.
 */
module.exports = async (req, res, next) => {
  try {
    const userId = req.user ? req.user.id : null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized: User authentication required' });
    }

    let serverId = req.params.serverId || req.body.server_id || req.body.serverId || req.query.server_id || req.query.serverId;
    const channelId = req.params.channelId || req.body.channel_id || req.body.channelId || req.query.channel_id || req.query.channelId;

    // Resolve serverId from channelId if serverId is not directly supplied
    if (!serverId && channelId) {
      // Basic uuid validation regex to prevent database errors for bad inputs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(channelId)) {
        return res.status(400).json({ error: 'Invalid channel ID format' });
      }

      const channelResult = await db.query(
        'SELECT server_id FROM channels WHERE id = $1',
        [channelId]
      );
      
      if (channelResult.rowCount === 0) {
        return res.status(404).json({ error: 'Channel not found' });
      }
      serverId = channelResult.rows[0].server_id;
    }

    if (!serverId) {
      return res.status(400).json({ error: 'Missing server_id or channel_id' });
    }

    // Basic uuid validation for serverId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID format' });
    }

    // Query server_members mapping to check membership
    const memberResult = await db.query(
      'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
      [serverId, userId]
    );

    if (memberResult.rowCount === 0) {
      return res.status(403).json({ error: 'Access denied: You are not a member of this server' });
    }

    // Attach resolved IDs and membership role to the request context
    req.serverId = serverId;
    req.memberRole = memberResult.rows[0].role;

    next();
  } catch (error) {
    console.error('Error in tenant isolation middleware:', error);
    return res.status(500).json({ error: 'Internal server error during tenant authorization check' });
  }
};
