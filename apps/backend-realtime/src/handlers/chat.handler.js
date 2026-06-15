const db = require('../config/db');
const { pubClient, subClient } = require('../config/redis');

// Regex to validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Register chat socket events.
 * 
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - The connected socket client
 */
function registerChatHandler(io, socket) {
  
  // Event: Join Channel Room
  socket.on('join_channel', async ({ serverId, channelId }) => {
    try {
      const userId = socket.user.id;

      // Validate inputs
      if (!serverId || !channelId || !uuidRegex.test(serverId) || !uuidRegex.test(channelId)) {
        return socket.emit('error', { message: 'Invalid server_id or channel_id format' });
      }

      // 1. Verify User is a member of the server
      const memberCheck = await db.query(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [serverId, userId]
      );

      if (memberCheck.rowCount === 0) {
        return socket.emit('error', { message: 'Access denied: You are not a member of this server' });
      }

      // 2. Verify Channel belongs to the server
      const channelCheck = await db.query(
        'SELECT server_id FROM channels WHERE id = $1',
        [channelId]
      );

      if (channelCheck.rowCount === 0 || channelCheck.rows[0].server_id !== serverId) {
        return socket.emit('error', { message: 'Access denied: Channel does not belong to this server' });
      }

      // Join rooms: Channel room for chat, Server room for presence notifications
      socket.join(`channel:${channelId}`);
      socket.join(`server:${serverId}`);

      // Track active server for presence tracking on disconnect
      socket.currentServerId = serverId;

      console.log(`User ${socket.user.username} joined channel room "channel:${channelId}" and server room "server:${serverId}"`);
      socket.emit('joined_channel', { serverId, channelId });
    } catch (err) {
      console.error('Error handling join_channel:', err);
      socket.emit('error', { message: 'Internal server error while joining channel' });
    }
  });

  // Event: Send Chat Message
  socket.on('send_message', async ({ serverId, channelId, content }) => {
    try {
      const userId = socket.user.id;

      if (!serverId || !channelId || !content || content.trim() === '') {
        return socket.emit('error', { message: 'Missing message parameters' });
      }

      // 1. Verify membership
      const memberCheck = await db.query(
        'SELECT role FROM server_members WHERE server_id = $1 AND user_id = $2',
        [serverId, userId]
      );

      if (memberCheck.rowCount === 0) {
        return socket.emit('error', { message: 'Access denied: You are not a member of this server' });
      }

      // 2. Persist message to PostgreSQL
      const insertResult = await db.query(
        'INSERT INTO messages (channel_id, server_id, sender_id, content) VALUES ($1, $2, $3, $4) RETURNING id, content, created_at',
        [channelId, serverId, userId, content.trim()]
      );

      const dbMessage = insertResult.rows[0];

      // 3. Construct message object
      const messagePayload = {
        id: dbMessage.id,
        content: dbMessage.content,
        createdAt: dbMessage.created_at,
        channelId,
        serverId,
        sender: {
          id: userId,
          username: socket.user.username,
        },
      };

      // 4. Publish to Redis Pub/Sub instead of direct emit (syncs multi-container deployments)
      await pubClient.publish('realtime:messages', JSON.stringify({
        event: 'new_message',
        channelId,
        message: messagePayload,
      }));

    } catch (err) {
      console.error('Error handling send_message:', err);
      socket.emit('error', { message: 'Internal server error while saving message' });
    }
  });
}

/**
 * Listen for message sync events via Redis Pub/Sub and broadcast to local connected clients.
 * 
 * @param {Object} io - Socket.io server instance
 */
function registerRedisMessageSubscriber(io) {
  subClient.subscribe('realtime:messages', (messageJson) => {
    try {
      const { event, channelId, message } = JSON.parse(messageJson);
      
      if (event === 'new_message') {
        // Broadcast to all clients connected on this specific Fargate instance inside the room
        io.to(`channel:${channelId}`).emit('message', message);
      }
    } catch (err) {
      console.error('Error parsing Redis Pub/Sub chat message:', err);
    }
  });
}

module.exports = {
  registerChatHandler,
  registerRedisMessageSubscriber,
};
