const db = require('../config/db');

/**
 * Create a new channel within a server.
 * Route: POST /api/servers/:serverId/channels
 */
async function createChannel(req, res) {
  try {
    const { name, type } = req.body;
    const serverId = req.serverId; // Populated by tenant middleware

    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    const channelType = type || 'text';
    if (!['text', 'voice'].includes(channelType)) {
      return res.status(400).json({ error: 'Channel type must be either "text" or "voice"' });
    }

    const result = await db.query(
      'INSERT INTO channels (name, server_id, type) VALUES ($1, $2, $3) RETURNING id, name, server_id, type, created_at',
      [name.trim(), serverId, channelType]
    );

    return res.status(201).json({
      message: 'Channel created successfully',
      channel: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        serverId: result.rows[0].server_id,
        type: result.rows[0].type,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error('Error during channel creation:', error);
    return res.status(500).json({ error: 'Internal server error during channel creation' });
  }
}

/**
 * Retrieve message history for a channel with cursor-based pagination.
 * Route: GET /api/channels/:channelId/messages
 * Query Parameters:
 *   - limit: number of messages to fetch (default: 50, max: 100)
 *   - cursor: ISO timestamp string of the last message's created_at (exclusive)
 */
async function getChannelMessages(req, res) {
  try {
    const { channelId } = req.params;
    let { limit = 50, cursor } = req.query;

    limit = parseInt(limit, 10);
    if (isNaN(limit) || limit <= 0) {
      limit = 50;
    }
    limit = Math.min(limit, 100); // Enforce max limit of 100

    let queryText;
    let queryParams;

    if (cursor) {
      // Validate cursor is a valid date
      const parsedDate = new Date(cursor);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ error: 'Invalid cursor timestamp format' });
      }

      queryText = `
        SELECT m.id, m.content, m.created_at, m.channel_id, m.server_id,
               u.id as sender_id, u.username as sender_username
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.channel_id = $1 AND m.created_at < $2
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $3
      `;
      queryParams = [channelId, parsedDate.toISOString(), limit];
    } else {
      queryText = `
        SELECT m.id, m.content, m.created_at, m.channel_id, m.server_id,
               u.id as sender_id, u.username as sender_username
        FROM messages m
        LEFT JOIN users u ON m.sender_id = u.id
        WHERE m.channel_id = $1
        ORDER BY m.created_at DESC, m.id DESC
        LIMIT $2
      `;
      queryParams = [channelId, limit];
    }

    const result = await db.query(queryText, queryParams);
    const messages = result.rows.map((row) => ({
      id: row.id,
      content: row.content,
      createdAt: row.created_at,
      channelId: row.channel_id,
      serverId: row.server_id,
      sender: {
        id: row.sender_id,
        username: row.sender_username,
      },
    }));

    // Determine next cursor
    let nextCursor = null;
    if (messages.length > 0 && messages.length === limit) {
      // The last element's timestamp becomes the next cursor
      nextCursor = messages[messages.length - 1].createdAt;
    }

    return res.status(200).json({
      messages,
      pagination: {
        limit,
        nextCursor,
      },
    });
  } catch (error) {
    console.error('Error fetching message history:', error);
    return res.status(500).json({ error: 'Internal server error during message fetch' });
  }
}

module.exports = {
  createChannel,
  getChannelMessages,
};
