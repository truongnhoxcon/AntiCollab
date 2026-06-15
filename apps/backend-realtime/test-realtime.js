const { io: ioClient } = require('socket.io-client');
const jwt = require('jsonwebtoken');
const { startServer, io: socketServer } = require('./src/app');
const db = require('./src/config/db');
const redisConfig = require('./src/config/redis');

const TEST_PORT = 4001;
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_me_in_production';

// Mock UUIDs for tests
const aliceId = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const bobId = 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44';
const serverId = 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
const channelId = 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33';

let server;

async function bootstrapTestDatabase() {
  try {
    await db.query('SELECT 1');
    console.log('✔ PostgreSQL connection established for tests.');

    // Reset table contents for clean test run
    await db.query('TRUNCATE TABLE messages, channels, server_members, servers, users CASCADE');

    // Create test accounts
    await db.query(
      "INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, 'hashed')",
      [aliceId, 'alice', 'alice@example.com']
    );
    await db.query(
      "INSERT INTO users (id, username, email, password_hash) VALUES ($1, $2, $3, 'hashed')",
      [bobId, 'bob', 'bob@example.com']
    );

    // Create server and member relationship
    await db.query(
      "INSERT INTO servers (id, name, owner_id) VALUES ($1, 'Test Workspace', $2)",
      [serverId, aliceId]
    );
    await db.query(
      "INSERT INTO server_members (server_id, user_id, role) VALUES ($1, $2, 'owner')",
      [serverId, aliceId]
    );
    // Note: Bob is deliberately NOT a member of Alice's server

    // Create channel
    await db.query(
      "INSERT INTO channels (id, name, server_id, type) VALUES ($1, 'general', $2, 'text')",
      [channelId, serverId]
    );

    console.log('✔ Test database data bootstrapped successfully.');
    return true;
  } catch (err) {
    console.warn('⚠️ Test database bootstrap failed. Continuing with mock check.');
    console.warn(err.message);
    return false;
  }
}

