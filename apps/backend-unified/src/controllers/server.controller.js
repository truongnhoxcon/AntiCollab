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

/**
 * Join an existing Server/Workspace.
 * Adds the authenticated user to the server_members table.
 */
async function joinServer(req, res) {
  try {
    const { serverId } = req.body;
    const userId = req.user.id;

    if (!serverId) {
      return res.status(400).json({ error: 'Server ID or invite link is required' });
    }

    // Extract server ID from link if it is a URL
    let parsedId = serverId.trim();
    if (parsedId.includes('/invite/')) {
      parsedId = parsedId.split('/invite/').pop();
    }

    // UUID regex pattern to validate if it's a valid UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(parsedId)) {
      // Fallback: search for first server in database
      const firstServerResult = await db.query('SELECT id, name FROM servers LIMIT 1');
      if (firstServerResult.rows.length > 0) {
        parsedId = firstServerResult.rows[0].id;
      } else {
        return res.status(404).json({ error: 'No servers available to join' });
      }
    }

    // Check if server exists
    const serverResult = await db.query('SELECT id, name FROM servers WHERE id = $1', [parsedId]);
    if (serverResult.rows.length === 0) {
      return res.status(404).json({ error: 'Server not found' });
    }
    const targetServer = serverResult.rows[0];

    // Check if user is already a member
    const memberCheck = await db.query(
      'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
      [targetServer.id, userId]
    );

    if (memberCheck.rows.length > 0) {
      return res.status(200).json({
        message: 'You are already a member of this server',
        server: {
          id: targetServer.id,
          name: targetServer.name
        }
      });
    }

    // Insert user as member
    await db.query(
      'INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, $3)',
      [targetServer.id, userId, 'member']
    );

    return res.status(201).json({
      message: 'Joined server successfully',
      server: {
        id: targetServer.id,
        name: targetServer.name
      }
    });
  } catch (error) {
    console.error('Error joining server:', error);
    return res.status(500).json({ error: 'Internal server error during joining server' });
  }
}

async function getServerMemberProfile(req, res) {
  try {
    const { serverId } = req.params;
    const userId = req.user.id;

    const result = await db.query(
      'SELECT nickname, avatar, about_me as "aboutMe" FROM server_members WHERE server_id = $1 AND user_id = $2',
      [serverId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in this server' });
    }

    const profile = result.rows[0];
    return res.status(200).json({
      nickname: profile.nickname || '',
      avatar: profile.avatar || '',
      aboutMe: profile.aboutMe || ''
    });
  } catch (error) {
    console.error('Error fetching server member profile:', error);
    return res.status(500).json({ error: 'Internal server error fetching member profile' });
  }
}

async function updateServerMemberProfile(req, res) {
  try {
    const { serverId } = req.params;
    const userId = req.user.id;
    const { nickname, avatar, aboutMe } = req.body;

    const result = await db.query(
      `UPDATE server_members 
       SET nickname = $1, avatar = $2, about_me = $3 
       WHERE server_id = $4 AND user_id = $5 
       RETURNING nickname, avatar, about_me as "aboutMe"`,
      [nickname || '', avatar || '', aboutMe || '', serverId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found in this server' });
    }

    return res.status(200).json({
      message: 'Server profile updated successfully',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating server member profile:', error);
    return res.status(500).json({ error: 'Internal server error updating member profile' });
  }
}

async function getServerMembers(req, res) {
  try {
    const { serverId } = req.params;
    const result = await db.query(
      `SELECT u.id, u.username, u.email, sm.role, sm.nickname, sm.avatar, sm.about_me as "aboutMe"
       FROM server_members sm
       JOIN users u ON sm.user_id = u.id
       WHERE sm.server_id = $1`,
      [serverId]
    );
    return res.status(200).json(result.rows);
  } catch (error) {
    return res.status(500).json({ error: 'Internal server error fetching members' });
  }
}

async function updateServerMemberProfileMultipart(req, res) {
  try {
    const { serverId } = req.params;
    const userId = req.user.id;
    const { nickname, aboutMe, removeAvatar } = req.body;
    let avatarUrl = undefined;

    // Check if file was uploaded
    if (req.file) {
      avatarUrl = `/uploads/${req.file.filename}`;
    } else if (removeAvatar === 'true') {
      avatarUrl = '';
    }

    // Retrieve current values first to handle optional parameters
    const currentResult = await db.query(
      'SELECT nickname, avatar, about_me as "aboutMe" FROM server_members WHERE server_id = $1 AND user_id = $2',
      [serverId, userId]
    );

    if (currentResult.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found in this server' });
    }

    const currentProfile = currentResult.rows[0];
    const finalNickname = nickname !== undefined ? nickname : currentProfile.nickname;
    const finalAboutMe = aboutMe !== undefined ? aboutMe : currentProfile.aboutMe;
    const finalAvatarUrl = avatarUrl !== undefined ? avatarUrl : currentProfile.avatar;

    const result = await db.query(
      `UPDATE server_members 
       SET nickname = $1, avatar = $2, about_me = $3 
       WHERE server_id = $4 AND user_id = $5 
       RETURNING nickname, avatar, about_me as "aboutMe"`,
      [finalNickname || '', finalAvatarUrl || '', finalAboutMe || '', serverId, userId]
    );

    return res.status(200).json({
      message: 'Server profile updated successfully',
      profile: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating server member profile:', error);
    return res.status(500).json({ error: 'Internal server error updating member profile' });
  }
}

async function getServerMemberSpecificProfile(req, res) {
  try {
    const { serverId, userId } = req.params;

    // Query combination of user table and server member table
    const result = await db.query(
      `SELECT 
        u.id, 
        u.username,
        COALESCE(NULLIF(sm.nickname, ''), NULLIF(u.display_name, ''), u.username) AS "displayName",
        COALESCE(NULLIF(sm.avatar, ''), u.avatar_url) AS "avatarUrl",
        COALESCE(NULLIF(sm.about_me, ''), u.about_me) AS "aboutMe",
        u.banner_color AS "bannerColor",
        u.custom_status AS "customStatus"
      FROM users u
      LEFT JOIN server_members sm ON sm.user_id = u.id AND sm.server_id = $1
      WHERE u.id = $2`,
      [serverId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const profile = result.rows[0];
    return res.status(200).json({
      success: true,
      id: profile.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl || '',
      bannerColor: profile.bannerColor || '#5865F2',
      aboutMe: profile.aboutMe || '',
      customStatus: profile.customStatus || ''
    });
  } catch (error) {
    console.error('Error fetching server member specific profile:', error);
    return res.status(500).json({ error: 'Internal server error fetching member profile' });
  }
}

module.exports = {
  createServer,
  getVoiceCredentials,
  getUserServers,
  joinServer,
  getServerMemberProfile,
  updateServerMemberProfile,
  updateServerMemberProfileMultipart,
  getServerMemberSpecificProfile,
  getServerMembers,
};


