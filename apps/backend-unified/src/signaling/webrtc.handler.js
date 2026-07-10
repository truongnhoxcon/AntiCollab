const { redisClient, pubClient } = require('../config/redis');
const db = require('../config/db');

/**
 * Register WebRTC signaling event handlers.
 * 
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Connected socket client
 */
function registerWebRTCHandler(io, socket) {
  
  // Event: Join Voice Channel Room
  socket.on('join_voice_channel', async ({ channelId }) => {
    try {
      if (!channelId) {
        return socket.emit('error', { message: 'Missing channelId parameter' });
      }

      const roomName = `voice:${channelId}`;
      console.log(`[WebRTC Backend] User ${socket.user?.username || 'Unknown'} (${socket.id}) joining voice channel room: ${roomName}`);
      
      // Join the socket room designated for this channel
      socket.join(roomName);
      socket.currentVoiceChannelId = channelId;

      // Find serverId for this channel
      const channelResult = await db.query('SELECT server_id FROM channels WHERE id = $1', [channelId]);
      if (channelResult.rowCount > 0) {
        const serverId = channelResult.rows[0].server_id;
        socket.currentVoiceServerId = serverId;

        // Save to Redis presence with 60s TTL
        await redisClient.set(
          `presence:voice:${serverId}:${channelId}:${socket.user.id}`,
          socket.user.username,
          { EX: 60 }
        );

        // Broadcast to server room
        const voiceStatePayload = {
          serverId,
          channelId,
          userId: socket.user.id,
          username: socket.user.username,
        };
        io.to(`server:${serverId}`).emit('voice_user_joined', voiceStatePayload);

        // Publish to Redis Pub/Sub for cross-container sync
        try {
          await pubClient.publish('realtime:presence', JSON.stringify({
            event: 'voice_user_joined',
            ...voiceStatePayload
          }));
        } catch (pubErr) {
          console.error('[Redis] Failed to publish voice_user_joined:', pubErr.message);
        }
      }

      // Get all other active sockets inside this room
      const activeSockets = await io.in(roomName).fetchSockets();
      const users = activeSockets
        .filter((s) => s.id !== socket.id)
        .map((s) => ({
          socketId: s.id,
          userId: s.user?.id,
          username: s.user?.username || 'Unknown User'
        }));

      // Send the list of existing peers in the room back to the joining client
      socket.emit('get_current_voice_users', { users });

      // Broadcast to other peers in the room that a new user has joined
      socket.to(roomName).emit('user_joined_voice', {
        socketId: socket.id,
        userId: socket.user?.id,
        username: socket.user?.username || 'Unknown User'
      });

    } catch (err) {
      console.error('[WebRTC Backend] Error in join_voice_channel:', err);
      socket.emit('error', { message: 'Failed to join voice channel signaling room' });
    }
  });

  // Event: Forward WebRTC Offer to target peer
  socket.on('webrtc_offer', ({ targetSocketId, offer }) => {
    console.log(`[WebRTC Backend] Forwarding offer from ${socket.id} to ${targetSocketId}`);
    socket.to(targetSocketId).emit('webrtc_offer', {
      senderSocketId: socket.id,
      offer,
      senderUsername: socket.user?.username || 'Unknown User'
    });
  });

  // Event: Forward WebRTC Answer to target peer
  socket.on('webrtc_answer', ({ targetSocketId, answer }) => {
    console.log(`[WebRTC Backend] Forwarding answer from ${socket.id} to ${targetSocketId}`);
    socket.to(targetSocketId).emit('webrtc_answer', {
      senderSocketId: socket.id,
      answer
    });
  });

  // Event: Forward WebRTC ICE candidate to target peer
  socket.on('webrtc_ice_candidate', ({ targetSocketId, candidate }) => {
    console.log(`[WebRTC Backend] Forwarding ICE candidate from ${socket.id} to ${targetSocketId}`);
    socket.to(targetSocketId).emit('webrtc_ice_candidate', {
      senderSocketId: socket.id,
      candidate
    });
  });

  // Event: Leave Voice Channel
  socket.on('leave_voice_channel', async ({ channelId }) => {
    try {
      const activeChannel = channelId || socket.currentVoiceChannelId;
      if (!activeChannel) return;

      const serverId = socket.currentVoiceServerId;
      const userId = socket.user.id;

      const roomName = `voice:${activeChannel}`;
      console.log(`[WebRTC Backend] User ${socket.user?.username || 'Unknown'} (${socket.id}) leaving voice channel room: ${roomName}`);
      
      socket.leave(roomName);
      
      if (socket.currentVoiceChannelId === activeChannel) {
        socket.currentVoiceChannelId = null;
        socket.currentVoiceServerId = null;
      }

      // Delete from Redis
      if (serverId) {
        await redisClient.del(`presence:voice:${serverId}:${activeChannel}:${userId}`);
        
        const payload = { serverId, channelId: activeChannel, userId };
        io.to(`server:${serverId}`).emit('voice_user_left', payload);

        try {
          await pubClient.publish('realtime:presence', JSON.stringify({
            event: 'voice_user_left',
            ...payload
          }));
        } catch (pubErr) {
          console.error('[Redis] Failed to publish voice_user_left:', pubErr.message);
        }
      }

      // Notify other peers in the room
      socket.to(roomName).emit('user_left_voice', {
        socketId: socket.id
      });
    } catch (err) {
      console.error('[WebRTC Backend] Error in leave_voice_channel:', err);
    }
  });

  // Clean up on disconnect
  socket.on('disconnect', async () => {
    if (socket.currentVoiceChannelId && socket.currentVoiceServerId) {
      const activeChannel = socket.currentVoiceChannelId;
      const serverId = socket.currentVoiceServerId;
      const userId = socket.user.id;

      // Delete from Redis
      await redisClient.del(`presence:voice:${serverId}:${activeChannel}:${userId}`);

      const payload = { serverId, channelId: activeChannel, userId };
      io.to(`server:${serverId}`).emit('voice_user_left', payload);

      try {
        await pubClient.publish('realtime:presence', JSON.stringify({
          event: 'voice_user_left',
          ...payload
        }));
      } catch (redisErr) {
        console.error('[Redis] Failed to publish voice_user_left on disconnect:', redisErr.message);
      }

      const roomName = `voice:${activeChannel}`;
      socket.to(roomName).emit('user_left_voice', {
        socketId: socket.id
      });
    }
  });
}

module.exports = {
  registerWebRTCHandler
};
