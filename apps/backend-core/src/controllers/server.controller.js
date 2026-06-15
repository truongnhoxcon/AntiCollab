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

module.exports = {
  createServer,
  getVoiceCredentials,
};

