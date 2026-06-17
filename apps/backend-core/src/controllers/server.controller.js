const db = require('../config/db');
const twilioService = require('../services/twilio.service');

/**
 * Create a new Server/Workspace.
 * Automatically adds the creator as the Owner in the server_members table within a SQL Transaction.
 */
async function createServer(req, res) {
  const client = await db.getClient();
  try {
    const { name } = req.body;
    const userId = req.user.id;

    if (!name || name.trim() === '') {
      client.release();
      return res.status(400).json({ error: 'Server name is required' });
    }

    // Start Transaction
    await client.query('BEGIN');

    // 1. Insert new server
    const serverInsertResult = await client.query(
      'INSERT INTO servers (name, owner_id) VALUES ($1, $2) RETURNING id, name, owner_id, created_at',
      [name.trim(), userId]
    );
    const newServer = serverInsertResult.rows[0];

    // 2. Insert creator as owner in server_members mapping
    await client.query(
      'INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3)',
      [newServer.id, userId, 'owner']
    );

    // Commit Transaction
    await client.query('COMMIT');
    client.release();

    return res.status(201).json({
      message: 'Server created successfully',
      server: {
        id: newServer.id,
        name: newServer.name,
        ownerId: newServer.owner_id,
        createdAt: newServer.created_at,
      },
    });
  } catch (error) {
    // Rollback Transaction in case of errors
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Failed to rollback transaction:', rollbackError);
    }
    client.release();

    console.error('Error during server creation:', error);
    return res.status(500).json({ error: 'Internal server error during server creation' });
  }
}

/**
 * Get temporary voice connection credentials (STUN/TURN list).
 * Route: GET /api/servers/:serverId/voice-credentials
 */
async function getVoiceCredentials(req, res) {
  try {
    // tenant.middleware.js has validated that the user belongs to req.params.serverId
    const credentials = await twilioService.getIceCredentials();
    return res.status(200).json(credentials);
  } catch (error) {
    console.error('Error fetching voice credentials:', error);
    return res.status(500).json({ error: 'Failed to retrieve voice credentials' });
  }
}

/**
 * Get all servers the authenticated user is a member of, including all channels in each server.
 * Route: GET /api/servers
 */
async function getUserServers(req, res) {
  try {
    const userId = req.user.id;

    // 1. Fetch all servers user belongs to
    const serversResult = await db.query(
      `SELECT s.id, s.name, s.owner_id as "ownerId", s.created_at as "createdAt"
       FROM servers s
       JOIN server_members sm ON s.id = sm.server_id
       WHERE sm.user_id = $1
       ORDER BY s.created_at DESC`,
      [userId]
    );

    const servers = [];

    // 2. Fetch channels for each server
    for (const server of serversResult.rows) {
      const channelsResult = await db.query(
        `SELECT id, name, type, created_at as "createdAt"
         FROM channels
         WHERE server_id = $1
         ORDER BY created_at ASC`,
        [server.id]
      );

      servers.push({
        id: server.id,
        name: server.name,
        ownerId: server.ownerId,
        createdAt: server.createdAt,
        abbr: server.name.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3),
        channels: channelsResult.rows.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
          createdAt: c.createdAt
        }))
      });
    }

    return res.status(200).json(servers);
  } catch (error) {
    console.error('Error fetching user servers:', error);
    return res.status(500).json({ error: 'Internal server error during fetching servers' });
  }
}

module.exports = {
  createServer,
  getVoiceCredentials,
  getUserServers,
};