async function runTests() {
  console.log('--- Starting Real-time WebSocket Engine Integration Tests ---');

  const dbConnected = await bootstrapTestDatabase();
  if (!dbConnected) {
    console.error('❌ Database connection is required to verify membership authorization. Exiting.');
    process.exit(1);
  }

  // 1. Sign JWT Tokens
  const tokenAlice = jwt.sign({ id: aliceId, username: 'alice' }, JWT_SECRET);
  const tokenBob = jwt.sign({ id: bobId, username: 'bob' }, JWT_SECRET);

  // 2. Start WebSocket and Redis server
  try {
    server = await startServer(TEST_PORT);
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }

  // Helper function to connect a socket client
  const connectClient = (token) => {
    return ioClient(`http://localhost:${TEST_PORT}`, {
      path: '/ws',
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
  };

  let clientAlice;
  let clientBob;

  try {
    // Test A: Alice connects successfully (Valid Token)
    clientAlice = connectClient(tokenAlice);
    await new Promise((resolve, reject) => {
      clientAlice.on('connect', resolve);
      clientAlice.on('connect_error', reject);
    });
    console.log('✔ Test Passed: Alice connected successfully with JWT handshake auth');

    // Test B: Verify Alice presence was set to online in Redis
    const redisPresence = await redisConfig.redisClient.get(`presence:workspace:${serverId}:${aliceId}`);
    if (redisPresence === 'online') {
      console.log('✔ Test Passed: Alice presence marked "online" in Redis Cache Layer');
    } else {
      throw new Error(`Presence missing in Redis. Found: ${redisPresence}`);
    }

    // Test C: Bob connects successfully (Valid Token)
    clientBob = connectClient(tokenBob);
    await new Promise((resolve) => clientBob.on('connect', resolve));
    console.log('✔ Test Passed: Bob connected successfully with JWT handshake auth');

    // Test D: Alice joins Channel A successfully
    const joinPromise = new Promise((resolve, reject) => {
      clientAlice.on('joined_channel', (data) => {
        if (data.channelId === channelId) resolve();
        else reject(new Error('Returned wrong channel ID'));
      });
      clientAlice.on('error', reject);
      clientAlice.emit('join_channel', { serverId, channelId });
    });
    await joinPromise;
    console.log('✔ Test Passed: Alice joined channel room successfully after passing membership check');

    // Test E: Bob attempts to join Channel A (EXPECT error)
    const bobJoinPromise = new Promise((resolve, reject) => {
      clientBob.on('error', (err) => {
        if (err.message && err.message.includes('Access denied')) {
          resolve();
        } else {
          reject(new Error(`Wrong error message: ${JSON.stringify(err)}`));
        }
      });
      clientBob.emit('join_channel', { serverId, channelId });
    });
    await bobJoinPromise;
    console.log('✔ Test Passed: Bob BLOCKED from joining Alice channel (403 Access Denied equivalent)');

    // Test F: Chat message delivery via Redis Pub/Sub
    // Connect a second client for Alice to simulate another user in the channel receiving the broadcast
    const clientAlice2 = connectClient(tokenAlice);
    await new Promise((resolve) => clientAlice2.on('connect', resolve));
    clientAlice2.emit('join_channel', { serverId, channelId });
    await new Promise((resolve) => clientAlice2.on('joined_channel', resolve));

    const messagePromise = new Promise((resolve) => {
      clientAlice2.on('message', (msg) => {
        if (msg.content === 'Hello PubSub!') {
          resolve(msg);
        }
      });
    });

    clientAlice.emit('send_message', { serverId, channelId, content: 'Hello PubSub!' });
    const receivedMsg = await messagePromise;
    console.log(`✔ Test Passed: Message distributed via Redis Pub/Sub. Content: "${receivedMsg.content}"`);

    // Verify message persisted in database
    const dbMsgCheck = await db.query('SELECT content FROM messages WHERE id = $1', [receivedMsg.id]);
    if (dbMsgCheck.rowCount > 0 && dbMsgCheck.rows[0].content === 'Hello PubSub!') {
      console.log('✔ Test Passed: Message successfully persisted to PostgreSQL');
    } else {
      throw new Error('Message not found in Postgres');
    }

    // Test G: Alice Disconnects & Presence Removal
    clientAlice.disconnect();
    clientAlice2.disconnect();
    
    // Allow a few milliseconds for disconnection event handlers to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    const redisPresenceAfter = await redisConfig.redisClient.get(`presence:workspace:${serverId}:${aliceId}`);
    if (!redisPresenceAfter) {
      console.log('✔ Test Passed: Alice presence DELETED from Redis upon socket disconnection');
    } else {
      throw new Error(`Presence still exists in Redis: ${redisPresenceAfter}`);
    }

    console.log('\n⭐⭐⭐ ALL REAL-TIME ENGINE TESTS PASSED SUCCESSFULLY! ⭐⭐⭐');
    cleanup(0);
  } catch (err) {
    console.error('\n❌ REAL-TIME ENGINE TEST FAILED:', err.message);
    cleanup(1);
  }
}

function cleanup(code) {
  if (clientAlice) clientAlice.disconnect();
  if (clientBob) clientBob.disconnect();

  if (server) {
    server.close(() => {
      console.log('Test WebSocket server closed.');
      db.pool.end(() => {
        console.log('PostgreSQL database pool closed.');
        // Redis connection termination
        Promise.all([
          redisConfig.redisClient.quit(),
          redisConfig.pubClient.quit(),
          redisConfig.subClient.quit(),
        ]).then(() => {
          console.log('Redis connections closed.');
          process.exit(code);
        }).catch((err) => {
          console.error('Error closing Redis connections:', err.message);
          process.exit(code);
        });
      });
    });
  } else {
    process.exit(code);
  }
}

runTests();
