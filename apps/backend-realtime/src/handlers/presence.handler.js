const db = require('../config/db');
const { pubClient, subClient, setUserPresence, removeUserPresence } = require('../config/redis');

/**
 * Register presence socket events and manage connection lifecycles.
 * 
 * @param {Object} io - Socket.io server instance
 * @param {Object} socket - Connected socket client
 */
async function registerPresenceHandler(io, socket) {
  const userId = socket.user.id;
  const username = socket.user.username;

  // Let each user join a personal room based on user ID to track multi-tab sessions
  socket.join(`user:${userId}`);

  try {
    // 1. Mark user as online in all servers they are a member of
    const userServers = await db.query(
      'SELECT server_id FROM server_members WHERE user_id = $1',
      [userId]
    );

    for (const row of userServers.rows) {
      const serverId = row.server_id;
      
      // Add user to server room on this socket instance to receive presence broadcasts
      socket.join(`server:${serverId}`);
      
      // Set presence key in Redis with 60s TTL
      await setUserPresence(serverId, userId, 'online', 60);

      // Publish presence change event to Redis Pub/Sub
      await pubClient.publish('realtime:presence', JSON.stringify({
        event: 'presence_change',
        serverId,
        userId,
        username,
        status: 'online',
      }));
    }

    // 2. Set up presence status TTL refresh loop (runs every 30 seconds)
    const presenceIntervalId = setInterval(async () => {
      try {
        console.log(`[Presence Refresh] Refreshing TTL for user ${username} (${userId})`);
        
        const servers = await db.query(
          'SELECT server_id FROM server_members WHERE user_id = $1',
          [userId]
        );

        for (const row of servers.rows) {
          await setUserPresence(row.server_id, userId, 'online', 60);
        }
      } catch (err) {
        console.error(`Error refreshing presence for user ${userId}:`, err.message);
      }
    }, 30000);

    // Attach interval ID to the socket to clear it on disconnect
    socket.presenceIntervalId = presenceIntervalId;

  } catch (err) {
    console.error(`Error initializing presence for user ${userId}:`, err);
  }

  // Handle Disconnection
  socket.on('disconnect', async (reason) => {
    console.log(`User ${username} disconnected. Reason: ${reason}. Socket ID: ${socket.id}`);
    
    // Clear the TTL refresh interval
    if (socket.presenceIntervalId) {
      clearInterval(socket.presenceIntervalId);
    }

    try {
      // Check if this user still has other active connections (multi-tab support)
      const userSockets = await io.in(`user:${userId}`).fetchSockets();
      
      if (userSockets.length === 0) {
        // No other active sockets for this user -> Go offline
        console.log(`User ${username} has no other active connections. Going offline.`);
        
        const userServers = await db.query(
          'SELECT server_id FROM server_members WHERE user_id = $1',
          [userId]
        );

        for (const row of userServers.rows) {
          const serverId = row.server_id;
          
          // Delete presence key in Redis
          await removeUserPresence(serverId, userId);

          // Publish presence offline change to Redis Pub/Sub
          await pubClient.publish('realtime:presence', JSON.stringify({
            event: 'presence_change',
            serverId,
            userId,
            username,
            status: 'offline',
          }));
        }
      } else {
        console.log(`User ${username} still has ${userSockets.length} other active connection(s). Remaining online.`);
      }
    } catch (err) {
      console.error(`Error tearing down presence for user ${userId}:`, err);
    }
  });
}

/**
 * Subscribe to presence changes via Redis Pub/Sub and broadcast to local connected sockets.
 * 
 * @param {Object} io - Socket.io server instance
 */
function registerRedisPresenceSubscriber(io) {
  subClient.subscribe('realtime:presence', (messageJson) => {
    try {
      const { event, serverId, userId, username, status } = JSON.parse(messageJson);
      
      if (event === 'presence_change') {
        // Broadcast presence updates to all local sockets in the server room
        io.to(`server:${serverId}`).emit('presence_change', {
          userId,
          username,
          status,
        });
        console.log(`[Presence Sync] Broadcasted presence for user ${username} (${status}) to server room "server:${serverId}"`);
      }
    } catch (err) {
      console.error('Error parsing Redis Pub/Sub presence message:', err);
    }
  });
}

module.exports = {
  registerPresenceHandler,
  registerRedisPresenceSubscriber,
};
