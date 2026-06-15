const { createClient } = require('redis');
require('dotenv').config();

const redisOptions = {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
    reconnectStrategy: (retries) => {
      // Reconnect strategy: try again every 1 second, up to a maximum delay of 3 seconds
      return Math.min(retries * 1000, 3000);
    }
  },
  password: process.env.REDIS_PASSWORD || undefined,
};

// Create main Redis clients
const redisClient = createClient(redisOptions);
const pubClient = createClient(redisOptions);
const subClient = createClient(redisOptions);

let isRedisConnected = false;
const offlinePresenceQueue = [];

// Clean up queue items older than 30 seconds
function cleanExpiredQueueItems() {
  const now = Date.now();
  const index = offlinePresenceQueue.findIndex(item => (now - item.timestamp) > 30000);
  if (index !== -1) {
    const expired = offlinePresenceQueue.splice(0, index + 1);
    console.warn(`[Redis Queue] Removed ${expired.length} expired presence updates from offline queue (older than 30s limit).`);
  }
}

// Periodically purge expired queue items every 5 seconds
setInterval(cleanExpiredQueueItems, 5000);

// Flush queued presence updates to Redis once connection is restored
async function flushOfflineQueue() {
  if (offlinePresenceQueue.length === 0) return;
  
  console.log(`[Redis Queue] Restoring ${offlinePresenceQueue.length} queued presence updates to Redis...`);
  
  const now = Date.now();
  while (offlinePresenceQueue.length > 0) {
    const item = offlinePresenceQueue.shift();
    // Double check if item hasn't expired since the last interval check
    if ((now - item.timestamp) <= 30000) {
      try {
        const key = `presence:workspace:${item.serverId}:${item.userId}`;
        // Adjust remaining TTL based on time spent in queue
        const elapsedSeconds = Math.floor((now - item.timestamp) / 1000);
        const remainingTtl = Math.max(item.ttl - elapsedSeconds, 1);
        
        await redisClient.set(key, item.status, { EX: remainingTtl });
        console.log(`[Redis Queue] Successfully flushed presence for user ${item.userId} in workspace ${item.serverId}`);
      } catch (err) {
        console.error(`[Redis Queue] Retry failed for user ${item.userId}:`, err.message);
        // Put back at the beginning of the queue if connection went down again
        offlinePresenceQueue.unshift(item);
        break;
      }
    }
  }
}

// Setup event listeners
const setupClientListeners = (client, name) => {
  client.on('connect', () => {
    console.log(`Redis client "${name}" connected.`);
  });
  
  client.on('ready', () => {
    if (name === 'CacheClient') {
      isRedisConnected = true;
      flushOfflineQueue().catch(err => console.error('Error flushing Redis offline queue:', err));
    }
    console.log(`Redis client "${name}" is ready.`);
  });
  
  client.on('error', (err) => {
    if (name === 'CacheClient') {
      isRedisConnected = false;
    }
    console.error(`Redis client "${name}" error:`, err.message);
  });
  
  client.on('end', () => {
    if (name === 'CacheClient') {
      isRedisConnected = false;
    }
    console.warn(`Redis client "${name}" connection closed.`);
  });
};

setupClientListeners(redisClient, 'CacheClient');
setupClientListeners(pubClient, 'PubClient');
setupClientListeners(subClient, 'SubClient');

/**
 * Perform a database-style SET for user presence.
 * Automatically buffers requests in memory for up to 30s if Redis is offline.
 * 
 * @param {string} serverId 
 * @param {string} userId 
 * @param {string} status - 'online' or 'offline'
 * @param {number} ttl - TTL in seconds (default 60s)
 */
async function setUserPresence(serverId, userId, status, ttl = 60) {
  const key = `presence:workspace:${serverId}:${userId}`;
  
  if (isRedisConnected) {
    try {
      await redisClient.set(key, status, { EX: ttl });
      return;
    } catch (err) {
      console.error(`Failed to set presence for ${userId} in Redis, queueing:`, err.message);
    }
  }
  
  // If Redis is offline or set command failed, queue the update
  console.warn(`[Redis Queue] Queueing presence update for user ${userId} (status: ${status}) in workspace ${serverId}. Redis is offline.`);
  offlinePresenceQueue.push({
    serverId,
    userId,
    status,
    ttl,
    timestamp: Date.now(),
  });
}

/**
 * Remove user presence state immediately from cache.
 * 
 * @param {string} serverId 
 * @param {string} userId 
 */
async function removeUserPresence(serverId, userId) {
  const key = `presence:workspace:${serverId}:${userId}`;
  if (isRedisConnected) {
    try {
      await redisClient.del(key);
    } catch (err) {
      console.error(`Failed to delete presence for ${userId}:`, err.message);
    }
  }
}

/**
 * Get the connection status of the Redis cache.
 */
function isConnected() {
  return isRedisConnected;
}

/**
 * Initialize and connect all Redis clients.
 */
async function connectAll() {
  try {
    await Promise.all([
      redisClient.connect(),
      pubClient.connect(),
      subClient.connect(),
    ]);
  } catch (err) {
    console.error('Failed to connect all Redis clients:', err.message);
    throw err;
  }
}

module.exports = {
  redisClient,
  pubClient,
  subClient,
  setUserPresence,
  removeUserPresence,
  isConnected,
  connectAll,
  offlinePresenceQueue, // Exposed for unit testing
};
