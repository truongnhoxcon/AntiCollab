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

      // Fetch online users from Redis for this server
      try {
        const { redisClient } = require('../config/redis');
        const keys = await redisClient.keys(`presence:workspace:${serverId}:*`);
        const onlineUserIds = keys.map(key => key.split(':').pop());
        socket.emit('server_online_users', { serverId, onlineUserIds });
        console.log(`Sent ${onlineUserIds.length} online users for server ${serverId} to user ${socket.user.username}`);
      } catch (redisErr) {
        console.error('Error fetching online users from Redis in join_channel:', redisErr.message);
      }

      // Fetch active voice users from Redis for this server
      try {
        const { redisClient } = require('../config/redis');
        const voiceKeys = await redisClient.keys(`presence:voice:${serverId}:*`);
        const voiceUsers = [];
        for (const key of voiceKeys) {
          const parts = key.split(':');
          const channelId = parts[3];
          const userId = parts[4];
          const username = await redisClient.get(key);
          if (username) {
            voiceUsers.push({ channelId, userId, username });
          }
        }
        socket.emit('server_voice_users', { serverId, voiceUsers });
        console.log(`Sent ${voiceUsers.length} voice users for server ${serverId} to user ${socket.user.username}`);
      } catch (redisErr) {
        console.error('Error fetching voice users from Redis in join_channel:', redisErr.message);
      }
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

      // 4. Publish to Redis Pub/Sub for cross-container broadcast.
      //    Also emit directly to the sender's socket so the message appears
      //    immediately even if Redis Pub/Sub is delayed or unavailable.
      const publishPayload = JSON.stringify({
        event: 'new_message',
        channelId,
        message: messagePayload,
        originSocketId: socket.id, // used by subscriber to skip re-emit on same container
      });

      // Direct emit to all sockets in this room on this container instance.
      // This handles the common case where both users are on the same container
      // (sticky sessions) without depending on the Redis Pub/Sub round-trip.
      io.to(`channel:${channelId}`).emit('message', messagePayload);

      // Also publish to Redis so other container instances broadcast to their
      // locally connected clients (multi-container sync).
      try {
        await pubClient.publish('realtime:messages', publishPayload);
      } catch (pubErr) {
        console.error('[Redis] Failed to publish message to Pub/Sub:', pubErr.message);
        // Direct emit above already handled local delivery — this is non-fatal.
      }

    } catch (err) {
      console.error('Error handling send_message:', err);
      socket.emit('error', { message: 'Internal server error while saving message' });
    }
  });

  // Event: Send Direct Message (DM)
  socket.on('send_dm', async ({ receiverId, content }) => {
    try {
      const senderId = socket.user.id;

      if (!receiverId || !content || content.trim() === '') {
        return socket.emit('error', { message: 'Missing DM parameters' });
      }

      // 1. Persist DM message to PostgreSQL
      const insertResult = await db.query(
        'INSERT INTO messages (sender_id, receiver_id, content) VALUES ($1, $2, $3) RETURNING id, content, created_at',
        [senderId, receiverId, content.trim()]
      );

      const dbMessage = insertResult.rows[0];

      // Ensure DM conversation is active in user_dms for both sender and receiver
      await db.query(
        `INSERT INTO user_dms (user_id, dm_user_id, active) 
         VALUES ($1, $2, TRUE) 
         ON CONFLICT (user_id, dm_user_id) 
         DO UPDATE SET active = TRUE`,
        [senderId, receiverId]
      );
      await db.query(
        `INSERT INTO user_dms (user_id, dm_user_id, active) 
         VALUES ($1, $2, TRUE) 
         ON CONFLICT (user_id, dm_user_id) 
         DO UPDATE SET active = TRUE`,
        [receiverId, senderId]
      );

      // 2. Construct message object
      const messagePayload = {
        id: dbMessage.id,
        content: dbMessage.content,
        createdAt: dbMessage.created_at,
        senderId,
        receiverId,
        sender: {
          id: senderId,
          username: socket.user.username,
        },
      };

      // 3. Emit to sender and receiver user rooms
      io.to(`user:${senderId}`).emit('dm_message', messagePayload);
      io.to(`user:${receiverId}`).emit('dm_message', messagePayload);

      // 4. Publish to Redis Pub/Sub for cross-container broadcast
      const publishPayload = JSON.stringify({
        event: 'new_dm_message',
        message: messagePayload,
        originSocketId: socket.id,
      });

      try {
        await pubClient.publish('realtime:messages', publishPayload);
      } catch (pubErr) {
        console.error('[Redis] Failed to publish DM message to Pub/Sub:', pubErr.message);
      }

    } catch (err) {
      console.error('Error handling send_dm:', err);
      socket.emit('error', { message: 'Internal server error while saving DM message' });
    }
  });
}

/**
 * Listen for message sync events via Redis Pub/Sub and broadcast to local connected clients.
 * Only re-emits messages that originated from OTHER container instances to avoid duplicates
 * (direct io.to().emit() in the send_message handler already covers local delivery).
 * 
 * @param {Object} io - Socket.io server instance
 */
function registerRedisMessageSubscriber(io) {
  subClient.subscribe('realtime:messages', (messageJson) => {
    try {
      const parsed = JSON.parse(messageJson);
      const { event, channelId, message, originSocketId } = parsed;
      
      // Skip if this message was published by the current container instance
      if (originSocketId && io.sockets.sockets.has(originSocketId)) {
        return;
      }

      if (event === 'new_message') {
        io.to(`channel:${channelId}`).emit('message', message);
      } else if (event === 'new_dm_message') {
        const { senderId, receiverId } = message;
        io.to(`user:${senderId}`).emit('dm_message', message);
        io.to(`user:${receiverId}`).emit('dm_message', message);
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
